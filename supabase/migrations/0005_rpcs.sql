-- =============================================================================
-- 0005 — RPCs de aplicação (auditoria e reserva de quota)
-- SECURITY DEFINER com verificação de escopo equivalente (TEN-06).
-- =============================================================================

-- Registro de auditoria append-only. Valida que o ator pertence à org (ou é
-- admin de plataforma). Metadados devem chegar já redigidos (sem PII/segredos).
create or replace function public.audit_log(
  p_org uuid,
  p_client uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_result text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text := 'user';
begin
  if v_uid is null then raise exception 'não autenticado'; end if;

  if p_org is not null then
    if not app.is_member(p_org) then
      if app.is_platform_admin() then
        v_kind := 'platform_admin';
      else
        raise exception 'sem acesso à organização';
      end if;
    end if;
  end if;

  insert into public.audit_events(
    organization_id, client_id, actor_user_id, actor_kind, action,
    target_type, target_id, result, metadata
  )
  values (
    p_org, p_client, v_uid, v_kind, p_action,
    p_target_type, p_target_id, coalesce(p_result, 'ok'), coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;
revoke all on function public.audit_log(uuid, uuid, text, text, text, text, jsonb) from public;
grant execute on function public.audit_log(uuid, uuid, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Reserva atômica de execução de IA (BILL-04, §12.4).
-- Conta runs 'settled'+'reserved' no mês e insere reserva se dentro do limite,
-- tudo numa transação. Retorna o id da reserva ou levanta exceção de quota.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_ai_run(
  p_org uuid,
  p_idempotency_key text,
  p_limit int
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if not app.is_org_admin(p_org) and not app.is_member(p_org) then
    raise exception 'sem acesso à organização';
  end if;

  -- Idempotência: se já existe reserva com a chave, retorna-a.
  select id into v_id from public.usage_ledger
   where organization_id = p_org and resource = 'ai_run' and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  -- Lock por organização para impedir corrida no último crédito (T25).
  perform pg_advisory_xact_lock(hashtextextended(p_org::text || ':ai_run', 0));

  select count(*) into v_used
  from public.usage_ledger
  where organization_id = p_org
    and resource = 'ai_run'
    and state in ('reserved', 'settled')
    and created_at >= date_trunc('month', now());

  if p_limit is not null and v_used >= p_limit then
    raise exception 'quota_exceeded:ai_runs';
  end if;

  insert into public.usage_ledger(organization_id, resource, unit, idempotency_key, quantity, state)
  values (p_org, 'ai_run', 'run', p_idempotency_key, 1, 'reserved')
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.reserve_ai_run(uuid, text, int) from public;
grant execute on function public.reserve_ai_run(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Verificação de papel de plataforma para a própria sessão (as tabelas de
-- control plane são default-deny; esta função expõe apenas um booleano).
-- ---------------------------------------------------------------------------
create or replace function public.am_i_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select app.is_platform_admin();
$$;
revoke all on function public.am_i_platform_admin() from public;
grant execute on function public.am_i_platform_admin() to authenticated;

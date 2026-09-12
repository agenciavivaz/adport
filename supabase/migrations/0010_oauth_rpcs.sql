-- =============================================================================
-- 0010 — RPCs de OAuth (ADS-01, §7.1, §16.1).
-- Contexto assinado/armazenado no servidor: state de uso único vinculado ao ator
-- e tenant. Escrita em oauth_transactions/connections é default-deny para usuário;
-- estas RPCs SECURITY DEFINER fazem a verificação de permissão equivalente.
-- =============================================================================
set check_function_bodies = off;

-- Inicia transação OAuth. Requer admin (ou connections.manage no cliente).
create or replace function public.start_oauth(
  p_client uuid,
  p_provider text,
  p_redirect_uri text,
  p_state_digest text,
  p_pkce_verifier_digest text
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare v_org uuid; v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  select organization_id into v_org from public.clients where id = p_client;
  if v_org is null then raise exception 'cliente inexistente'; end if;
  if not app.is_org_admin(v_org) then raise exception 'sem permissão'; end if;

  insert into public.oauth_transactions(
    organization_id, client_id, provider, actor_user_id,
    state_digest, pkce_verifier_digest, redirect_uri
  )
  values (v_org, p_client, p_provider, v_uid, p_state_digest, p_pkce_verifier_digest, p_redirect_uri)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.start_oauth(uuid, text, text, text, text) from public;
grant execute on function public.start_oauth(uuid, text, text, text, text) to authenticated;

-- Consome o state no callback (uso único). Retorna o contexto se válido.
-- Aceita o digest; o próprio callback já resolveu o usuário autenticado.
create or replace function public.consume_oauth_state(p_state_digest text)
returns table (id uuid, organization_id uuid, client_id uuid, provider text, redirect_uri text, pkce_verifier_digest text)
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  return query
  update public.oauth_transactions t
     set consumed_at = now()
   where t.state_digest = p_state_digest
     and t.consumed_at is null
     and t.expires_at > now()
     and t.actor_user_id = v_uid       -- vinculado ao ator (§16.1)
  returning t.id, t.organization_id, t.client_id, t.provider, t.redirect_uri, t.pkce_verifier_digest;
end;
$$;
revoke all on function public.consume_oauth_state(text) from public;
grant execute on function public.consume_oauth_state(text) to authenticated;

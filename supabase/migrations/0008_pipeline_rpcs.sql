-- =============================================================================
-- 0008 — RPCs do pipeline de sincronização (Fase 1.2), ADR-0003.
-- enqueue (admin, cooldown) / claim (worker, lease+lock) / complete / fail (backoff+DLQ)
-- e ingestão idempotente de fatos diários (Gate G2).
-- =============================================================================
set check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- enqueue_sync_job — disparo por admin com cooldown de 15 min (ADS-04).
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_sync_job(
  p_connection uuid,
  p_job_type text,
  p_entity text,
  p_partition text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_org uuid; v_client uuid; v_last timestamptz; v_id uuid;
begin
  select organization_id, client_id, last_synced_at
    into v_org, v_client, v_last
  from public.connections where id = p_connection;
  if v_org is null then raise exception 'conexão inexistente'; end if;
  if not app.is_org_admin(v_org) and not app.has_client_access(v_org, v_client) then
    raise exception 'sem acesso à conexão';
  end if;

  -- Cooldown de 15 minutos para disparo manual (ADS-04).
  if p_job_type = 'sync_facts' and v_last is not null and v_last > now() - interval '15 minutes' then
    raise exception 'cooldown_active:sync';
  end if;

  insert into public.sync_jobs(organization_id, client_id, connection_id, job_type, entity, partition, payload)
  values (v_org, v_client, p_connection, p_job_type, p_entity, p_partition, coalesce(p_payload,'{}'::jsonb))
  on conflict (connection_id, job_type, coalesce(entity,''), coalesce(partition,''))
    where status in ('pending','leased')
  do nothing
  returning id into v_id;

  return v_id; -- null se já havia job ativo idêntico (lock lógico)
end;
$$;
revoke all on function public.enqueue_sync_job(uuid, text, text, text, jsonb) from public;
grant execute on function public.enqueue_sync_job(uuid, text, text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- claim_sync_jobs — reserva jobs elegíveis com lease + FOR UPDATE SKIP LOCKED.
-- Chamada pelo dispatcher/worker (service_role). Não cria execução concorrente
-- da mesma partição (idx único de partição ativa + skip locked).
-- -----------------------------------------------------------------------------
create or replace function public.claim_sync_jobs(
  p_worker text,
  p_limit int,
  p_lease_seconds int
)
returns setof public.sync_jobs
language plpgsql
as $$
begin
  return query
  with ready as (
    select id from public.sync_jobs
    where status = 'pending' and next_run_at <= now()
    order by next_run_at
    for update skip locked
    limit greatest(p_limit, 1)
  )
  update public.sync_jobs j
     set status = 'leased',
         locked_by = p_worker,
         lease_until = now() + make_interval(secs => greatest(p_lease_seconds, 5)),
         attempts = j.attempts + 1
    from ready
   where j.id = ready.id
  returning j.*;
end;
$$;
revoke all on function public.claim_sync_jobs(text, int, int) from public;
grant execute on function public.claim_sync_jobs(text, int, int) to service_role;

-- Recupera jobs cujo lease expirou (worker caiu) — reentrega (ADR-0003 §5).
create or replace function public.reap_expired_leases()
returns int
language sql
as $$
  with expired as (
    update public.sync_jobs
       set status = 'pending', locked_by = null, lease_until = null
     where status = 'leased' and lease_until < now()
     returning 1
  )
  select count(*)::int from expired;
$$;
revoke all on function public.reap_expired_leases() from public;
grant execute on function public.reap_expired_leases() to service_role;

create or replace function public.complete_sync_job(p_id uuid, p_next_cursor text)
returns void
language plpgsql
as $$
begin
  update public.sync_jobs
     set status = 'done', cursor = coalesce(p_next_cursor, cursor),
         locked_by = null, lease_until = null, error_code = null, last_error = null
   where id = p_id;
end;
$$;
revoke all on function public.complete_sync_job(uuid, text) from public;
grant execute on function public.complete_sync_job(uuid, text) to service_role;

-- Falha com backoff exponencial + jitter; DLQ ('dead') após max_attempts.
create or replace function public.fail_sync_job(p_id uuid, p_code text, p_error text)
returns text
language plpgsql
as $$
declare v_att int; v_max int; v_delay int; v_state text;
begin
  select attempts, max_attempts into v_att, v_max from public.sync_jobs where id = p_id;
  if v_att >= v_max then
    v_state := 'dead';
    update public.sync_jobs
       set status = 'dead', error_code = p_code, last_error = left(coalesce(p_error,''), 2000),
           locked_by = null, lease_until = null
     where id = p_id;
  else
    v_state := 'pending';
    -- backoff: 2^attempts segundos, teto 900s, + jitter [0,30)
    v_delay := least(power(2, v_att)::int, 900) + floor(random()*30)::int;
    update public.sync_jobs
       set status = 'pending', error_code = p_code, last_error = left(coalesce(p_error,''), 2000),
           locked_by = null, lease_until = null, next_run_at = now() + make_interval(secs => v_delay)
     where id = p_id;
  end if;
  return v_state;
end;
$$;
revoke all on function public.fail_sync_job(uuid, text, text) from public;
grant execute on function public.fail_sync_job(uuid, text, text) to service_role;

-- Reprocessa um job da DLQ (não ignora idempotência) — ADM-05/§17.2.
create or replace function public.requeue_dead_job(p_id uuid)
returns void
language plpgsql
as $$
begin
  update public.sync_jobs
     set status = 'pending', attempts = 0, next_run_at = now(), error_code = null, last_error = null
   where id = p_id and status = 'dead';
end;
$$;
revoke all on function public.requeue_dead_job(uuid) from public;
grant execute on function public.requeue_dead_job(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- ingest_ad_daily_facts — UPSERT idempotente (Gate G2). Escopo derivado dos
-- parâmetros (não confiar em org/client vindos de cada linha). Snapshot: substitui.
-- p_rows: array de objetos { grain, entity_external_id, date_local, metric_set,
-- spend, impressions, clicks, conversions, conversion_value, attribution_snapshot }.
-- -----------------------------------------------------------------------------
create or replace function public.ingest_ad_daily_facts(
  p_org uuid,
  p_client uuid,
  p_provider_account uuid,
  p_currency char(3),
  p_rows jsonb
)
returns int
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare v_count int;
begin
  -- provider_account precisa pertencer ao escopo informado.
  if not exists (
    select 1 from public.provider_accounts
    where id = p_provider_account and organization_id = p_org and client_id = p_client
  ) then
    raise exception 'provider_account fora do escopo';
  end if;

  with incoming as (
    select * from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
      grain text,
      entity_external_id text,
      date_local date,
      metric_set text,
      spend numeric,
      impressions bigint,
      clicks bigint,
      conversions numeric,
      conversion_value numeric,
      attribution_snapshot jsonb
    )
  ),
  upserted as (
    insert into public.ad_daily_facts(
      organization_id, client_id, provider_account_id, grain, entity_external_id,
      date_local, currency, metric_set, spend, impressions, clicks, conversions,
      conversion_value, attribution_snapshot, ingested_at
    )
    select
      p_org, p_client, p_provider_account, i.grain, i.entity_external_id,
      i.date_local, p_currency, coalesce(i.metric_set,'default'),
      coalesce(i.spend,0), coalesce(i.impressions,0), coalesce(i.clicks,0),
      coalesce(i.conversions,0), coalesce(i.conversion_value,0),
      coalesce(i.attribution_snapshot,'{}'::jsonb), now()
    from incoming i
    on conflict (organization_id, client_id, provider_account_id, grain, entity_external_id, date_local, metric_set, currency)
    do update set
      spend = excluded.spend,               -- snapshot: substitui, não acumula
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      conversions = excluded.conversions,
      conversion_value = excluded.conversion_value,
      attribution_snapshot = excluded.attribution_snapshot,
      ingested_at = now()
    returning 1
  )
  select count(*)::int into v_count from upserted;

  return v_count;
end;
$$;
revoke all on function public.ingest_ad_daily_facts(uuid, uuid, uuid, char, jsonb) from public;
grant execute on function public.ingest_ad_daily_facts(uuid, uuid, uuid, char, jsonb) to service_role;

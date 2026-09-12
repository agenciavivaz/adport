-- =============================================================================
-- 0009 — Importação CSV de mídia (ADS-07). Namespace de origem separado do
-- conector: usa um provider_account 'generic' (external_account_id='csv-media').
-- Idempotente (mesma chave => upsert). Sob JWT do admin (SECURITY DEFINER + checagem).
-- =============================================================================
set check_function_bodies = off;

create or replace function public.import_media_facts(
  p_org uuid,
  p_client uuid,
  p_import_id text,
  p_currency char(3),
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_conn uuid;
  v_pa uuid;
  v_accepted int;
begin
  if not app.is_org_admin(p_org) then
    raise exception 'sem permissão de admin';
  end if;
  if not exists (select 1 from public.clients where id = p_client and organization_id = p_org) then
    raise exception 'cliente fora do escopo';
  end if;

  -- Conexão 'generic' para importações CSV (uma por cliente).
  select id into v_conn from public.connections
   where organization_id = p_org and client_id = p_client and provider = 'generic'
   limit 1;
  if v_conn is null then
    insert into public.connections(organization_id, client_id, provider, status)
    values (p_org, p_client, 'generic', 'connected')
    returning id into v_conn;
  end if;

  -- provider_account que representa a fonte CSV (namespace separado do conector).
  select id into v_pa from public.provider_accounts
   where organization_id = p_org and provider = 'generic' and external_account_id = 'csv-media';
  if v_pa is null then
    insert into public.provider_accounts(organization_id, client_id, connection_id, provider, external_account_id, name, currency)
    values (p_org, p_client, v_conn, 'generic', 'csv-media', 'Importação CSV', p_currency)
    returning id into v_pa;
  end if;

  -- Registro de proveniência do import.
  insert into public.ingestion_events(organization_id, client_id, namespace, external_event_id, event_type, occurred_at, status)
  values (p_org, p_client, 'csv:media', p_import_id, 'media.import', now(), 'accepted')
  on conflict (organization_id, client_id, namespace, external_event_id) do nothing;

  -- UPSERT idempotente dos fatos (mesma chave substitui).
  select public.ingest_ad_daily_facts(p_org, p_client, v_pa, p_currency, p_rows) into v_accepted;

  return jsonb_build_object('accepted', v_accepted, 'provider_account', v_pa, 'connection', v_conn);
end;
$$;
revoke all on function public.import_media_facts(uuid, uuid, text, char, jsonb) from public;
grant execute on function public.import_media_facts(uuid, uuid, text, char, jsonb) to authenticated;

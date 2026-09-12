-- =============================================================================
-- 0006 — Conexões e ingestão (Fase 1.2)
-- PRD §13.3. connections, oauth_transactions, provider_accounts, sync_jobs,
-- sync_runs, ingestion_events, raw_imports, data_quality_issues, source_crosswalks.
-- Segredos NUNCA em colunas legíveis: apenas secret_ref (ADR-0004).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- connections — uma conexão operacional pertence a um cliente (§4.1).
-- -----------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider text not null check (provider in ('google_ads','meta_ads','kommo','hubspot','ga4','generic')),
  -- Workspace/manager externo (ex.: MCC do Google), quando aplicável.
  external_workspace text,
  status text not null default 'not_configured' check (status in (
    'not_configured','connecting','connected','syncing','partial',
    'reauth_required','rate_limited','error','disabled'
  )),
  scopes text[] not null default '{}',
  -- Referência ao segredo no cofre; nunca o token em si.
  secret_ref jsonb,
  config_version integer not null default 1,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_conn_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade,
  constraint connections_scope_id_unique unique (organization_id, client_id, id)
);
create index idx_conn_org_client on public.connections(organization_id, client_id);
create index idx_conn_provider on public.connections(provider, status);
create trigger trg_conn_updated before update on public.connections
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- oauth_transactions — state de uso único vinculado ao ator e tenant (§16.1).
-- Guarda digests, nunca o segredo/verifier em claro.
-- -----------------------------------------------------------------------------
create table public.oauth_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  state_digest text not null unique,
  pkce_verifier_digest text, -- digest do code_verifier (PKCE)
  redirect_uri text not null,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fk_oauthtx_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade
);
create index idx_oauthtx_actor on public.oauth_transactions(actor_user_id);

-- -----------------------------------------------------------------------------
-- provider_accounts — contas externas descobertas/associadas.
-- Uma conta externa tem UMA associação ativa por organização (§4.1).
-- -----------------------------------------------------------------------------
create table public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  connection_id uuid not null references public.connections(id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  name text,
  currency char(3),
  timezone text,
  manager_external_id text,
  status text not null default 'active' check (status in ('active','paused','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_pa_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade,
  -- Uma associação ativa da conta externa por organização.
  constraint pa_unique_active unique (organization_id, provider, external_account_id),
  constraint pa_scope_id_unique unique (organization_id, client_id, id)
);
create index idx_pa_conn on public.provider_accounts(connection_id);
create trigger trg_pa_updated before update on public.provider_accounts
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_jobs — fila persistida com lease/lock, retries e DLQ (ADR-0003).
-- Carrega apenas IDs internos + referência ao segredo (via connection).
-- -----------------------------------------------------------------------------
create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  connection_id uuid not null references public.connections(id) on delete cascade,
  job_type text not null, -- ex.: 'discover_accounts','sync_facts'
  entity text,            -- ex.: 'campaign','ad_group','ad'
  cursor text,            -- paginação do adapter
  partition text,         -- ex.: intervalo de datas 'YYYY-MM-DD..YYYY-MM-DD'
  status text not null default 'pending' check (status in (
    'pending','leased','done','error','dead'
  )),
  lease_until timestamptz,
  locked_by text,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_run_at timestamptz not null default now(),
  error_code text,
  last_error text,        -- redigido
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_job_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade
);
create index idx_jobs_ready on public.sync_jobs(status, next_run_at) where status = 'pending';
create index idx_jobs_conn on public.sync_jobs(connection_id);
-- Evita jobs concorrentes idênticos ativos na mesma partição (lock lógico).
create unique index uq_jobs_active_partition
  on public.sync_jobs(connection_id, job_type, coalesce(entity,''), coalesce(partition,''))
  where status in ('pending','leased');
create trigger trg_jobs_updated before update on public.sync_jobs
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- sync_runs — histórico de execução por conexão (contagens/cobertura).
-- -----------------------------------------------------------------------------
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  connection_id uuid not null references public.connections(id) on delete cascade,
  coverage_since date,
  coverage_until date,
  rows_accepted integer not null default 0,
  rows_rejected integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  adapter_version text,
  constraint fk_run_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade
);
create index idx_runs_conn on public.sync_runs(connection_id, started_at);

-- -----------------------------------------------------------------------------
-- ingestion_events — dedupe por namespace + external event id (idempotência).
-- -----------------------------------------------------------------------------
create table public.ingestion_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  namespace text not null, -- ex.: 'google_ads', 'csv:import-xyz', 'crm:kommo'
  external_event_id text not null,
  event_type text,
  occurred_at timestamptz,
  ingested_at timestamptz not null default now(),
  status text not null default 'accepted' check (status in ('accepted','duplicate','rejected','quarantined')),
  constraint fk_ie_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade,
  unique (organization_id, client_id, namespace, external_event_id)
);

-- -----------------------------------------------------------------------------
-- raw_imports — arquivo privado + checksum + retenção (§16.2).
-- -----------------------------------------------------------------------------
create table public.raw_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  kind text not null, -- 'media_csv', 'crm_csv', ...
  storage_path text not null,
  schema_version text not null,
  checksum text,
  rows_total integer,
  rows_accepted integer,
  rows_rejected integer,
  state text not null default 'uploaded' check (state in ('uploaded','dry_run','committed','rejected')),
  retention_until date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint fk_ri_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade
);
create index idx_ri_org_client on public.raw_imports(organization_id, client_id);

-- -----------------------------------------------------------------------------
-- data_quality_issues — sem PII desnecessária.
-- -----------------------------------------------------------------------------
create table public.data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  object_type text not null,
  object_ref text,
  rule text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  state text not null default 'open' check (state in ('open','acknowledged','resolved')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fk_dqi_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade
);
create index idx_dqi_org_client on public.data_quality_issues(organization_id, client_id, state);

-- -----------------------------------------------------------------------------
-- source_crosswalks — equivalência explícita entre objetos (§10.3).
-- -----------------------------------------------------------------------------
create table public.source_crosswalks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  object_type text not null,
  left_namespace text not null,
  left_external_id text not null,
  right_namespace text not null,
  right_external_id text not null,
  method text not null check (method in ('exact','mapped','manual')),
  approved_by uuid references auth.users(id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  constraint fk_xwalk_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade,
  unique (organization_id, client_id, object_type, left_namespace, left_external_id, right_namespace, right_external_id)
);

-- =====================================================================
-- RLS — tudo escopado por acesso ao cliente (has_client_access).
-- Leitura por quem acessa o cliente; escrita sensível por admin ou serviço.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'connections','oauth_transactions','provider_accounts','sync_jobs','sync_runs',
    'ingestion_events','raw_imports','data_quality_issues','source_crosswalks'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    execute format($f$
      create policy %1$s_select on public.%1$I
        for select to authenticated
        using (app.has_client_access(organization_id, client_id));
    $f$, t);
  end loop;
end $$;

-- Escrita por admin (connections/accounts/crosswalks/quality/imports).
create policy connections_write_admin on public.connections
  for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));
create policy pa_write_admin on public.provider_accounts
  for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));
create policy xwalk_write_admin on public.source_crosswalks
  for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));
create policy dqi_write_admin on public.data_quality_issues
  for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));
create policy ri_write_admin on public.raw_imports
  for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));

-- sync_jobs / sync_runs / ingestion_events / oauth_transactions: escrita apenas
-- por serviço/RPCs (dispatcher/worker/OAuth callback). Sem policy de escrita de
-- usuário => default-deny para INSERT/UPDATE/DELETE.

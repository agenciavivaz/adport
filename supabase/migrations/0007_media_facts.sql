-- =============================================================================
-- 0007 — Mídia: entidades e fatos diários (Fase 1.2/1.3)
-- PRD §13.4. IDs externos definem identidade (não nomes). Fatos diários são
-- snapshots substituíveis por UPSERT — nunca acumuláveis a cada sync (Gate G2).
-- Moeda/fuso preservados; micros convertidos UMA vez no adapter (§13.1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ad_campaigns / ad_groups / ads — hierarquia com FK composta ao provider_account.
-- -----------------------------------------------------------------------------
create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider_account_id uuid not null,
  external_id text not null,
  name text,
  objective text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_updated_at timestamptz,
  constraint fk_camp_pa foreign key (organization_id, client_id, provider_account_id)
    references public.provider_accounts(organization_id, client_id, id) on delete cascade,
  unique (organization_id, client_id, provider_account_id, external_id),
  constraint camp_scope_id_unique unique (organization_id, client_id, id)
);
create trigger trg_camp_updated before update on public.ad_campaigns
  for each row execute function app.set_updated_at();

create table public.ad_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  campaign_id uuid not null,
  external_id text not null,
  name text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_ag_camp foreign key (organization_id, client_id, campaign_id)
    references public.ad_campaigns(organization_id, client_id, id) on delete cascade,
  unique (organization_id, client_id, campaign_id, external_id),
  constraint ag_scope_id_unique unique (organization_id, client_id, id)
);
create trigger trg_ag_updated before update on public.ad_groups
  for each row execute function app.set_updated_at();

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  ad_group_id uuid not null,
  external_id text not null,
  name text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_ad_ag foreign key (organization_id, client_id, ad_group_id)
    references public.ad_groups(organization_id, client_id, id) on delete cascade,
  unique (organization_id, client_id, ad_group_id, external_id)
);
create trigger trg_ad_updated before update on public.ads
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- ad_entity_snapshots — não perder configuração histórica (renomeações/status).
-- -----------------------------------------------------------------------------
create table public.ad_entity_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  entity_type text not null check (entity_type in ('campaign','ad_group','ad')),
  entity_external_id text not null,
  attributes jsonb not null default '{}'::jsonb,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  constraint fk_snap_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade
);
create index idx_snap_entity on public.ad_entity_snapshots(organization_id, client_id, entity_type, entity_external_id);

-- -----------------------------------------------------------------------------
-- ad_daily_facts — grain canônico por linha. UPSERT idempotente (Gate G2).
-- Um grain por linha: 'campaign' | 'ad_group' | 'ad'. Não misturar somas.
-- Moeda ISO preservada; valores em unidades MAIORES já normalizados (micros
-- convertidos no adapter). numeric para dinheiro (§13.1).
-- -----------------------------------------------------------------------------
create table public.ad_daily_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider_account_id uuid not null,
  grain text not null check (grain in ('campaign','ad_group','ad')),
  entity_external_id text not null,
  date_local date not null,
  currency char(3) not null,
  metric_set text not null default 'default', -- ex.: 'default','video'
  spend numeric(20,6) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric(20,6) not null default 0,
  conversion_value numeric(20,6) not null default 0,
  attribution_snapshot jsonb not null default '{}'::jsonb, -- regras do provedor
  source_updated_at timestamptz,
  ingested_at timestamptz not null default now(),
  constraint fk_fact_pa foreign key (organization_id, client_id, provider_account_id)
    references public.provider_accounts(organization_id, client_id, id) on delete cascade,
  -- Chave de idempotência: reprocessar substitui, não acumula.
  constraint ad_daily_facts_uq unique
    (organization_id, client_id, provider_account_id, grain, entity_external_id, date_local, metric_set, currency)
);
create index idx_facts_query
  on public.ad_daily_facts(organization_id, client_id, provider_account_id, grain, date_local);

-- -----------------------------------------------------------------------------
-- ad_breakdown_facts — grain + breakdown explícito, separado dos totais (§10.4).
-- -----------------------------------------------------------------------------
create table public.ad_breakdown_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider_account_id uuid not null,
  grain text not null check (grain in ('campaign','ad_group','ad')),
  entity_external_id text not null,
  date_local date not null,
  breakdown_type text not null, -- 'age','gender','placement',...
  breakdown_value text not null,
  currency char(3) not null,
  spend numeric(20,6) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric(20,6) not null default 0,
  conversion_value numeric(20,6) not null default 0,
  ingested_at timestamptz not null default now(),
  constraint fk_bfact_pa foreign key (organization_id, client_id, provider_account_id)
    references public.provider_accounts(organization_id, client_id, id) on delete cascade,
  constraint ad_breakdown_facts_uq unique
    (organization_id, client_id, provider_account_id, grain, entity_external_id, date_local, breakdown_type, breakdown_value, currency)
);

-- -----------------------------------------------------------------------------
-- conversion_action_facts — ação selecionável; sem duplicar totais (§13.4).
-- -----------------------------------------------------------------------------
create table public.conversion_action_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider_account_id uuid not null,
  grain text not null check (grain in ('campaign','ad_group','ad')),
  entity_external_id text not null,
  date_local date not null,
  action_external_id text not null,
  action_type text,
  is_selected_lead boolean not null default false, -- seleção define "lead" (§8.2)
  count numeric(20,6) not null default 0,
  value numeric(20,6) not null default 0,
  currency char(3) not null,
  ingested_at timestamptz not null default now(),
  constraint fk_cafact_pa foreign key (organization_id, client_id, provider_account_id)
    references public.provider_accounts(organization_id, client_id, id) on delete cascade,
  constraint conversion_action_facts_uq unique
    (organization_id, client_id, provider_account_id, grain, entity_external_id, date_local, action_external_id, currency)
);

-- -----------------------------------------------------------------------------
-- conversion_action_defs — catálogo de ações; seleção do que é "lead" por cliente.
-- -----------------------------------------------------------------------------
create table public.conversion_action_defs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  provider_account_id uuid not null,
  action_external_id text not null,
  name text,
  action_type text,
  is_selected_lead boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_cadef_pa foreign key (organization_id, client_id, provider_account_id)
    references public.provider_accounts(organization_id, client_id, id) on delete cascade,
  unique (organization_id, client_id, provider_account_id, action_external_id)
);
create trigger trg_cadef_updated before update on public.conversion_action_defs
  for each row execute function app.set_updated_at();

-- =====================================================================
-- RLS — leitura por acesso ao cliente; escrita por serviço/admin.
-- Fatos são gravados por RPC de ingestão (SECURITY DEFINER) — default-deny p/ usuário.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'ad_campaigns','ad_groups','ads','ad_entity_snapshots','ad_daily_facts',
    'ad_breakdown_facts','conversion_action_facts','conversion_action_defs'
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

-- Seleção de "lead" (conversion action) é ação de admin/config.
create policy cadef_write_admin on public.conversion_action_defs
  for all to authenticated
  using (app.is_org_admin(organization_id)) with check (app.is_org_admin(organization_id));

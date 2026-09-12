-- =============================================================================
-- 0002 — Tabelas de plataforma (Fase 1.1)
-- PRD §13.2. organizations, memberships, clients, grants, invitations,
-- platform_admins, support sessions, plans, subscriptions, flags, audit, usage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations (agência = tenant)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'closing', 'closed')),
  default_timezone text not null default 'America/Sao_Paulo',
  branding jsonb not null default '{}'::jsonb, -- logo, cor, nome de exibição
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Necessário para FKs compostas de filhos (TEN-02).
  constraint organizations_id_unique unique (id)
);
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- organization_memberships (usuário em várias orgs, papéis distintos)
-- -----------------------------------------------------------------------------
create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in (
    'agency_owner', 'agency_admin', 'agency_manager', 'agency_analyst', 'client_viewer'
  )),
  status text not null default 'active' check (status in ('active', 'suspended', 'invited')),
  version integer not null default 1, -- revogação não depende só de token antigo (TEN-04)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index idx_memberships_user on public.organization_memberships(user_id);
create index idx_memberships_org on public.organization_memberships(organization_id);
create trigger trg_memberships_updated before update on public.organization_memberships
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- clients (negócio atendido dentro da agência)
-- -----------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  timezone text not null default 'America/Sao_Paulo',
  currency char(3) not null default 'BRL',
  business_model text not null default 'unknown'
    check (business_model in ('unknown', 'one_time', 'recurring', 'mixed')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  goals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Chave composta para FKs de filhos comerciais (TEN-02).
  constraint clients_org_id_unique unique (organization_id, id)
);
create index idx_clients_org on public.clients(organization_id);
create trigger trg_clients_updated before update on public.clients
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- client_access_grants (acesso explícito de membro a cliente + capacidades)
-- -----------------------------------------------------------------------------
create table public.client_access_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null,
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  -- Capacidades já validadas contra a matriz do papel (nunca livres do frontend).
  capabilities text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- TEN-02: cliente pertence à mesma organização.
  constraint fk_grant_client foreign key (organization_id, client_id)
    references public.clients(organization_id, id) on delete cascade,
  unique (client_id, membership_id),
  constraint capabilities_valid check (
    capabilities <@ array[
      'connections.manage','pii.read','exports.create','ads.propose','ads.approve','billing.manage'
    ]::text[]
  )
);
create index idx_grants_membership on public.client_access_grants(membership_id);
create index idx_grants_org_client on public.client_access_grants(organization_id, client_id);
create trigger trg_grants_updated before update on public.client_access_grants
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- invitations (token de uso único como digest, validade 7 dias) — TEN-07
-- -----------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (position('@' in email) > 1), -- normalizado (lower) na app
  role text not null check (role in (
    'agency_admin', 'agency_manager', 'agency_analyst', 'client_viewer'
  )),
  -- Grants a aplicar na aceitação (para papéis grant-scoped).
  client_ids uuid[] not null default '{}',
  capabilities text[] not null default '{}',
  token_digest text not null, -- digest do token; token bruto nunca persistido
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email, token_digest)
);
create index idx_invitations_org on public.invitations(organization_id);
create index idx_invitations_digest on public.invitations(token_digest);

-- -----------------------------------------------------------------------------
-- platform_admins (control plane) — escrita administrativa apenas
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'platform_super_admin'
    check (role in ('platform_super_admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- support_access_sessions (ADM-06/07): leitura temporária aprovada pelo owner
-- -----------------------------------------------------------------------------
create table public.support_access_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_ids uuid[] not null default '{}',
  approved_by uuid not null references auth.users(id), -- owner/admin da agência
  reason text not null check (length(reason) between 3 and 1000),
  can_read_pii boolean not null default false, -- concessão excepcional, auditada
  can_export boolean not null default false,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  ended_at timestamptz,
  constraint support_max_60min check (expires_at <= started_at + interval '60 minutes')
);
create index idx_support_admin on public.support_access_sessions(admin_user_id);
create index idx_support_org on public.support_access_sessions(organization_id);

-- -----------------------------------------------------------------------------
-- plans / plan_versions (catálogo versionado) — BILL-07
-- -----------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('trial', 'agency', 'growth', 'custom')),
  name text not null,
  created_at timestamptz not null default now(),
  constraint plans_id_unique unique (id)
);

create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  version integer not null,
  -- Preço referencial; moeda; publicado só após decisão do proprietário.
  price_cents integer, -- null enquanto não publicado
  currency char(3) not null default 'BRL',
  limits jsonb not null, -- activeClients, adAccounts, internalUsers, aiRunsPerMonth, ...
  features jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, version)
);

-- -----------------------------------------------------------------------------
-- saas_subscriptions (assinatura da PLATAFORMA — nunca receita do cliente) ADM-08
-- -----------------------------------------------------------------------------
create table public.saas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  billing_provider text not null default 'stripe',
  external_id text, -- id no provedor de pagamento
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'suspended')),
  plan_version_id uuid not null references public.plan_versions(id),
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_provider, external_id)
);
create trigger trg_subscriptions_updated before update on public.saas_subscriptions
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- billing_events (idempotência de webhook) — BILL-03
-- -----------------------------------------------------------------------------
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  billing_provider text not null,
  external_event_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb, -- payload mínimo
  processed_at timestamptz,
  reconciled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (billing_provider, external_event_id)
);

-- -----------------------------------------------------------------------------
-- usage_ledger (reserva atômica de quota + custo) — BILL-04, §12.4
-- -----------------------------------------------------------------------------
create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource text not null, -- 'ai_run', 'ai_tokens', ...
  unit text not null,     -- 'run', 'token', 'cents'
  idempotency_key text not null,
  quantity numeric not null default 0,
  cost_cents integer not null default 0,
  -- reservado antes da chamada; acertado após resultado (§12.4)
  state text not null default 'reserved' check (state in ('reserved', 'settled', 'released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, resource, idempotency_key)
);
create index idx_usage_org_resource on public.usage_ledger(organization_id, resource, created_at);
create trigger trg_usage_updated before update on public.usage_ledger
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- feature_flags / organization_overrides (ADM-03)
-- -----------------------------------------------------------------------------
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  default_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.organization_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  flag_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  reason text not null, -- overrides exigem motivo (ADM-03)
  expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, flag_key)
);

-- -----------------------------------------------------------------------------
-- audit_events (append-only aplicacional) — §16.1
-- -----------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid, -- null para eventos de plataforma
  client_id uuid,
  actor_user_id uuid,   -- ator real; nunca impersonação (ADM-07)
  actor_kind text not null default 'user'
    check (actor_kind in ('user', 'platform_admin', 'system', 'support')),
  action text not null,
  target_type text,
  target_id text,
  result text not null default 'ok' check (result in ('ok', 'denied', 'error')),
  request_id text,
  metadata jsonb not null default '{}'::jsonb, -- redigido; sem PII/segredos
  created_at timestamptz not null default now()
);
create index idx_audit_org on public.audit_events(organization_id, created_at);
create index idx_audit_actor on public.audit_events(actor_user_id, created_at);

-- Impedir UPDATE/DELETE no domínio da aplicação (append-only) — §16.1.
-- (Não promete imutabilidade contra admin do banco; restringir essas credenciais.)
create or replace function app.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events é append-only (imutabilidade aplicacional)';
end;
$$;
create trigger trg_audit_no_update before update on public.audit_events
  for each row execute function app.forbid_mutation();
create trigger trg_audit_no_delete before delete on public.audit_events
  for each row execute function app.forbid_mutation();

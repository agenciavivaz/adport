-- =============================================================================
-- seed.sql — Fixtures EXCLUSIVAMENTE SINTÉTICAS (PRD §18.1, Fase 0)
-- 2 agências, 2 clientes por agência, usuários de papéis variados. Nenhum dado
-- real/PII. UUIDs fixos apenas para desenvolvimento/testes locais.
-- =============================================================================

-- ---- Catálogo de planos ------------------------------------------------------
insert into public.plans (id, key, name) values
  ('00000000-0000-0000-0000-000000000001', 'trial',  'Trial'),
  ('00000000-0000-0000-0000-000000000002', 'agency', 'Agency'),
  ('00000000-0000-0000-0000-000000000003', 'growth', 'Growth'),
  ('00000000-0000-0000-0000-000000000004', 'custom', 'Custom')
on conflict (key) do nothing;

insert into public.plan_versions (id, plan_id, version, price_cents, currency, limits, features) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 1, null, 'BRL',
   '{"activeClients":2,"adAccounts":4,"internalUsers":3,"aiRunsPerMonth":100,"portalUsers":5,"aiMonthlyBudgetCents":5000}',
   '{"stage2":false,"externalMutations":false,"branding":false,"portal":false}'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 1, null, 'BRL',
   '{"activeClients":10,"adAccounts":20,"internalUsers":10,"aiRunsPerMonth":1000,"portalUsers":20,"aiMonthlyBudgetCents":50000}',
   '{"stage2":false,"externalMutations":false,"branding":true,"portal":true}'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000003', 1, null, 'BRL',
   '{"activeClients":30,"adAccounts":60,"internalUsers":30,"aiRunsPerMonth":3000,"portalUsers":60,"aiMonthlyBudgetCents":150000}',
   '{"stage2":true,"externalMutations":false,"branding":true,"portal":true}')
on conflict (plan_id, version) do nothing;

-- ---- Usuários sintéticos (auth) ---------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','owner-a@example.test', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a2','authenticated','authenticated','analyst-a@example.test', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000b1','authenticated','authenticated','owner-b@example.test', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000b2','authenticated','authenticated','analyst-b@example.test', now(), now(), now())
on conflict (id) do nothing;

-- ---- Agência A ---------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('0000000a-0000-0000-0000-000000000000', 'Agência A', 'agencia-a')
on conflict (id) do nothing;

insert into public.clients (id, organization_id, name, currency) values
  ('0000000a-0000-0000-0000-0000000000c1', '0000000a-0000-0000-0000-000000000000', 'Cliente A1', 'BRL'),
  ('0000000a-0000-0000-0000-0000000000c2', '0000000a-0000-0000-0000-000000000000', 'Cliente A2', 'USD')
on conflict (id) do nothing;

insert into public.organization_memberships (id, organization_id, user_id, role, status) values
  ('0000000a-0000-0000-0000-0000000000d1', '0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'agency_owner',   'active'),
  ('0000000a-0000-0000-0000-0000000000d2', '0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'agency_analyst', 'active')
on conflict (organization_id, user_id) do nothing;

-- Analista A tem grant SOMENTE ao Cliente A1 (para provar T02).
insert into public.client_access_grants (organization_id, client_id, membership_id, capabilities) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0000-0000000000c1', '0000000a-0000-0000-0000-0000000000d2', '{"exports.create"}')
on conflict (client_id, membership_id) do nothing;

insert into public.saas_subscriptions (organization_id, plan_version_id, status) values
  ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000012', 'active')
on conflict (organization_id) do nothing;

-- ---- Agência B ---------------------------------------------------------------
insert into public.organizations (id, name, slug) values
  ('0000000b-0000-0000-0000-000000000000', 'Agência B', 'agencia-b')
on conflict (id) do nothing;

insert into public.clients (id, organization_id, name, currency) values
  ('0000000b-0000-0000-0000-0000000000c1', '0000000b-0000-0000-0000-000000000000', 'Cliente B1', 'BRL'),
  ('0000000b-0000-0000-0000-0000000000c2', '0000000b-0000-0000-0000-000000000000', 'Cliente B2', 'BRL')
on conflict (id) do nothing;

insert into public.organization_memberships (id, organization_id, user_id, role, status) values
  ('0000000b-0000-0000-0000-0000000000d1', '0000000b-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b1', 'agency_owner',   'active'),
  ('0000000b-0000-0000-0000-0000000000d2', '0000000b-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b2', 'agency_analyst', 'active')
on conflict (organization_id, user_id) do nothing;

insert into public.saas_subscriptions (organization_id, plan_version_id, status, trial_ends_at) values
  ('0000000b-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011', 'trialing', now() + interval '14 days')
on conflict (organization_id) do nothing;

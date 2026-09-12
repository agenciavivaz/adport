-- =============================================================================
-- Testes de isolamento (Gate G1) — PRD §20 T01, T02.
-- Executar com: supabase test db  (requer seed aplicado).
-- Exercita as políticas RLS assumindo o papel `authenticated` e injetando o
-- claim `sub` (auth.uid) de cada usuário sintético.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
select plan(8);

-- IDs sintéticos do seed.
-- Agência A: owner a1, analista a2 (grant só ao Cliente A1 = ...c1; A2 = ...c2)
-- Agência B: owner b1

-- Helper para simular um usuário autenticado dentro do teste.
create or replace function tests.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
end; $$;

-- ---------------------------------------------------------------------------
-- T02: analista A (grant só ao Cliente A1) — vê A1, NÃO vê A2 (mesma agência)
-- ---------------------------------------------------------------------------
select tests.act_as('00000000-0000-0000-0000-0000000000a2');

select is(
  (select count(*)::int from public.clients where id = '0000000a-0000-0000-0000-0000000000c1'),
  1, 'T02: analista A vê o Cliente A1 concedido'
);

select is(
  (select count(*)::int from public.clients where id = '0000000a-0000-0000-0000-0000000000c2'),
  0, 'T02: analista A NÃO vê o Cliente A2 (sem grant, mesma agência)'
);

-- ---------------------------------------------------------------------------
-- T01: analista A NÃO vê nada da Agência B
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.clients where organization_id = '0000000b-0000-0000-0000-000000000000'),
  0, 'T01: analista A não vê clientes da Agência B'
);

select is(
  (select count(*)::int from public.organizations where id = '0000000b-0000-0000-0000-000000000000'),
  0, 'T01: analista A não vê a organização B'
);

-- ---------------------------------------------------------------------------
-- Owner A vê os dois clientes da própria agência, e não vê a org B
-- ---------------------------------------------------------------------------
select tests.act_as('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*)::int from public.clients where organization_id = '0000000a-0000-0000-0000-000000000000'),
  2, 'owner A vê os 2 clientes da Agência A'
);

select is(
  (select count(*)::int from public.organizations where id = '0000000b-0000-0000-0000-000000000000'),
  0, 'owner A não vê a organização B'
);

-- ---------------------------------------------------------------------------
-- Owner B vê a própria org e não vê clientes da A
-- ---------------------------------------------------------------------------
select tests.act_as('00000000-0000-0000-0000-0000000000b1');

select is(
  (select count(*)::int from public.organizations where id = '0000000b-0000-0000-0000-000000000000'),
  1, 'owner B vê a própria organização'
);

select is(
  (select count(*)::int from public.clients where organization_id = '0000000a-0000-0000-0000-000000000000'),
  0, 'owner B não vê clientes da Agência A'
);

select * from finish();
rollback;

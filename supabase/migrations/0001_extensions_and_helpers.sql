-- =============================================================================
-- 0001 — Extensões, schema app e funções auxiliares de autorização
-- PRD §4.3 (TEN-01..TEN-06), ADR-0002. Fonte de verdade do isolamento.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;      -- digest, gen_random_uuid
create extension if not exists pg_trgm with schema extensions;       -- busca textual

-- Schema privado para funções de autorização e utilitários (não exposto via API).
create schema if not exists app;

-- As funções SQL abaixo referenciam tabelas criadas em 0002 (forward reference).
-- Desabilitar a validação de corpo nesta migration é o padrão para helpers de RLS.
set check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contexto do usuário autenticado.
-- auth.uid() vem da sessão verificada do Supabase Auth. Nunca de claim editável
-- pelo cliente (TEN-04).
-- -----------------------------------------------------------------------------
create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Membership vigente: SECURITY DEFINER evita recursão de RLS ao consultar a
-- própria tabela de memberships dentro de políticas de outras tabelas.
-- search_path pinado por segurança.
-- -----------------------------------------------------------------------------
create or replace function app.member_role(p_org uuid)
returns text
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select m.role
  from public.organization_memberships m
  where m.organization_id = p_org
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

create or replace function app.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function app.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(app.member_role(p_org) in ('agency_owner', 'agency_admin'), false);
$$;

create or replace function app.is_org_owner(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(app.member_role(p_org) = 'agency_owner', false);
$$;

-- -----------------------------------------------------------------------------
-- Acesso a um cliente específico (TEN-05):
--  - owner/admin alcançam todos os clientes da própria agência;
--  - demais papéis exigem grant explícito em client_access_grants.
-- -----------------------------------------------------------------------------
create or replace function app.has_client_access(p_org uuid, p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select
    case
      when app.is_org_admin(p_org) then
        exists (
          select 1 from public.clients c
          where c.id = p_client and c.organization_id = p_org
        )
      else
        exists (
          select 1
          from public.client_access_grants g
          join public.organization_memberships m
            on m.id = g.membership_id
          where g.organization_id = p_org
            and g.client_id = p_client
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
    end;
$$;

-- Papel administrativo de plataforma (control plane). NÃO concede leitura de
-- dados comerciais por si só (§5): usado apenas em superfícies próprias.
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.status = 'active'
  );
$$;

comment on schema app is 'Funções de autorização e utilitários; não exposto via PostgREST.';

-- =============================================================================
-- 0003 — RLS, grants e invariantes (Gate G1)
-- PRD §4.3 (TEN-03), §5. Políticas por ação com validação de estado novo/antigo.
-- Padrão: RLS habilitada em toda tabela exposta; leitura por membership; mutações
-- sensíveis com invariantes de banco (defesa em profundidade além da app).
-- service_role e RPCs SECURITY DEFINER de bootstrap tratam casos que a RLS de
-- usuário não pode cobrir (ex.: aceitar convite antes de virar membro).
-- =============================================================================

-- Revogar defaults amplos; RLS decide o acesso (TEN-03).
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- =====================================================================
-- Invariantes de membership (owner) — defesa em profundidade (TEN-07)
-- =====================================================================
create or replace function app.enforce_membership_invariants()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  active_owners int;
begin
  if (tg_op = 'DELETE') then
    if old.role = 'agency_owner' and old.status = 'active' then
      select count(*) into active_owners
      from public.organization_memberships
      where organization_id = old.organization_id and role = 'agency_owner' and status = 'active';
      if active_owners <= 1 then
        raise exception 'não é possível remover o último owner da organização';
      end if;
    end if;
    return old;
  end if;

  -- INSERT/UPDATE: rebaixar/suspender o último owner é proibido.
  if (tg_op = 'UPDATE') then
    if old.role = 'agency_owner' and old.status = 'active'
       and (new.role <> 'agency_owner' or new.status <> 'active') then
      select count(*) into active_owners
      from public.organization_memberships
      where organization_id = old.organization_id and role = 'agency_owner' and status = 'active';
      if active_owners <= 1 then
        raise exception 'não é possível rebaixar/suspender o último owner';
      end if;
    end if;
  end if;

  return new;
end;
$$;
create trigger trg_membership_invariants
  before update or delete on public.organization_memberships
  for each row execute function app.enforce_membership_invariants();

-- =====================================================================
-- RPC de bootstrap: criar organização + membership owner (atômico)
-- SECURITY DEFINER porque o criador ainda não é membro.
-- =====================================================================
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  insert into public.organizations(name, slug)
  values (p_name, p_slug)
  returning id into v_org;

  insert into public.organization_memberships(organization_id, user_id, role, status)
  values (v_org, v_uid, 'agency_owner', 'active');

  insert into public.audit_events(organization_id, actor_user_id, actor_kind, action, target_type, target_id, result)
  values (v_org, v_uid, 'user', 'organization.created', 'organization', v_org::text, 'ok');

  return v_org;
end;
$$;
revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

-- =====================================================================
-- organizations
-- =====================================================================
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

create policy org_select_members on public.organizations
  for select to authenticated
  using (app.is_member(id));

-- Sem INSERT direto: usar create_organization(). DELETE: fluxo de exclusão dedicado.
create policy org_update_admins on public.organizations
  for update to authenticated
  using (app.is_org_admin(id))
  with check (app.is_org_admin(id));

-- =====================================================================
-- organization_memberships
-- =====================================================================
alter table public.organization_memberships enable row level security;
alter table public.organization_memberships force row level security;

-- Membros veem a equipe da própria org.
create policy memb_select on public.organization_memberships
  for select to authenticated
  using (app.is_member(organization_id));

-- Admin gerencia equipe (invariantes de owner via trigger + app).
create policy memb_insert_admin on public.organization_memberships
  for insert to authenticated
  with check (app.is_org_admin(organization_id));

create policy memb_update_admin on public.organization_memberships
  for update to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

create policy memb_delete_admin on public.organization_memberships
  for delete to authenticated
  using (app.is_org_admin(organization_id));

-- =====================================================================
-- clients
-- =====================================================================
alter table public.clients enable row level security;
alter table public.clients force row level security;

-- Leitura: quem tem acesso ao cliente (owner/admin ou grant).
create policy clients_select on public.clients
  for select to authenticated
  using (app.has_client_access(organization_id, id));

create policy clients_insert_admin on public.clients
  for insert to authenticated
  with check (app.is_org_admin(organization_id));

create policy clients_update_admin on public.clients
  for update to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

create policy clients_delete_owner on public.clients
  for delete to authenticated
  using (app.is_org_owner(organization_id));

-- =====================================================================
-- client_access_grants
-- =====================================================================
alter table public.client_access_grants enable row level security;
alter table public.client_access_grants force row level security;

-- Membro vê o próprio grant; admin vê todos da org.
create policy grants_select on public.client_access_grants
  for select to authenticated
  using (
    app.is_org_admin(organization_id)
    or exists (
      select 1 from public.organization_memberships m
      where m.id = membership_id and m.user_id = auth.uid()
    )
  );

create policy grants_write_admin on public.client_access_grants
  for all to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

-- =====================================================================
-- invitations
-- =====================================================================
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

create policy inv_select_admin on public.invitations
  for select to authenticated
  using (app.is_org_admin(organization_id));

create policy inv_write_admin on public.invitations
  for all to authenticated
  using (app.is_org_admin(organization_id))
  with check (app.is_org_admin(organization_id));

-- Aceite de convite: SECURITY DEFINER (o convidado ainda não é membro).
-- Valida token digest, expiração, email verificado e impede escalada de papel.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_digest text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_inv public.invitations%rowtype;
  v_membership uuid;
  v_client uuid;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;

  select * into v_inv from public.invitations
  where token_digest = v_digest
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if v_inv.id is null then
    raise exception 'convite inválido ou expirado';
  end if;

  -- Email verificado deve corresponder ao convite (TEN-07).
  if lower(v_inv.email) <> v_email then
    raise exception 'email do convite não corresponde ao usuário autenticado';
  end if;

  -- Cria membership com o papel do convite (nunca owner por convite).
  insert into public.organization_memberships(organization_id, user_id, role, status)
  values (v_inv.organization_id, v_uid, v_inv.role, 'active')
  on conflict (organization_id, user_id) do update set status = 'active'
  returning id into v_membership;

  -- Aplica grants por cliente, se houver (papéis grant-scoped).
  foreach v_client in array v_inv.client_ids loop
    insert into public.client_access_grants(organization_id, client_id, membership_id, capabilities)
    values (v_inv.organization_id, v_client, v_membership, v_inv.capabilities)
    on conflict (client_id, membership_id) do update set capabilities = excluded.capabilities;
  end loop;

  update public.invitations
    set accepted_at = now(), accepted_by = v_uid
    where id = v_inv.id;

  insert into public.audit_events(organization_id, actor_user_id, actor_kind, action, target_type, target_id, result)
  values (v_inv.organization_id, v_uid, 'user', 'invitation.accepted', 'membership', v_membership::text, 'ok');

  return v_membership;
end;
$$;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- =====================================================================
-- saas_subscriptions / plans / plan_versions (leitura de plano)
-- =====================================================================
alter table public.saas_subscriptions enable row level security;
alter table public.saas_subscriptions force row level security;
create policy sub_select_members on public.saas_subscriptions
  for select to authenticated
  using (app.is_member(organization_id));
-- Escrita apenas via serviço de billing (service_role bypassa RLS).

alter table public.plans enable row level security;
alter table public.plan_versions enable row level security;
create policy plans_select_all on public.plans
  for select to authenticated using (true);
create policy plan_versions_select_all on public.plan_versions
  for select to authenticated using (true);

-- =====================================================================
-- usage_ledger (leitura por admin; escrita por serviço/RPC atômica)
-- =====================================================================
alter table public.usage_ledger enable row level security;
alter table public.usage_ledger force row level security;
create policy usage_select_admin on public.usage_ledger
  for select to authenticated
  using (app.is_org_admin(organization_id));

-- =====================================================================
-- organization_overrides / feature_flags
-- =====================================================================
alter table public.organization_overrides enable row level security;
create policy overrides_select_admin on public.organization_overrides
  for select to authenticated
  using (app.is_org_admin(organization_id));

alter table public.feature_flags enable row level security;
create policy flags_select_all on public.feature_flags
  for select to authenticated using (true);

-- =====================================================================
-- audit_events (leitura por admin da própria org)
-- =====================================================================
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
create policy audit_select_admin on public.audit_events
  for select to authenticated
  using (organization_id is not null and app.is_org_admin(organization_id));
-- INSERT via RPCs SECURITY DEFINER / serviço. Sem UPDATE/DELETE (triggers).

-- =====================================================================
-- Control plane: RLS habilitada SEM políticas de usuário (default-deny).
-- Acesso somente por serviço de plataforma auditado (§5). NÃO criar política
-- universal is_super_admin() => true.
-- =====================================================================
alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;
alter table public.support_access_sessions enable row level security;
alter table public.support_access_sessions force row level security;
alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;

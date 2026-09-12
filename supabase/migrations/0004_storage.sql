-- =============================================================================
-- 0004 — Storage privado (TEN-08, §16.1)
-- Buckets privados; caminho começa por {organization_id}/... e acesso é validado
-- por membership. Downloads reais devem usar signed URLs curtos gerados após
-- autorização no servidor; estas policies são a defesa de dados subjacente.
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('imports', 'imports', false),
  ('exports', 'exports', false),
  ('reports', 'reports', false),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Helper: primeira pasta do caminho como uuid da organização.
create or replace function app.storage_org(name text)
returns uuid
language sql
immutable
as $$
  select nullif((string_to_array(name, '/'))[1], '')::uuid;
$$;

-- Leitura: membro da org dona do objeto.
create policy storage_read_members on storage.objects
  for select to authenticated
  using (
    bucket_id in ('imports', 'exports', 'reports', 'attachments')
    and app.is_member(app.storage_org(name))
  );

-- Escrita: admin da org (imports/attachments/reports). Exports são gerados por
-- serviço; admins podem subir imports/anexos.
create policy storage_write_admins on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('imports', 'attachments')
    and app.is_org_admin(app.storage_org(name))
  );

create policy storage_delete_admins on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('imports', 'attachments', 'exports', 'reports')
    and app.is_org_admin(app.storage_org(name))
  );

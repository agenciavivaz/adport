import { resolveAccess } from '@/lib/auth/context';
import { ok, fail, notFound } from '@/lib/api/respond';

/** Lista membros da organização (RLS: visível a membros). */
export async function GET(_req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) return notFound();

  const { data, error } = await access.supabase
    .from('organization_memberships')
    .select('id, user_id, role, status, created_at')
    .eq('organization_id', access.organization.id)
    .order('created_at');
  if (error) return fail(500, 'db_error', 'Falha ao listar equipe.');
  return ok(data ?? []);
}

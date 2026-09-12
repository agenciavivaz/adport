import { z } from 'zod';
import { hasCapability } from '@ai/domain';
import { resolveClientAccess } from '@/lib/auth/context';
import { ok, fail, notFound, forbidden } from '@/lib/api/respond';

const schema = z.object({
  connection_id: z.string().uuid(),
  partition: z.string().max(40).optional(),
});

/** Dispara sync incremental (sujeito a cooldown de 15 min na RPC) — ADS-04. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ org: string; client: string }> },
) {
  const { org, client } = await params;
  const access = await resolveClientAccess(org, client);
  if (!access) return notFound();
  if (!hasCapability(access.ctx, 'connections.manage', client)) {
    return forbidden('connections_manage_required');
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return fail(422, 'validation_error', 'connection_id inválido.');

  const { data, error } = await access.supabase.rpc('enqueue_sync_job', {
    p_connection: parsed.data.connection_id,
    p_job_type: 'sync_facts',
    p_entity: 'campaign',
    p_partition: parsed.data.partition ?? null,
    p_payload: {},
  });
  if (error) {
    if (error.message.includes('cooldown_active')) {
      return fail(429, 'cooldown_active', 'Aguarde o cooldown de 15 minutos entre sincronizações.');
    }
    return fail(500, 'enqueue_failed', 'Falha ao enfileirar sincronização.');
  }
  return ok({ job_id: data, queued: data !== null });
}

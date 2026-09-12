import { z } from 'zod';
import { canPerformAdminAction } from '@ai/domain';
import { checkQuota } from '@ai/domain';
import { resolveAccess } from '@/lib/auth/context';
import { ok, created, fail, notFound, forbidden } from '@/lib/api/respond';
import { audit } from '@/lib/audit';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  timezone: z.string().min(1).max(64).default('America/Sao_Paulo'),
  currency: z
    .string()
    .length(3)
    .transform((s) => s.toUpperCase())
    .default('BRL'),
  business_model: z.enum(['unknown', 'one_time', 'recurring', 'mixed']).default('unknown'),
});

export async function GET(_req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) return notFound(); // não revela existência (§14.1)

  const { data, error } = await access.supabase
    .from('clients')
    .select('id, name, timezone, currency, business_model, status, created_at')
    .eq('organization_id', access.organization.id)
    .order('name');
  if (error) return fail(500, 'db_error', 'Falha ao listar clientes.');
  return ok(data ?? []);
}

export async function POST(request: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) return notFound();

  if (!canPerformAdminAction(access.ctx, 'client.create')) {
    return forbidden('client_create_not_allowed');
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return fail(422, 'validation_error', 'Dados inválidos.', parsed.error.flatten());
  }

  // Entitlement: limite de clientes ativos do plano (BILL-04). Contagem sob RLS.
  const { count } = await access.supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', access.organization.id)
    .eq('status', 'active');
  const limit = await activeClientLimit(access);
  const quota = checkQuota(count ?? 0, limit, 'active_clients');
  if (!quota.allowed) {
    return fail(402, quota.reason ?? 'quota_exceeded', 'Limite de clientes do plano atingido.');
  }

  const { data, error } = await access.supabase
    .from('clients')
    .insert({
      organization_id: access.organization.id,
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
      business_model: parsed.data.business_model,
    })
    .select('id, name, currency, status')
    .single();
  if (error) return fail(500, 'db_error', 'Falha ao criar cliente.');

  await audit(access.supabase, {
    organizationId: access.organization.id,
    clientId: data.id,
    action: 'client.created',
    targetType: 'client',
    targetId: data.id,
  });
  return created(data);
}

async function activeClientLimit(
  access: NonNullable<Awaited<ReturnType<typeof resolveAccess>>>,
): Promise<number | null> {
  const { data } = await access.supabase
    .from('saas_subscriptions')
    .select('plan_version:plan_version_id(limits)')
    .eq('organization_id', access.organization.id)
    .limit(1)
    .single();
  const limits = (data as { plan_version?: { limits?: Record<string, unknown> } } | null)
    ?.plan_version?.limits;
  const v = limits?.['activeClients'];
  return typeof v === 'number' ? v : null;
}

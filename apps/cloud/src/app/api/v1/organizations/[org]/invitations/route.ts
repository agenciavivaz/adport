import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { canPerformAdminAction } from '@ai/domain';
import { clampCapabilitiesToRole, type AgencyRole } from '@ai/shared';
import { resolveAccess } from '@/lib/auth/context';
import { ok, created, fail, notFound, forbidden } from '@/lib/api/respond';
import { audit } from '@/lib/audit';

const inviteSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  role: z.enum(['agency_admin', 'agency_manager', 'agency_analyst', 'client_viewer']),
  client_ids: z.array(z.string().uuid()).default([]),
  capabilities: z.array(z.string()).default([]),
});

export async function GET(_req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) return notFound();
  if (!canPerformAdminAction(access.ctx, 'team.invite')) return forbidden();

  const { data, error } = await access.supabase
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, revoked_at, created_at')
    .eq('organization_id', access.organization.id)
    .order('created_at', { ascending: false });
  if (error) return fail(500, 'db_error', 'Falha ao listar convites.');
  return ok(data ?? []);
}

export async function POST(request: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) return notFound();
  if (!canPerformAdminAction(access.ctx, 'team.invite')) return forbidden('invite_not_allowed');

  const json = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(json);
  if (!parsed.success) {
    return fail(422, 'validation_error', 'Dados inválidos.', parsed.error.flatten());
  }

  // Capacidades nunca livres do frontend: clampar à matriz do papel (§4.2).
  const capabilities = clampCapabilitiesToRole(parsed.data.role as AgencyRole, parsed.data.capabilities);

  // Token de uso único: armazenar apenas o digest (TEN-07). Token bruto retornado
  // uma única vez para o admin compartilhar o link.
  const token = randomBytes(32).toString('base64url');
  const tokenDigest = createHash('sha256').update(token).digest('hex');

  const { data, error } = await access.supabase
    .from('invitations')
    .insert({
      organization_id: access.organization.id,
      email: parsed.data.email,
      role: parsed.data.role,
      client_ids: parsed.data.client_ids,
      capabilities,
      token_digest: tokenDigest,
      invited_by: access.user.id,
    })
    .select('id, email, role, expires_at')
    .single();
  if (error) return fail(500, 'db_error', 'Falha ao criar convite.');

  await audit(access.supabase, {
    organizationId: access.organization.id,
    action: 'invitation.created',
    targetType: 'invitation',
    targetId: data.id,
    metadata: { role: parsed.data.role }, // sem email em claro no log
  });

  // O envio de email depende de provedor configurado (flag desligada): retornamos
  // o link para o admin compartilhar manualmente enquanto o email não está ativo.
  return created({
    invitation: data,
    accept_url: `/invite/${token}`,
    email_delivery: 'manual_until_email_provider_configured',
  });
}

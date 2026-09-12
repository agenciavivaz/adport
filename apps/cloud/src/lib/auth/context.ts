/**
 * Resolução do contexto de acesso no servidor — ADR-0002 (TEN-05).
 * Deriva SEMPRE da sessão verificada + membership + grants (consultas sob RLS).
 * IDs de URL são apenas seletores.
 */
import {
  buildAccessContext,
  type AccessContext,
  type ClientGrant,
  type Membership,
} from '@ai/domain';
import type { AgencyRole, Capability } from '@ai/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface ResolvedAccess {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: User;
  organization: { id: string; slug: string; name: string; branding: Record<string, unknown> };
  subscriptionStatus: Membership['status'] extends never ? never : string;
  ctx: AccessContext;
}

/** Retorna null quando não há sessão. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Resolve o acesso para uma organização (por slug ou id). Retorna null quando o
 * usuário não tem membership ativo — o chamador responde 404 sem revelar
 * existência (§14.1).
 */
export async function resolveAccess(orgSelector: string): Promise<ResolvedAccess | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Seleciona a org (RLS já limita a orgs onde o usuário é membro).
  const looksUuid = /^[0-9a-f-]{36}$/i.test(orgSelector);
  const orgQuery = supabase
    .from('organizations')
    .select('id, slug, name, branding')
    .limit(1);
  const { data: orgRows } = looksUuid
    ? await orgQuery.eq('id', orgSelector)
    : await orgQuery.eq('slug', orgSelector);

  const organization = orgRows?.[0] as
    | { id: string; slug: string; name: string; branding: Record<string, unknown> }
    | undefined;
  if (!organization) return null;

  // Membership do usuário nesta org.
  const { data: membRows } = await supabase
    .from('organization_memberships')
    .select('organization_id, user_id, role, status')
    .eq('organization_id', organization.id)
    .eq('user_id', user.id)
    .limit(1);
  const membRow = membRows?.[0] as
    | { organization_id: string; user_id: string; role: AgencyRole; status: string }
    | undefined;
  if (!membRow) return null;

  const membership: Membership = {
    organizationId: membRow.organization_id,
    userId: membRow.user_id,
    role: membRow.role,
    status: membRow.status as Membership['status'],
  };

  // Clientes acessíveis (RLS: owner/admin => todos; demais => concedidos).
  const { data: clientRows } = await supabase
    .from('clients')
    .select('id, status')
    .eq('organization_id', organization.id);
  const allActiveClientIds = ((clientRows as { id: string; status: string }[] | null) ?? [])
    .filter((c) => c.status === 'active')
    .map((c) => c.id);

  // Meus grants nesta org.
  const { data: grantRows } = await supabase
    .from('client_access_grants')
    .select('organization_id, client_id, capabilities, membership_id')
    .eq('organization_id', organization.id);
  const myGrants: ClientGrant[] = ((grantRows as
    | { organization_id: string; client_id: string; capabilities: string[] }[]
    | null) ?? []).map((g) => ({
    organizationId: g.organization_id,
    clientId: g.client_id,
    capabilities: (g.capabilities ?? []) as Capability[],
  }));

  // Estado da assinatura (para TEN-10 / entitlements).
  const { data: subRows } = await supabase
    .from('saas_subscriptions')
    .select('status')
    .eq('organization_id', organization.id)
    .limit(1);
  const subscriptionStatus = ((subRows as { status: string }[] | null)?.[0]?.status ??
    'none') as ResolvedAccess['subscriptionStatus'];

  const ctx = buildAccessContext({
    userId: user.id,
    organizationId: organization.id,
    membership,
    grants: myGrants,
    allActiveClientIds,
    organizationState: {
      organizationId: organization.id,
      subscriptionStatus: subscriptionStatus as
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'canceled'
        | 'suspended'
        | 'none',
    },
  });
  if (!ctx) return null;

  return { supabase, user, organization, subscriptionStatus, ctx };
}

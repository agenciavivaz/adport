/**
 * Contexto de acesso normalizado no servidor — PRD §4.3 (TEN-05), ADR-0002.
 *
 * IDs de URL são seletores, não autorização. Este contexto é derivado SEMPRE da
 * sessão verificada + membership vigente + grants, nunca de claims editáveis.
 */
import {
  ALL_CLIENTS_ROLES,
  ROLE_MAX_CAPABILITIES,
  type AgencyRole,
  type Capability,
} from '@ai/shared';

export interface Membership {
  organizationId: string;
  userId: string;
  role: AgencyRole;
  status: 'active' | 'suspended' | 'invited';
}

export interface ClientGrant {
  organizationId: string;
  clientId: string;
  /** Capacidades concedidas neste cliente (já validadas contra a matriz do papel). */
  capabilities: Capability[];
}

export interface OrganizationState {
  organizationId: string;
  /** Estado da assinatura afeta ingestão/mutações (TEN-10). */
  subscriptionStatus:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'suspended'
    | 'none';
}

export interface AccessContext {
  userId: string;
  organizationId: string;
  role: AgencyRole;
  /** Clientes efetivamente acessíveis pelo usuário nesta organização. */
  clientIds: Set<string>;
  /** Capacidades globais na org (owner/admin) por papel. */
  orgCapabilities: Set<Capability>;
  /** Capacidades por cliente (grants), quando aplicável. */
  clientCapabilities: Map<string, Set<Capability>>;
  organizationSuspended: boolean;
}

export interface BuildAccessContextInput {
  userId: string;
  organizationId: string;
  membership: Membership | null;
  grants: ClientGrant[];
  /** Todos os IDs de cliente ativos da organização (para papéis all-clients). */
  allActiveClientIds: string[];
  organizationState: OrganizationState;
}

/**
 * Normaliza o contexto de acesso. Retorna `null` quando não há membership ativo
 * na organização — o chamador deve responder 404/negado sem revelar existência.
 */
export function buildAccessContext(input: BuildAccessContextInput): AccessContext | null {
  const { membership } = input;
  if (!membership || membership.status !== 'active') return null;
  if (membership.organizationId !== input.organizationId) return null;
  if (membership.userId !== input.userId) return null;

  const role = membership.role;
  const orgCapabilities = new Set<Capability>();
  const clientCapabilities = new Map<string, Set<Capability>>();
  const clientIds = new Set<string>();

  if (ALL_CLIENTS_ROLES.includes(role)) {
    // owner/admin: todos os clientes ativos da agência, capacidades pelo papel.
    for (const c of input.allActiveClientIds) clientIds.add(c);
    for (const cap of ROLE_MAX_CAPABILITIES[role]) orgCapabilities.add(cap);
  } else {
    // manager/analyst/client_viewer: somente clientes com grant explícito.
    for (const g of input.grants) {
      if (g.organizationId !== input.organizationId) continue;
      clientIds.add(g.clientId);
      const set = clientCapabilities.get(g.clientId) ?? new Set<Capability>();
      for (const cap of g.capabilities) set.add(cap);
      clientCapabilities.set(g.clientId, set);
    }
  }

  return {
    userId: input.userId,
    organizationId: input.organizationId,
    role,
    clientIds,
    orgCapabilities,
    clientCapabilities,
    organizationSuspended: input.organizationState.subscriptionStatus === 'suspended',
  };
}

/** TEN-05: valida acesso a um cliente específico. */
export function canAccessClient(ctx: AccessContext, clientId: string): boolean {
  return ctx.clientIds.has(clientId);
}

/** Capacidade efetiva no cliente = capacidade da org (owner/admin) ou grant do cliente. */
export function hasCapability(
  ctx: AccessContext,
  capability: Capability,
  clientId?: string,
): boolean {
  if (ctx.orgCapabilities.has(capability)) return true;
  if (clientId) {
    return ctx.clientCapabilities.get(clientId)?.has(capability) ?? false;
  }
  return false;
}

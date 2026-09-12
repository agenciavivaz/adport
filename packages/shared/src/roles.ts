/**
 * Papéis e capacidades — PRD §4.2.
 *
 * A autorização consulta o membership vigente (TEN-04); estes tipos são a fonte
 * única de verdade compartilhada entre app e domínio. Nunca aceitar permissões
 * livres enviadas pelo frontend.
 */

/** Papéis dentro de uma organização (agência). */
export const AGENCY_ROLES = [
  'agency_owner',
  'agency_admin',
  'agency_manager',
  'agency_analyst',
  'client_viewer',
] as const;
export type AgencyRole = (typeof AGENCY_ROLES)[number];

/** Papel de plataforma (control plane), fora do tenant da agência. */
export const PLATFORM_ROLES = ['platform_super_admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type Role = AgencyRole | PlatformRole;

/**
 * Capacidades tipadas complementares (PRD §4.2). Concedidas por grant explícito
 * dentro da matriz permitida ao papel; owner/admin só delegam o que a matriz
 * permite.
 */
export const CAPABILITIES = [
  'connections.manage',
  'pii.read',
  'exports.create',
  'ads.propose',
  'ads.approve',
  'billing.manage',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * Capacidades máximas que cada papel de agência pode ter/delegar.
 * Um grant não pode conceder capacidade fora deste conjunto.
 */
export const ROLE_MAX_CAPABILITIES: Record<AgencyRole, readonly Capability[]> = {
  agency_owner: [
    'connections.manage',
    'pii.read',
    'exports.create',
    'ads.propose',
    'ads.approve',
    'billing.manage',
  ],
  agency_admin: ['connections.manage', 'pii.read', 'exports.create', 'ads.propose', 'ads.approve'],
  agency_manager: ['connections.manage', 'exports.create', 'ads.propose'],
  agency_analyst: ['exports.create'],
  client_viewer: [],
};

/** Papéis que alcançam todos os clientes da própria agência sem grant explícito. */
export const ALL_CLIENTS_ROLES: readonly AgencyRole[] = ['agency_owner', 'agency_admin'];

/** Papéis que exigem grant explícito por cliente (PRD §4.2). */
export const GRANT_SCOPED_ROLES: readonly AgencyRole[] = [
  'agency_manager',
  'agency_analyst',
  'client_viewer',
];

/** Ações administrativas de agência restritas a owner/admin. */
export type AgencyAdminAction =
  | 'team.invite'
  | 'team.remove'
  | 'team.set_role'
  | 'client.create'
  | 'client.delete'
  | 'connections.manage'
  | 'grants.manage'
  | 'branding.manage';

/** owner e admin gerenciam equipe/clientes; manager NÃO gerencia grants (PRD §4.2). */
export const ADMIN_ACTION_ROLES: Record<AgencyAdminAction, readonly AgencyRole[]> = {
  'team.invite': ['agency_owner', 'agency_admin'],
  'team.remove': ['agency_owner', 'agency_admin'],
  'team.set_role': ['agency_owner', 'agency_admin'],
  'client.create': ['agency_owner', 'agency_admin'],
  'client.delete': ['agency_owner'],
  'connections.manage': ['agency_owner', 'agency_admin'],
  'grants.manage': ['agency_owner', 'agency_admin'],
  'branding.manage': ['agency_owner', 'agency_admin'],
};

export function isAgencyRole(value: string): value is AgencyRole {
  return (AGENCY_ROLES as readonly string[]).includes(value);
}

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Valida um conjunto de capacidades solicitado contra o máximo permitido ao papel.
 * Retorna apenas as capacidades válidas; descarta silenciosamente as não
 * permitidas para que o chamador nunca eleve privilégio via payload.
 */
export function clampCapabilitiesToRole(
  role: AgencyRole,
  requested: readonly string[],
): Capability[] {
  const allowed = new Set<Capability>(ROLE_MAX_CAPABILITIES[role]);
  const out: Capability[] = [];
  for (const c of requested) {
    if (isCapability(c) && allowed.has(c)) out.push(c);
  }
  return out;
}

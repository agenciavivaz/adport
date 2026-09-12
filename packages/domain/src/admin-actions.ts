/**
 * Ações administrativas de agência e invariantes de equipe — PRD §4.2, TEN-07.
 */
import { ADMIN_ACTION_ROLES, type AgencyAdminAction, type AgencyRole } from '@ai/shared';
import type { AccessContext } from './access-context';

export function canPerformAdminAction(ctx: AccessContext, action: AgencyAdminAction): boolean {
  return ADMIN_ACTION_ROLES[action].includes(ctx.role);
}

/**
 * TEN-07: impedir remoção do último owner.
 * `owners` = lista de userIds com papel owner ativo na org.
 */
export function canRemoveMember(params: {
  owners: string[];
  targetUserId: string;
  targetRole: AgencyRole;
}): { allowed: boolean; reason?: string } {
  const { owners, targetUserId, targetRole } = params;
  if (targetRole === 'agency_owner' && owners.length <= 1 && owners.includes(targetUserId)) {
    return { allowed: false, reason: 'last_owner_cannot_be_removed' };
  }
  return { allowed: true };
}

/**
 * TEN-07 / §4.2: mudança de papel não pode remover o último owner nem permitir
 * que um não-owner assuma propriedade sem ser owner atual.
 */
export function canChangeRole(params: {
  actorRole: AgencyRole;
  owners: string[];
  targetUserId: string;
  currentRole: AgencyRole;
  nextRole: AgencyRole;
}): { allowed: boolean; reason?: string } {
  const { actorRole, owners, targetUserId, currentRole, nextRole } = params;

  // Apenas owner pode transferir propriedade (promover a owner).
  if (nextRole === 'agency_owner' && actorRole !== 'agency_owner') {
    return { allowed: false, reason: 'only_owner_can_assign_owner' };
  }
  // Rebaixar o último owner deixaria a org sem owner.
  if (
    currentRole === 'agency_owner' &&
    nextRole !== 'agency_owner' &&
    owners.length <= 1 &&
    owners.includes(targetUserId)
  ) {
    return { allowed: false, reason: 'last_owner_cannot_be_demoted' };
  }
  return { allowed: true };
}

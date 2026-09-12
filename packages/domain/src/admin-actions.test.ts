import { describe, it, expect } from 'vitest';
import { canRemoveMember, canChangeRole } from './admin-actions';

describe('invariantes de owner (TEN-07)', () => {
  it('não remove o último owner', () => {
    expect(
      canRemoveMember({ owners: ['u1'], targetUserId: 'u1', targetRole: 'agency_owner' }),
    ).toEqual({ allowed: false, reason: 'last_owner_cannot_be_removed' });
  });

  it('remove owner quando há outro owner', () => {
    expect(
      canRemoveMember({ owners: ['u1', 'u2'], targetUserId: 'u1', targetRole: 'agency_owner' })
        .allowed,
    ).toBe(true);
  });

  it('não rebaixa o último owner', () => {
    expect(
      canChangeRole({
        actorRole: 'agency_owner',
        owners: ['u1'],
        targetUserId: 'u1',
        currentRole: 'agency_owner',
        nextRole: 'agency_admin',
      }),
    ).toEqual({ allowed: false, reason: 'last_owner_cannot_be_demoted' });
  });

  it('admin não pode promover a owner (transferência de propriedade)', () => {
    expect(
      canChangeRole({
        actorRole: 'agency_admin',
        owners: ['u1'],
        targetUserId: 'u2',
        currentRole: 'agency_analyst',
        nextRole: 'agency_owner',
      }),
    ).toEqual({ allowed: false, reason: 'only_owner_can_assign_owner' });
  });
});

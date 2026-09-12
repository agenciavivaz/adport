import { describe, it, expect } from 'vitest';
import { buildAccessContext, canAccessClient, hasCapability } from './access-context';
import type { BuildAccessContextInput } from './access-context';

const orgA = 'org-a';
const orgB = 'org-b';

function base(overrides: Partial<BuildAccessContextInput>): BuildAccessContextInput {
  return {
    userId: 'u1',
    organizationId: orgA,
    membership: { organizationId: orgA, userId: 'u1', role: 'agency_analyst', status: 'active' },
    grants: [],
    allActiveClientIds: ['c1', 'c2', 'c3'],
    organizationState: { organizationId: orgA, subscriptionStatus: 'active' },
    ...overrides,
  };
}

describe('buildAccessContext', () => {
  it('sem membership => null (nega sem revelar)', () => {
    expect(buildAccessContext(base({ membership: null }))).toBeNull();
  });

  it('membership de outra org => null (T01: isolamento entre agências)', () => {
    const ctx = buildAccessContext(
      base({
        membership: { organizationId: orgB, userId: 'u1', role: 'agency_owner', status: 'active' },
      }),
    );
    expect(ctx).toBeNull();
  });

  it('membership suspenso => null', () => {
    const ctx = buildAccessContext(
      base({
        membership: { organizationId: orgA, userId: 'u1', role: 'agency_owner', status: 'suspended' },
      }),
    );
    expect(ctx).toBeNull();
  });

  it('owner alcança todos os clientes ativos da agência', () => {
    const ctx = buildAccessContext(
      base({
        membership: { organizationId: orgA, userId: 'u1', role: 'agency_owner', status: 'active' },
      }),
    )!;
    expect([...ctx.clientIds].sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('T02: analista sem grant NÃO acessa clientes da mesma agência', () => {
    const ctx = buildAccessContext(base({ grants: [] }))!;
    expect(canAccessClient(ctx, 'c1')).toBe(false);
    expect(ctx.clientIds.size).toBe(0);
  });

  it('T02: analista só acessa cliente concedido explicitamente', () => {
    const ctx = buildAccessContext(
      base({
        grants: [{ organizationId: orgA, clientId: 'c2', capabilities: ['exports.create'] }],
      }),
    )!;
    expect(canAccessClient(ctx, 'c2')).toBe(true);
    expect(canAccessClient(ctx, 'c1')).toBe(false);
    expect(hasCapability(ctx, 'exports.create', 'c2')).toBe(true);
    expect(hasCapability(ctx, 'pii.read', 'c2')).toBe(false);
  });

  it('grant de outra organização é ignorado', () => {
    const ctx = buildAccessContext(
      base({
        grants: [{ organizationId: orgB, clientId: 'cX', capabilities: ['exports.create'] }],
      }),
    )!;
    expect(canAccessClient(ctx, 'cX')).toBe(false);
  });

  it('owner tem capacidades da org globalmente', () => {
    const ctx = buildAccessContext(
      base({
        membership: { organizationId: orgA, userId: 'u1', role: 'agency_owner', status: 'active' },
      }),
    )!;
    expect(hasCapability(ctx, 'billing.manage')).toBe(true);
    expect(hasCapability(ctx, 'pii.read', 'c1')).toBe(true);
  });
});

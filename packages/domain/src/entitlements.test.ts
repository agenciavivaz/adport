import { describe, it, expect } from 'vitest';
import { checkQuota, canMutateExternally, isActiveSubscription } from './entitlements';
import type { PlanLimits } from './entitlements';

const features: PlanLimits['features'] = {
  stage2: false,
  externalMutations: false,
  branding: true,
  portal: true,
};

describe('checkQuota (BILL-04)', () => {
  it('bloqueia quando no limite', () => {
    expect(checkQuota(10, 10, 'active_clients')).toEqual({
      allowed: false,
      reason: 'quota_exceeded:active_clients',
    });
  });
  it('permite abaixo do limite', () => {
    expect(checkQuota(9, 10, 'active_clients').allowed).toBe(true);
  });
  it('ilimitado (null) sempre permite', () => {
    expect(checkQuota(9999, null, 'ai_runs').allowed).toBe(true);
  });
});

describe('canMutateExternally (BILL-05/TEN-10)', () => {
  it('bloqueia quando feature desligada', () => {
    expect(canMutateExternally('active', features).allowed).toBe(false);
  });
  it('bloqueia em carência mesmo com feature ligada', () => {
    expect(
      canMutateExternally('past_due', { ...features, externalMutations: true }),
    ).toEqual({ allowed: false, reason: 'subscription_past_due_grace' });
  });
  it('permite ativo com feature ligada', () => {
    expect(canMutateExternally('active', { ...features, externalMutations: true }).allowed).toBe(
      true,
    );
  });
});

describe('isActiveSubscription', () => {
  it('trialing e active são ativos', () => {
    expect(isActiveSubscription('trialing')).toBe(true);
    expect(isActiveSubscription('active')).toBe(true);
    expect(isActiveSubscription('suspended')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { clampCapabilitiesToRole } from './roles';

describe('clampCapabilitiesToRole', () => {
  it('descarta capacidade acima do máximo do papel (T03: sem escalada por payload)', () => {
    // analyst não pode ter billing.manage nem ads.approve
    const result = clampCapabilitiesToRole('agency_analyst', [
      'exports.create',
      'billing.manage',
      'ads.approve',
    ]);
    expect(result).toEqual(['exports.create']);
  });

  it('descarta strings inválidas enviadas pelo frontend', () => {
    const result = clampCapabilitiesToRole('agency_owner', [
      'connections.manage',
      'is_super_admin',
      'DROP TABLE',
    ]);
    expect(result).toEqual(['connections.manage']);
  });

  it('owner pode receber todas as capacidades', () => {
    const result = clampCapabilitiesToRole('agency_owner', [
      'connections.manage',
      'pii.read',
      'exports.create',
      'ads.propose',
      'ads.approve',
      'billing.manage',
    ]);
    expect(result).toHaveLength(6);
  });

  it('client_viewer não recebe nenhuma capacidade', () => {
    expect(clampCapabilitiesToRole('client_viewer', ['exports.create', 'pii.read'])).toEqual([]);
  });
});

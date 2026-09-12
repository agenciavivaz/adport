import { describe, it, expect } from 'vitest';
import { getAdapter, isProviderConfigured, ProviderNotConfiguredError } from './index';

describe('adapter registry', () => {
  it('provedor não incorporado sinaliza erro explícito (não simula sucesso)', () => {
    expect(isProviderConfigured('google_ads')).toBe(false);
    expect(() => getAdapter('google_ads')).toThrow(ProviderNotConfiguredError);
  });
});

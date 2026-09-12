import { describe, it, expect } from 'vitest';
import { buildAuthUrl, normalizeCampaignRow, googleAdsCapabilities } from './google';
import { microsToAmount } from '../money';

describe('microsToAmount', () => {
  it('converte micros para unidade maior UMA vez, com precisão', () => {
    expect(microsToAmount(1_000_000)).toBe('1');
    expect(microsToAmount(1_500_000)).toBe('1.5');
    expect(microsToAmount(1_234_567)).toBe('1.234567');
    expect(microsToAmount(0)).toBe('0');
    expect(microsToAmount(-2_000_000)).toBe('-2');
  });
  it('aceita string grande sem perda (bigint)', () => {
    expect(microsToAmount('1000000000000')).toBe('1000000'); // 1M unidades
  });
});

describe('buildAuthUrl', () => {
  it('inclui scope adwords, PKCE S256, offline e state', () => {
    const url = buildAuthUrl({
      clientId: 'cid',
      redirectUri: 'https://app/cb',
      state: 'st123',
      codeChallenge: 'chal',
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/adwords');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('state')).toBe('st123');
    expect(u.searchParams.get('client_id')).toBe('cid');
  });
});

describe('normalizeCampaignRow', () => {
  it('normaliza linha do GAQL preservando ID externo e convertendo micros', () => {
    const row = normalizeCampaignRow({
      segments: { date: '2026-09-01' },
      campaign: { id: '123', name: 'Camp A', status: 'ENABLED' },
      metrics: { cost_micros: '1000000000', impressions: '5000', clicks: '100', conversions: 10, conversions_value: 300 },
    });
    expect(row.externalId).toBe('123');
    expect(row.entity).toBe('campaign');
    expect(row.data.spend).toBe('1000'); // 1_000_000_000 micros = 1000
    expect(row.data.clicks).toBe(100);
    expect(row.data.date_local).toBe('2026-09-01');
  });
});

describe('googleAdsCapabilities', () => {
  it('unvalidated sem config; beta com config (validated só após conta real)', () => {
    expect(googleAdsCapabilities(false).maturity).toBe('unvalidated');
    expect(googleAdsCapabilities(true).maturity).toBe('beta');
  });
});

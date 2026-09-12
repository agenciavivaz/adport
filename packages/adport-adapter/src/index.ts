/**
 * Fronteira de integração com o domínio do SaaS — PRD §3.2.
 *
 * UI e domínio comercial NÃO importam implementações de provedor diretamente:
 * dependem apenas deste contrato. As implementações reais (Google/Meta upstream)
 * são registradas aqui após a incorporação controlada do Adport
 * (ver docs/adport-upstream.md). Enquanto não configuradas, o registry sinaliza
 * explicitamente que o provedor não está disponível — nunca simula sucesso.
 */
import type { ProviderId, SourceAdapter, SourceCapabilities } from '@ai/shared';

export type AdapterFactory = () => SourceAdapter;

export class ProviderNotConfiguredError extends Error {
  constructor(public readonly provider: ProviderId) {
    super(`provider_not_configured:${provider}`);
    this.name = 'ProviderNotConfiguredError';
  }
}

const registry = new Map<ProviderId, AdapterFactory>();

/** Registra a fábrica de um adapter de provedor (chamado no bootstrap do servidor). */
export function registerAdapter(provider: ProviderId, factory: AdapterFactory): void {
  registry.set(provider, factory);
}

/** Obtém um adapter; lança erro explícito se o provedor não foi incorporado/config. */
export function getAdapter(provider: ProviderId): SourceAdapter {
  const factory = registry.get(provider);
  if (!factory) throw new ProviderNotConfiguredError(provider);
  return factory();
}

export function isProviderConfigured(provider: ProviderId): boolean {
  return registry.has(provider);
}

/** Capacidades declaradas de um provedor não configurado (maturity: unvalidated). */
export * from './money';
export * from './providers/google';

import { GoogleAdsAdapter, readGoogleAdsConfig } from './providers/google';

/**
 * Registra os adapters conforme a configuração do ambiente (bootstrap do servidor).
 * Idempotente. Provedores sem config permanecem não registrados (gate de ativação).
 */
export function registerConfiguredAdapters(): void {
  const g = readGoogleAdsConfig();
  if (g && !registry.has('google_ads')) {
    registerAdapter('google_ads', () => new GoogleAdsAdapter(g));
  }
}

export function unconfiguredCapabilities(provider: ProviderId): SourceCapabilities {
  return {
    provider,
    entities: [],
    metrics: [],
    breakdowns: [],
    supportsIncremental: false,
    supportsWebhooks: false,
    mutations: [],
    limits: {},
    maturity: 'unvalidated',
  };
}

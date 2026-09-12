/**
 * Contrato do adapter de fonte — PRD §14.3.
 *
 * Interface conceitual; tipos concretos completados após inspeção do upstream
 * Adport. `AuthorizedConnectionContext` é criado no servidor e NÃO serializado
 * ao browser; segredos são resolvidos apenas durante a execução.
 */

export type ProviderId = 'google_ads' | 'meta_ads' | 'kommo' | 'hubspot' | 'ga4' | 'generic';

export type ConnectionStatus =
  | 'not_configured'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'partial'
  | 'reauth_required'
  | 'rate_limited'
  | 'error'
  | 'disabled';

/** Capacidades efetivas — a UI consulta isto, não uma lista hardcoded (§14.3). */
export interface SourceCapabilities {
  provider: ProviderId;
  /** Entidades suportadas (ex.: 'campaign', 'ad_group', 'ad'). */
  entities: string[];
  /** Métricas suportadas por grain. */
  metrics: string[];
  /** Tipos de breakdown suportados (ex.: 'age', 'gender', 'placement'). */
  breakdowns: string[];
  supportsIncremental: boolean;
  supportsWebhooks: boolean;
  /** Mutações realmente disponíveis (ex.: 'pause_campaign', 'update_budget'). */
  mutations: string[];
  /** Limites conhecidos (rate, janela máxima etc.), preenchidos após validação. */
  limits: Record<string, number | string | null>;
  /** Maturidade declarada do conector para gate de liberação. */
  maturity: 'unvalidated' | 'beta' | 'validated';
}

/** Referência ao segredo, nunca o segredo em si (ADR-0004). */
export interface SecretRef {
  connectionId: string;
  vaultKeyId: string;
}

/** Contexto autorizado, montado no servidor. Segredo resolvido só na execução. */
export interface AuthorizedConnectionContext {
  organizationId: string;
  clientId: string;
  provider: ProviderId;
  connectionId: string;
  secretRef: SecretRef;
  /** Resolve o segredo decifrado — só disponível no runtime backend. */
  resolveSecret: () => Promise<Record<string, string>>;
}

export interface SyncPageRequest {
  entity: string;
  cursor?: string | null;
  /** Janela de datas (ISO date, fuso da conta). */
  since?: string;
  until?: string;
  /** Orçamento de tempo em ms para o lote (meta ≤ 30_000). */
  timeBudgetMs: number;
}

export interface NormalizedRow {
  /** ID externo estável — define identidade (§8.2 ADS-14), não o nome. */
  externalId: string;
  entity: string;
  data: Record<string, unknown>;
}

export interface NormalizedPage {
  rows: NormalizedRow[];
  nextCursor: string | null;
  /** Cobertura temporal efetivamente lida (para reconciliação). */
  coverage?: { since: string; until: string };
}

export interface AccountPage {
  accounts: Array<{
    externalAccountId: string;
    name: string;
    currency: string | null;
    timezone: string | null;
    /** Hierarquia: conta gerenciadora vs anunciante (Google). */
    managerExternalId?: string | null;
  }>;
  nextCursor: string | null;
}

export interface RefreshResult {
  rotated: boolean;
  expiresAt: string | null;
}

export interface DisconnectResult {
  revokedAtProvider: boolean;
}

export interface SourceAdapter {
  capabilities(): SourceCapabilities;
  discoverAccounts(ctx: AuthorizedConnectionContext): Promise<AccountPage>;
  syncPage(ctx: AuthorizedConnectionContext, request: SyncPageRequest): Promise<NormalizedPage>;
  refreshCredential(ctx: AuthorizedConnectionContext): Promise<RefreshResult>;
  disconnect(ctx: AuthorizedConnectionContext): Promise<DisconnectResult>;
}

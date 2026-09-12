/**
 * Adapter Google Ads — PRD §8.1 (ADS-01), §14.3.
 *
 * As partes puras (URL de OAuth, normalização de linhas do GAQL, capacidades)
 * são implementadas e testadas. As chamadas de rede exigem client id/secret e o
 * developer token do proprietário; sem eles, discover/sync/refresh lançam erro
 * explícito de configuração — nunca simulam sucesso (ADS-08, §21.2).
 *
 * A incorporação do pacote Google upstream do Adport substitui a camada de rede
 * abaixo por implementação validada, mantendo este contrato (docs/adport-upstream.md).
 */
import type {
  AccountPage,
  AuthorizedConnectionContext,
  DisconnectResult,
  NormalizedPage,
  NormalizedRow,
  RefreshResult,
  SourceAdapter,
  SourceCapabilities,
  SyncPageRequest,
} from '@ai/shared';
import { microsToAmount } from '../money';

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  redirectUri: string;
}

const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

/** Lê a config do ambiente; retorna null se incompleta (gate de ativação). */
export function readGoogleAdsConfig(): GoogleAdsConfig | null {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET ?? '';
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '';
  const redirectUri = process.env.GOOGLE_ADS_REDIRECT_URI ?? '';
  if (!clientId || !clientSecret || !developerToken || !redirectUri) return null;
  return { clientId, clientSecret, developerToken, redirectUri };
}

/**
 * Monta a URL de autorização OAuth (offline + PKCE S256).
 * `state` e `codeChallenge` são gerados/armazenados no servidor (oauth_transactions).
 */
export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: GOOGLE_ADS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });
  if (params.loginHint) qs.set('login_hint', params.loginHint);
  return `${AUTH_ENDPOINT}?${qs.toString()}`;
}

/** Linha crua do GAQL (campaign) — subconjunto usado. */
export interface GoogleInsightsRow {
  segments?: { date?: string };
  campaign?: { id?: string; name?: string; status?: string };
  metrics?: {
    cost_micros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    conversions?: string | number;
    conversions_value?: string | number;
  };
}

/**
 * Normaliza uma linha de campanha do Google Ads para NormalizedRow.
 * cost_micros → spend (divisão por 1e6 UMA vez, string exata).
 * IDs externos definem identidade (ADS-14).
 */
export function normalizeCampaignRow(row: GoogleInsightsRow): NormalizedRow {
  const externalId = String(row.campaign?.id ?? '');
  const m = row.metrics ?? {};
  return {
    externalId,
    entity: 'campaign',
    data: {
      name: row.campaign?.name ?? null,
      status: row.campaign?.status ?? null,
      date_local: row.segments?.date ?? null,
      spend: microsToAmount(m.cost_micros ?? 0),
      impressions: Number(m.impressions ?? 0),
      clicks: Number(m.clicks ?? 0),
      conversions: Number(m.conversions ?? 0),
      conversion_value: Number(m.conversions_value ?? 0),
    },
  };
}

export function googleAdsCapabilities(configured: boolean): SourceCapabilities {
  return {
    provider: 'google_ads',
    entities: ['campaign', 'ad_group', 'ad'],
    metrics: ['spend', 'impressions', 'clicks', 'conversions', 'conversion_value'],
    breakdowns: [],
    supportsIncremental: true,
    supportsWebhooks: false,
    mutations: [], // fase 1.6, atrás de política
    limits: { initial_window_days: 90, incremental_lookback_days: 7 },
    // Só passa a 'validated' após teste em conta real (ADS-08, Gate G2).
    maturity: configured ? 'beta' : 'unvalidated',
  };
}

/**
 * Implementação do contrato. A camada de rede exige credenciais reais e é o ponto
 * de incorporação do pacote upstream. Sem config, lança ProviderConfigError.
 */
export class GoogleAdsAdapter implements SourceAdapter {
  constructor(private readonly config: GoogleAdsConfig | null) {}

  capabilities(): SourceCapabilities {
    return googleAdsCapabilities(this.config !== null);
  }

  private ensureConfig(): GoogleAdsConfig {
    if (!this.config) {
      throw new ProviderConfigError('google_ads_not_configured: defina GOOGLE_ADS_* no ambiente');
    }
    return this.config;
  }

  async discoverAccounts(_ctx: AuthorizedConnectionContext): Promise<AccountPage> {
    this.ensureConfig();
    // Incorporação upstream: listAccessibleCustomers + customer hierarchy.
    throw new ProviderConfigError('google_ads_network_layer_pending_upstream_incorporation');
  }

  async syncPage(_ctx: AuthorizedConnectionContext, _req: SyncPageRequest): Promise<NormalizedPage> {
    this.ensureConfig();
    throw new ProviderConfigError('google_ads_network_layer_pending_upstream_incorporation');
  }

  async refreshCredential(_ctx: AuthorizedConnectionContext): Promise<RefreshResult> {
    this.ensureConfig();
    throw new ProviderConfigError('google_ads_network_layer_pending_upstream_incorporation');
  }

  async disconnect(_ctx: AuthorizedConnectionContext): Promise<DisconnectResult> {
    // Desconectar localmente é sempre possível; revogação no provedor exige rede.
    return { revokedAtProvider: false };
  }
}

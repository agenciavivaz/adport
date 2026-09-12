import { hasCapability } from '@ai/domain';
import { readGoogleAdsConfig, buildAuthUrl } from '@ai/adport-adapter';
import { resolveClientAccess } from '@/lib/auth/context';
import { generatePkce, generateState, sha256hex } from '@/lib/oauth';
import { ok, fail, notFound, forbidden } from '@/lib/api/respond';

/** Inicia o OAuth do Google Ads. Gate: config presente (ADS-08). */
export async function POST(_req: Request, { params }: { params: Promise<{ org: string; client: string }> }) {
  const { org, client } = await params;
  const access = await resolveClientAccess(org, client);
  if (!access) return notFound();
  if (!hasCapability(access.ctx, 'connections.manage', client)) {
    return forbidden('connections_manage_required');
  }

  const config = readGoogleAdsConfig();
  if (!config) {
    // Sem app/scopes configurados não se ativa o provedor (ADS-08).
    return fail(
      503,
      'provider_not_configured',
      'Google Ads não configurado neste ambiente. Defina GOOGLE_ADS_* no servidor.',
    );
  }

  const pkce = generatePkce();
  const state = generateState();

  const { error } = await access.supabase.rpc('start_oauth', {
    p_client: client,
    p_provider: 'google_ads',
    p_redirect_uri: config.redirectUri,
    p_state_digest: sha256hex(state),
    p_pkce_verifier_digest: sha256hex(pkce.verifier),
  });
  if (error) return fail(500, 'oauth_start_failed', 'Falha ao iniciar OAuth.');

  const url = buildAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
    codeChallenge: pkce.challenge,
  });

  // O verifier bruto é entregue ao cliente apenas para completar o fluxo no callback;
  // o servidor guardou o digest. Em produção, preferir cookie httpOnly de curta duração.
  return ok({ authorization_url: url, code_verifier: pkce.verifier, state });
}

import { NextResponse } from 'next/server';
import { readGoogleAdsConfig } from '@ai/adport-adapter';
import { getCurrentUser } from '@/lib/auth/context';
import { sha256hex } from '@/lib/oauth';

/**
 * Callback do OAuth Google. Verifica o state (uso único, vinculado ao ator) via
 * RPC; troca de código por token exige a camada de rede/cofre (incorporação
 * upstream). Sem ela, a conexão fica marcada como pendente com diagnóstico —
 * nunca aparece como íntegra (§7.1).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const base = process.env.APP_BASE_URL ?? url.origin;

  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${base}/login`);
  if (!code || !state) {
    return NextResponse.redirect(`${base}/app?oauth_error=missing_params`);
  }

  const { data, error } = await supabase.rpc('consume_oauth_state', {
    p_state_digest: sha256hex(state),
  });
  const tx = Array.isArray(data) ? data[0] : data;
  if (error || !tx) {
    // State inválido/expirado/reutilizado ou de outro ator (§16.1).
    return NextResponse.redirect(`${base}/app?oauth_error=invalid_state`);
  }

  const config = readGoogleAdsConfig();
  if (!config) {
    return NextResponse.redirect(
      `${base}/app/${tx.organization_id}/clients/${tx.client_id}/connections?oauth=provider_not_configured`,
    );
  }

  // A troca de código -> tokens e a cifragem no cofre (AES-GCM/Vault) são a camada
  // de incorporação upstream (docs/adport-upstream.md). Marcamos pendente com clareza.
  return NextResponse.redirect(
    `${base}/app/${tx.organization_id}/clients/${tx.client_id}/connections?oauth=token_exchange_pending_upstream`,
  );
}

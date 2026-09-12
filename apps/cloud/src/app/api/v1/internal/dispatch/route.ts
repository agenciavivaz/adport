import { NextResponse } from 'next/server';
import { getAdapter, isProviderConfigured } from '@ai/adport-adapter';
import type { ProviderId } from '@ai/shared';
import { createSupabaseServiceClient } from '@/lib/supabase/admin';
import { ensureAdaptersRegistered } from '@/lib/bootstrap';

/**
 * Worker/dispatcher interno (ADR-0003). Autenticado pelo INTERNAL_DISPATCHER_SECRET,
 * nunca pela sessão do usuário. Recupera leases expirados, reserva um lote de jobs
 * e processa cada um por orçamento de tempo curto. Efeitos idempotentes; falha vai
 * a retry/DLQ. Sem processo permanente: chamado por cron em lotes.
 */
export async function POST(request: Request) {
  const secret = process.env.INTERNAL_DISPATCHER_SECRET;
  const provided = request.headers.get('x-dispatcher-secret');
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
  }

  ensureAdaptersRegistered();

  let svc;
  try {
    svc = createSupabaseServiceClient();
  } catch {
    return NextResponse.json(
      { error: { code: 'service_role_config_missing', message: 'SUPABASE_SERVICE_ROLE_KEY ausente.' } },
      { status: 503 },
    );
  }

  await svc.rpc('reap_expired_leases');

  const worker = `vercel-${Math.random().toString(36).slice(2, 8)}`;
  const { data: jobs, error } = await svc.rpc('claim_sync_jobs', {
    p_worker: worker,
    p_limit: 5,
    p_lease_seconds: 60,
  });
  if (error) {
    return NextResponse.json({ error: { code: 'claim_failed' } }, { status: 500 });
  }

  const results: Array<{ job: string; outcome: string }> = [];

  for (const job of (jobs ?? []) as Array<{ id: string; connection_id: string }>) {
    try {
      const { data: conn } = await svc
        .from('connections')
        .select('provider')
        .eq('id', job.connection_id)
        .single();
      const provider = (conn?.provider ?? 'generic') as ProviderId;

      if (!isProviderConfigured(provider)) {
        // Provedor não incorporado/config: falha honesta -> retry/DLQ. Sem simulação.
        await svc.rpc('fail_sync_job', {
          p_id: job.id,
          p_code: 'provider_not_configured',
          p_error: `provider ${provider} não configurado neste ambiente`,
        });
        results.push({ job: job.id, outcome: 'failed:provider_not_configured' });
        continue;
      }

      // Camada de rede real do adapter (incorporação upstream). Enquanto pendente,
      // syncPage lança ProviderConfigError -> tratada como falha (retry/DLQ).
      getAdapter(provider);
      await svc.rpc('fail_sync_job', {
        p_id: job.id,
        p_code: 'network_layer_pending',
        p_error: 'camada de rede do adapter pendente de incorporação upstream',
      });
      results.push({ job: job.id, outcome: 'failed:network_layer_pending' });
    } catch (e) {
      await svc.rpc('fail_sync_job', {
        p_id: job.id,
        p_code: 'worker_exception',
        p_error: e instanceof Error ? e.message : 'erro',
      });
      results.push({ job: job.id, outcome: 'failed:exception' });
    }
  }

  return NextResponse.json({ data: { claimed: results.length, results } });
}

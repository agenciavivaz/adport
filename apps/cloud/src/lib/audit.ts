/**
 * Auditoria append-only — §16.1. Escreve via a sessão do usuário (RLS permite
 * INSERT? Não: audit_events não tem policy de INSERT para usuário). Portanto o
 * registro passa por RPC SECURITY DEFINER `app.audit` (definida em migration).
 * Metadados são redigidos: sem PII/segredos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export async function audit(
  supabase: SupabaseClient,
  params: {
    organizationId?: string | null;
    clientId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    result?: 'ok' | 'denied' | 'error';
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.rpc('audit_log', {
      p_org: params.organizationId ?? null,
      p_client: params.clientId ?? null,
      p_action: params.action,
      p_target_type: params.targetType ?? null,
      p_target_id: params.targetId ?? null,
      p_result: params.result ?? 'ok',
      p_metadata: params.metadata ?? {},
    });
  } catch {
    // Auditoria não deve derrubar a operação; falhas são monitoradas à parte.
  }
}

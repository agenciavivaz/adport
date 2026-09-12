/**
 * Cliente de serviço (service_role) — SOMENTE para superfícies de plataforma
 * auditadas (§5, TEN-06). Nunca importar em código de rota de agência.
 * Chamadas devem passar por verificação de grant/escopo antes de usar.
 */
import { createClient } from '@supabase/supabase-js';
import { readPublicEnv, readServiceRoleKey } from '@/lib/env';

export function createSupabaseServiceClient() {
  const { env } = readPublicEnv();
  const key = readServiceRoleKey();
  if (!env || !key) {
    throw new Error('service_role_config_missing');
  }
  return createClient(env.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

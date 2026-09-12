/**
 * Configuração de ambiente com diagnóstico — PRD §18.3.
 * Configuração ausente gera diagnóstico claro, nunca simulação automática.
 */

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appBaseUrl: string;
}

export interface EnvDiagnostic {
  ok: boolean;
  missing: string[];
}

export function readPublicEnv(): { env: PublicEnv | null; diagnostic: EnvDiagnostic } {
  const missing: string[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';

  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (missing.length > 0) {
    return { env: null, diagnostic: { ok: false, missing } };
  }
  return {
    env: { supabaseUrl, supabaseAnonKey, appBaseUrl },
    diagnostic: { ok: true, missing: [] },
  };
}

/** Segredo server-only; nunca exposto ao browser. */
export function readServiceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

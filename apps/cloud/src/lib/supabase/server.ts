/**
 * Cliente Supabase server-side (usa o JWT do usuário + RLS) — ADR-0002, TEN-06.
 * NUNCA usar service_role aqui.
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { readPublicEnv } from '@/lib/env';

export async function createSupabaseServerClient() {
  const { env } = readPublicEnv();
  if (!env) {
    throw new Error('supabase_config_missing');
  }
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // chamada a partir de Server Component: middleware renova a sessão.
        }
      },
    },
  });
}

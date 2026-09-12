'use client';

/** Cliente Supabase para o browser (apenas URL + anon key públicas). */
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('supabase_config_missing');
  }
  return createBrowserClient(url, anon);
}

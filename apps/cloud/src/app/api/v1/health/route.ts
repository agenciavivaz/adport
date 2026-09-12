import { NextResponse } from 'next/server';
import { readPublicEnv } from '@/lib/env';

/** Health mínimo (§14.1). Não expõe segredos, apenas presença de configuração. */
export async function GET() {
  const { diagnostic } = readPublicEnv();
  return NextResponse.json({
    data: {
      status: diagnostic.ok ? 'ok' : 'config_missing',
      config_ok: diagnostic.ok,
      missing_config: diagnostic.missing, // apenas NOMES de variáveis, nunca valores
      api_version: 'v1',
      time: new Date().toISOString(),
    },
  });
}

import { randomUUID } from 'node:crypto';
import { hasCapability } from '@ai/domain';
import { parseMediaCsv, MEDIA_CSV_SCHEMA_VERSION } from '@ai/shared';
import { resolveClientAccess } from '@/lib/auth/context';
import { ok, fail, notFound, forbidden } from '@/lib/api/respond';
import { audit } from '@/lib/audit';

/**
 * Importação CSV de mídia (ADS-07). ?action=dry_run|commit.
 * dry_run: parse + validação + relatório de erros (sem gravar).
 * commit: upsert idempotente via RPC (namespace de origem separado do conector).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ org: string; client: string }> },
) {
  const { org, client } = await params;
  const access = await resolveClientAccess(org, client);
  if (!access) return notFound();
  if (!hasCapability(access.ctx, 'connections.manage', client)) {
    return forbidden('connections_manage_required');
  }

  const action = new URL(request.url).searchParams.get('action') ?? 'dry_run';
  const currency = (new URL(request.url).searchParams.get('currency') ?? 'BRL').toUpperCase();
  const text = await request.text();
  if (!text || text.length > 5_000_000) {
    return fail(413, 'payload', 'CSV vazio ou grande demais (máx ~5MB).');
  }

  const parsed = parseMediaCsv(text);

  const summary = {
    schema_version: MEDIA_CSV_SCHEMA_VERSION,
    total: parsed.total,
    valid: parsed.rows.length,
    rejected: parsed.errors.length,
    duplicates_in_file: parsed.duplicatesInFile,
    errors: parsed.errors.slice(0, 100),
  };

  if (action === 'dry_run') {
    return ok({ ...summary, committed: false });
  }

  if (parsed.rows.length === 0) {
    return fail(422, 'no_valid_rows', 'Nenhuma linha válida para importar.', summary);
  }

  const importId = randomUUID();
  const { data, error } = await access.supabase.rpc('import_media_facts', {
    p_org: access.organization.id,
    p_client: client,
    p_import_id: importId,
    p_currency: currency,
    p_rows: parsed.rows,
  });
  if (error) return fail(500, 'import_failed', 'Falha ao importar fatos.', { detail: error.message });

  await audit(access.supabase, {
    organizationId: access.organization.id,
    clientId: client,
    action: 'media.csv_imported',
    targetType: 'import',
    targetId: importId,
    metadata: { accepted: (data as { accepted?: number })?.accepted ?? 0, currency },
  });

  return ok({ ...summary, committed: true, import_id: importId, result: data });
}

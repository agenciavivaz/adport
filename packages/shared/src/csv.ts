/**
 * Parser/validador de CSV de mídia (ADS-07). Modelo versionado; validação,
 * deduplicação e relatório de erros. Não executa fórmulas (proteção contra CSV
 * injection na exportação). Puro e testável.
 *
 * Colunas (schema v1): date,campaign_external_id,campaign_name,spend,impressions,
 * clicks,conversions,conversion_value
 */

export const MEDIA_CSV_SCHEMA_VERSION = 'media.v1';

export interface MediaFactRow {
  grain: 'campaign';
  entity_external_id: string;
  date_local: string;
  spend: string;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  name?: string;
}

export interface CsvParseResult {
  rows: MediaFactRow[];
  errors: Array<{ line: number; message: string }>;
  duplicatesInFile: number;
  total: number;
}

const REQUIRED = ['date', 'campaign_external_id', 'spend', 'impressions', 'clicks'];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Neutraliza fórmulas (=,+,-,@) prefixando aspa simples ao exibir/exportar. */
export function sanitizeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export function parseMediaCsv(text: string): CsvParseResult {
  const errors: CsvParseResult['errors'] = [];
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: 'arquivo vazio' }], duplicatesInFile: 0, total: 0 };
  }
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  for (const req of REQUIRED) {
    if (!header.includes(req)) errors.push({ line: 1, message: `coluna obrigatória ausente: ${req}` });
  }
  if (errors.length > 0) return { rows: [], errors, duplicatesInFile: 0, total: lines.length - 1 };

  const idx = (name: string) => header.indexOf(name);
  const seen = new Set<string>();
  let duplicatesInFile = 0;
  const rows: MediaFactRow[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]!);
    const get = (n: string) => (idx(n) >= 0 ? (cols[idx(n)] ?? '').trim() : '');
    const date = get('date');
    const ext = get('campaign_external_id');
    const spend = get('spend') || '0';
    const impressions = get('impressions') || '0';
    const clicks = get('clicks') || '0';
    const conversions = get('conversions') || '0';
    const convValue = get('conversion_value') || '0';

    const lineErrors: string[] = [];
    if (!DATE_RE.test(date)) lineErrors.push('date inválida (use YYYY-MM-DD)');
    if (!ext) lineErrors.push('campaign_external_id vazio');
    if (!DECIMAL_RE.test(spend)) lineErrors.push('spend inválido');
    if (!/^\d+$/.test(impressions)) lineErrors.push('impressions inválido');
    if (!/^\d+$/.test(clicks)) lineErrors.push('clicks inválido');
    if (conversions && !DECIMAL_RE.test(conversions)) lineErrors.push('conversions inválido');
    if (convValue && !DECIMAL_RE.test(convValue)) lineErrors.push('conversion_value inválido');

    if (lineErrors.length > 0) {
      errors.push({ line: li + 1, message: lineErrors.join('; ') });
      continue;
    }

    const key = `${date}|${ext}`;
    if (seen.has(key)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(key);

    rows.push({
      grain: 'campaign',
      entity_external_id: ext,
      date_local: date,
      spend,
      impressions: Number(impressions),
      clicks: Number(clicks),
      conversions: Number(conversions || 0),
      conversion_value: Number(convValue || 0),
      name: get('campaign_name') || undefined,
    });
  }

  return { rows, errors, duplicatesInFile, total: lines.length - 1 };
}

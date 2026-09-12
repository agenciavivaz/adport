import { describe, it, expect } from 'vitest';
import { parseMediaCsv, sanitizeCell } from './csv';

const header = 'date,campaign_external_id,campaign_name,spend,impressions,clicks,conversions,conversion_value';

describe('parseMediaCsv', () => {
  it('parseia linhas válidas', () => {
    const csv = `${header}\n2026-09-01,C1,Camp A,1000,10000,100,10,3000`;
    const r = parseMediaCsv(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.entity_external_id).toBe('C1');
    expect(r.rows[0]!.spend).toBe('1000');
  });

  it('deduplica dentro do arquivo por (date, campaign_external_id)', () => {
    const csv = `${header}\n2026-09-01,C1,A,1000,1,1,0,0\n2026-09-01,C1,A,999,1,1,0,0`;
    const r = parseMediaCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicatesInFile).toBe(1);
  });

  it('reporta erros de validação por linha sem abortar o arquivo', () => {
    const csv = `${header}\n2026/09/01,C1,A,x,1,1,0,0\n2026-09-02,,A,10,1,1,0,0`;
    const r = parseMediaCsv(csv);
    expect(r.rows).toHaveLength(0);
    expect(r.errors.length).toBe(2);
  });

  it('coluna obrigatória ausente falha no header', () => {
    const r = parseMediaCsv('date,spend\n2026-09-01,10');
    expect(r.errors[0]!.message).toContain('campaign_external_id');
  });

  it('sanitizeCell neutraliza fórmula', () => {
    expect(sanitizeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sanitizeCell('normal')).toBe('normal');
  });
});

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Summary {
  total: number;
  valid: number;
  rejected: number;
  duplicates_in_file: number;
  errors: Array<{ line: number; message: string }>;
  committed: boolean;
  result?: { accepted?: number };
}

export function MediaImport({
  org,
  client,
  currency,
}: {
  org: string;
  client: string;
  currency: string;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'dry' | 'commit' | null>(null);

  async function send(action: 'dry_run' | 'commit') {
    setError(null);
    setLoading(action === 'dry_run' ? 'dry' : 'commit');
    const res = await fetch(
      `/api/v1/organizations/${org}/clients/${client}/imports/media?action=${action}&currency=${currency}`,
      { method: 'POST', headers: { 'content-type': 'text/csv' }, body: csv },
    );
    setLoading(null);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? 'Falha na importação.');
      setSummary(body?.error?.details ?? null);
      return;
    }
    setSummary(body.data);
    if (action === 'commit') router.refresh();
  }

  return (
    <div>
      <label htmlFor="csv">Conteúdo CSV</label>
      <textarea
        id="csv"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={8}
        style={{
          width: '100%',
          fontFamily: 'monospace',
          fontSize: 12,
          background: 'var(--panel-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 10,
        }}
        placeholder={'date,campaign_external_id,campaign_name,spend,impressions,clicks,conversions,conversion_value\n2026-09-01,C1,Campanha A,1000,10000,100,10,3000'}
      />
      {error && <div className="error">{error}</div>}
      {summary && (
        <div className="notice info" style={{ marginTop: 12 }}>
          {summary.committed ? '✓ Importado. ' : 'Pré-visualização. '}
          Total {summary.total} · válidas {summary.valid} · rejeitadas {summary.rejected} ·
          duplicadas no arquivo {summary.duplicates_in_file}
          {summary.result?.accepted !== undefined && <> · gravadas {summary.result.accepted}</>}
          {summary.errors?.length > 0 && (
            <ul className="small">
              {summary.errors.slice(0, 8).map((e, i) => (
                <li key={i}>
                  linha {e.line}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="btn-row">
        <button onClick={() => send('dry_run')} disabled={loading !== null || !csv}>
          {loading === 'dry' ? 'Validando…' : 'Pré-visualizar (dry-run)'}
        </button>
        <button
          className="primary"
          onClick={() => send('commit')}
          disabled={loading !== null || !csv || (summary ? summary.valid === 0 : false)}
        >
          {loading === 'commit' ? 'Importando…' : 'Importar'}
        </button>
      </div>
    </div>
  );
}

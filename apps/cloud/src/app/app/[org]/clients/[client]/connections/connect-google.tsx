'use client';

import { useState } from 'react';

export function ConnectGoogleButton({ org, client }: { org: string; client: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function connect() {
    setError(null);
    setLoading(true);
    const res = await fetch(
      `/api/v1/organizations/${org}/clients/${client}/connections/google/start`,
      { method: 'POST' },
    );
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Falha ao iniciar OAuth.');
      return;
    }
    const body = await res.json();
    // O verifier é guardado para o callback (em produção, cookie httpOnly curto).
    try {
      sessionStorage.setItem('g_verifier', body.data.code_verifier);
    } catch {
      /* ignore */
    }
    window.location.href = body.data.authorization_url;
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <div className="btn-row">
        <button className="primary" onClick={connect} disabled={loading}>
          {loading ? 'Redirecionando…' : 'Conectar Google Ads'}
        </button>
      </div>
    </div>
  );
}

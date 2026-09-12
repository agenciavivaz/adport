'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function accept() {
    setError(null);
    setLoading(true);
    const res = await fetch('/api/v1/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Convite inválido.');
      return;
    }
    router.push('/app');
    router.refresh();
  }

  return (
    <div>
      <p className="muted">
        Ao aceitar, você entra na agência com o papel definido no convite. O email autenticado deve
        corresponder ao convidado.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="btn-row">
        <button className="primary" onClick={accept} disabled={loading}>
          {loading ? 'Aceitando…' : 'Aceitar convite'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InviteForm({ org }: { org: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agency_analyst');
  const [error, setError] = useState<string | null>(null);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAcceptUrl(null);
    setLoading(true);
    const res = await fetch(`/api/v1/organizations/${org}/invitations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Falha ao convidar.');
      return;
    }
    const body = await res.json();
    setAcceptUrl(body.data.accept_url);
    setEmail('');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="i-email">Email</label>
      <input id="i-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="i-role">Papel</label>
      <select id="i-role" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="agency_admin">Admin</option>
        <option value="agency_manager">Manager</option>
        <option value="agency_analyst">Analyst</option>
        <option value="client_viewer">Client viewer</option>
      </select>
      {error && <div className="error">{error}</div>}
      {acceptUrl && (
        <div className="notice info" style={{ marginTop: 12 }}>
          Convite criado. Envio por email ainda não configurado — compartilhe este link de uso único
          manualmente:
          <br />
          <code>{acceptUrl}</code>
        </div>
      )}
      <div className="btn-row">
        <button className="primary" type="submit" disabled={loading || !email}>
          {loading ? 'Criando…' : 'Criar convite'}
        </button>
      </div>
    </form>
  );
}

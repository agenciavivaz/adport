'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ClientCreateForm({ org }: { org: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [businessModel, setBusinessModel] = useState('unknown');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/v1/organizations/${org}/clients`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, currency, business_model: businessModel }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Falha ao criar cliente.');
      return;
    }
    setName('');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="c-name">Nome</label>
      <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
      <label htmlFor="c-cur">Moeda (ISO)</label>
      <input
        id="c-cur"
        value={currency}
        maxLength={3}
        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        required
      />
      <label htmlFor="c-bm">Modelo de negócio</label>
      <select id="c-bm" value={businessModel} onChange={(e) => setBusinessModel(e.target.value)}>
        <option value="unknown">Desconhecido</option>
        <option value="one_time">Venda única</option>
        <option value="recurring">Recorrente</option>
        <option value="mixed">Misto</option>
      </select>
      {error && <div className="error">{error}</div>}
      <div className="btn-row">
        <button className="primary" type="submit" disabled={loading || !name}>
          {loading ? 'Salvando…' : 'Criar cliente'}
        </button>
      </div>
    </form>
  );
}

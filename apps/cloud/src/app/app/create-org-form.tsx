'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 62);
}

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/v1/organizations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, slug: slug || slugify(name) }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Falha ao criar agência.');
      return;
    }
    const body = await res.json();
    router.push(`/app/${body.data.slug}/overview`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="name">Nome da agência</label>
      <input
        id="name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSlug(slugify(e.target.value));
        }}
        required
      />
      <label htmlFor="slug">Slug</label>
      <input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
      {error && <div className="error">{error}</div>}
      <div className="btn-row">
        <button className="primary" type="submit" disabled={loading || !name}>
          {loading ? 'Criando…' : 'Criar agência'}
        </button>
      </div>
    </form>
  );
}

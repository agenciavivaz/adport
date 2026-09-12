'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function ResetForm() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Não revela se o email existe; sempre confirma envio.
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
    } catch {
      // silencioso: mesma resposta
    } finally {
      setDone(true);
      setLoading(false);
    }
  }

  if (done) {
    return <div className="notice info">Se o email existir, um link foi enviado.</div>;
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="btn-row">
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar link'}
        </button>
      </div>
    </form>
  );
}

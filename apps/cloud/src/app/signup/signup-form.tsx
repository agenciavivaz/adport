'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

export function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      if (error) {
        setError(error.message);
        return;
      }
      setDone(true);
    } catch {
      setError('Configuração do Supabase ausente. Veja /config.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="notice info">
        Verifique seu email para confirmar a conta. A verificação é obrigatória antes de entrar.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="password">Senha (mín. 8)</label>
      <input
        id="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && <div className="error">{error}</div>}
      <div className="btn-row">
        <button className="primary" type="submit" disabled={loading}>
          {loading ? 'Criando…' : 'Criar conta'}
        </button>
      </div>
    </form>
  );
}

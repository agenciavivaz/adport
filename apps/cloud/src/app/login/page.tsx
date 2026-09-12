import { Suspense } from 'react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="center-narrow">
      <div className="card">
        <h1>Entrar</h1>
        <p className="muted small">Agency Intelligence</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <div className="card small">
        Não tem conta? <a href="/signup">Criar agência</a> · <a href="/reset-password">Esqueci a senha</a>
      </div>
    </main>
  );
}

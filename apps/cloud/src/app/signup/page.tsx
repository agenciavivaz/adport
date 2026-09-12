import { SignupForm } from './signup-form';

export default function SignupPage() {
  return (
    <main className="center-narrow">
      <div className="card">
        <h1>Criar conta</h1>
        <p className="muted small">
          Após confirmar o email, você cria a agência e o primeiro cliente no onboarding.
        </p>
        <SignupForm />
      </div>
      <div className="card small">
        Já tem conta? <a href="/login">Entrar</a>
      </div>
    </main>
  );
}

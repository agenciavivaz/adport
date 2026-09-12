import { ResetForm } from './reset-form';

export default function ResetPasswordPage() {
  return (
    <main className="center-narrow">
      <div className="card">
        <h1>Recuperar senha</h1>
        <p className="muted small">Enviaremos um link de redefinição ao seu email.</p>
        <ResetForm />
      </div>
      <div className="card small">
        <a href="/login">Voltar ao login</a>
      </div>
    </main>
  );
}

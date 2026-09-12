import { getCurrentUser } from '@/lib/auth/context';
import { AcceptInvite } from './accept-invite';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { user } = await getCurrentUser();

  return (
    <main className="center-narrow">
      <div className="card">
        <h1>Aceitar convite</h1>
        {!user ? (
          <div className="notice info">
            Faça login (ou crie a conta com o email convidado) para aceitar.
            <div className="btn-row">
              <a className="btn primary" href={`/login?next=/invite/${token}`}>
                Entrar
              </a>
              <a className="btn" href={`/signup`}>
                Criar conta
              </a>
            </div>
          </div>
        ) : (
          <AcceptInvite token={token} />
        )}
      </div>
    </main>
  );
}

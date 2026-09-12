import { notFound } from 'next/navigation';
import { canPerformAdminAction } from '@ai/domain';
import { resolveAccess } from '@/lib/auth/context';
import { InviteForm } from './invite-form';

export default async function TeamPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) notFound();

  const canInvite = canPerformAdminAction(access.ctx, 'team.invite');

  const { data: members } = await access.supabase
    .from('organization_memberships')
    .select('id, user_id, role, status, created_at')
    .eq('organization_id', access.organization.id)
    .order('created_at');

  const { data: invites } = canInvite
    ? await access.supabase
        .from('invitations')
        .select('id, email, role, expires_at, accepted_at, revoked_at')
        .eq('organization_id', access.organization.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <>
      <div className="card">
        <h1>Equipe</h1>
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m) => (
              <tr key={m.id}>
                <td className="muted small">{m.user_id}</td>
                <td>{m.role}</td>
                <td>
                  <span className={`badge ${m.status === 'active' ? 'ok' : 'warn'}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canInvite && (
        <>
          <div className="card">
            <h2>Convidar membro</h2>
            <p className="muted small">
              Papéis manager/analyst/viewer exigem grants por cliente. O token é de uso único e
              expira em 7 dias (TEN-07).
            </p>
            <InviteForm org={access.organization.slug} />
          </div>

          <div className="card">
            <h2>Convites</h2>
            {(invites ?? []).length === 0 ? (
              <p className="muted">Nenhum convite.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Papel</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(invites ?? []).map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{i.role}</td>
                      <td>
                        {i.accepted_at ? (
                          <span className="badge ok">aceito</span>
                        ) : i.revoked_at ? (
                          <span className="badge danger">revogado</span>
                        ) : (
                          <span className="badge warn">pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}

import { notFound } from 'next/navigation';
import { canPerformAdminAction } from '@ai/domain';
import { resolveAccess } from '@/lib/auth/context';
import { ClientCreateForm } from './client-create-form';

export default async function ClientsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) notFound();

  const { data: clients } = await access.supabase
    .from('clients')
    .select('id, name, currency, timezone, business_model, status')
    .eq('organization_id', access.organization.id)
    .order('name');

  const canCreate = canPerformAdminAction(access.ctx, 'client.create');

  return (
    <>
      <div className="card">
        <h1>Clientes</h1>
        <p className="muted small">Você vê apenas os clientes autorizados ao seu acesso (TEN-05).</p>
        {(clients ?? []).length === 0 ? (
          <p className="muted">Nenhum cliente acessível.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Moeda</th>
                <th>Fuso</th>
                <th>Modelo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.currency}</td>
                  <td className="muted small">{c.timezone}</td>
                  <td className="muted">{c.business_model}</td>
                  <td>
                    <span className={`badge ${c.status === 'active' ? 'ok' : 'warn'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canCreate ? (
        <div className="card">
          <h2>Novo cliente</h2>
          <ClientCreateForm org={access.organization.slug} />
        </div>
      ) : (
        <div className="card">
          <div className="notice">Seu papel não permite criar clientes (apenas owner/admin).</div>
        </div>
      )}
    </>
  );
}

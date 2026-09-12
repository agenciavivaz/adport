import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/context';
import { readServiceRoleKey } from '@/lib/env';
import { createSupabaseServiceClient } from '@/lib/supabase/admin';
import { SignOutButton } from '@/components/sign-out-button';

/**
 * Super admin (§5). Protegido no servidor: exige papel de plataforma (RPC) e,
 * em produção, MFA (enforçado via Supabase Auth AAL — gancho preparado).
 * A listagem de organizações usa o service client APÓS a verificação de papel;
 * expõe apenas contagens e metadados operacionais, nunca leads ou tokens (ADM-01).
 */
export default async function PlatformPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: isAdmin } = await supabase.rpc('am_i_platform_admin');
  if (isAdmin !== true) {
    return (
      <main className="center-narrow">
        <div className="card">
          <h1>Acesso restrito</h1>
          <p className="muted">
            Esta área é do operador da plataforma. A atribuição do primeiro super admin ocorre por
            procedimento administrativo documentado (§5), nunca por formulário público.
          </p>
          <div className="btn-row">
            <a className="btn" href="/app">
              Voltar
            </a>
          </div>
        </div>
      </main>
    );
  }

  const serviceConfigured = !!readServiceRoleKey();
  let orgs: Array<{ id: string; name: string; slug: string; status: string }> = [];
  let serviceError: string | null = null;

  if (serviceConfigured) {
    try {
      const svc = createSupabaseServiceClient();
      const { data } = await svc
        .from('organizations')
        .select('id, name, slug, status')
        .order('name')
        .limit(100);
      orgs = data ?? [];
    } catch {
      serviceError = 'Falha ao acessar o control plane.';
    }
  }

  return (
    <div className="container">
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 16 }}>
        <strong>Plataforma · Super Admin</strong>
        <div className="nav">
          <a href="/app">App</a>
          <SignOutButton />
        </div>
      </div>

      <div className="card">
        <h1>Organizações</h1>
        <p className="muted small">
          Contagens e metadados operacionais. Sem leitura de dados comerciais sem sessão de suporte
          aprovada pelo owner (ADM-06/07).
        </p>
        {!serviceConfigured ? (
          <div className="notice">
            <code>SUPABASE_SERVICE_ROLE_KEY</code> não configurada neste ambiente. O control plane
            usa o service client apenas em superfícies auditadas; configure o segredo server-only
            para habilitar a listagem.
          </div>
        ) : serviceError ? (
          <div className="notice">{serviceError}</div>
        ) : orgs.length === 0 ? (
          <p className="muted">Nenhuma organização.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agência</th>
                <th>Slug</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td className="muted">{o.slug}</td>
                  <td>
                    <span className={`badge ${o.status === 'active' ? 'ok' : 'warn'}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Operação</h2>
        <div className="notice info">
          Saúde de conectores, DLQ, gasto de IA por tenant e fila de exclusões (ADM-02/05/09)
          entram nas fases 1.2/1.5. Ganchos de dados já existem (<code>sync_jobs</code> na fase 1.2,
          <code>usage_ledger</code>, <code>audit_events</code>).
        </div>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/context';
import { CreateOrgForm } from './create-org-form';
import { SignOutButton } from '@/components/sign-out-button';

export default async function AppHome() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, slug, name, status')
    .order('name');

  const isPlatformAdmin = await checkPlatformAdmin(supabase);

  return (
    <div className="container">
      <div className="topbar" style={{ borderRadius: 12, marginBottom: 16 }}>
        <strong>Agency Intelligence</strong>
        <div className="nav">
          <span className="muted small">{user.email}</span>
          {isPlatformAdmin && <a href="/platform">Plataforma</a>}
          <SignOutButton />
        </div>
      </div>

      <div className="card">
        <h1>Suas agências</h1>
        {(orgs ?? []).length === 0 ? (
          <p className="muted">
            Você ainda não participa de nenhuma agência. Crie a primeira abaixo ou aceite um convite.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Agência</th>
                <th>Slug</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(orgs ?? []).map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td className="muted">{o.slug}</td>
                  <td>
                    <span className={`badge ${o.status === 'active' ? 'ok' : 'warn'}`}>{o.status}</span>
                  </td>
                  <td>
                    <a href={`/app/${o.slug}/overview`}>Abrir</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Criar nova agência</h2>
        <CreateOrgForm />
      </div>
    </div>
  );
}

async function checkPlatformAdmin(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
): Promise<boolean> {
  // Tabelas de control plane são default-deny; RPC SECURITY DEFINER expõe só um booleano.
  const { data } = await supabase.rpc('am_i_platform_admin');
  return data === true;
}

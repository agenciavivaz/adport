import { notFound } from 'next/navigation';
import { resolveAccess } from '@/lib/auth/context';
import { OrgNav } from '@/components/org-nav';
import { SignOutButton } from '@/components/sign-out-button';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) notFound(); // 404 sem revelar existência (§14.1)

  const suspended = access.subscriptionStatus === 'suspended';

  return (
    <div>
      <div className="topbar">
        <div>
          <strong>{access.organization.name}</strong>{' '}
          <span className="muted small">· {access.ctx.role}</span>
        </div>
        <div className="nav">
          <span className="muted small">{access.user.email}</span>
          <a href="/app">Trocar agência</a>
          <SignOutButton />
        </div>
      </div>
      <OrgNav slug={access.organization.slug} />
      {suspended && (
        <div className="container">
          <div className="notice">
            Organização suspensa: novas análises e alterações estão bloqueadas. O owner mantém acesso
            à cobrança e às rotas de exportação/exclusão (TEN-10).
          </div>
        </div>
      )}
      <div className="container">{children}</div>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { resolveAccess } from '@/lib/auth/context';

export default async function OverviewPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const access = await resolveAccess(org);
  if (!access) notFound();

  const accessibleClients = access.ctx.clientIds.size;

  const { count: clientCount } = await access.supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', access.organization.id);

  return (
    <>
      <div className="card">
        <h1>Visão geral da carteira</h1>
        <p className="muted small">
          Fonte: plataforma · Escopo: clientes autorizados a você · Fuso e moeda por cliente.
        </p>
      </div>

      <div className="grid">
        <div className="card">
          <div className="muted small">Clientes acessíveis</div>
          <div className="kpi">{accessibleClients}</div>
        </div>
        <div className="card">
          <div className="muted small">Assinatura</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            <span className={`badge ${access.subscriptionStatus === 'active' ? 'ok' : 'warn'}`}>
              {access.subscriptionStatus}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="muted small">Seu papel</div>
          <div className="kpi" style={{ fontSize: 20 }}>
            {access.ctx.role}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Indicadores de mídia</h2>
        <div className="notice info">
          <strong>Indisponível nesta fase.</strong> A ingestão de Google Ads (fase 1.2) e Meta
          (fase 1.3) ainda não está ativa neste ambiente. Métricas de gasto, alertas e freshness
          aparecerão aqui após conectar uma fonte real — nenhum dado fictício é exibido (PRD §21.2).
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          Total de clientes na agência (contagem): {clientCount ?? 0}.
        </p>
      </div>
    </>
  );
}

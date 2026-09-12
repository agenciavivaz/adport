import { notFound } from 'next/navigation';
import { hasCapability } from '@ai/domain';
import { readGoogleAdsConfig } from '@ai/adport-adapter';
import { resolveClientAccess } from '@/lib/auth/context';
import { ConnectGoogleButton } from './connect-google';
import { MediaImport } from './media-import';

export default async function ClientConnectionsPage({
  params,
}: {
  params: Promise<{ org: string; client: string }>;
}) {
  const { org, client } = await params;
  const access = await resolveClientAccess(org, client);
  if (!access) notFound();

  const canManage = hasCapability(access.ctx, 'connections.manage', client);
  const googleConfigured = readGoogleAdsConfig() !== null;

  const { data: clientRow } = await access.supabase
    .from('clients')
    .select('name, currency')
    .eq('id', client)
    .single();

  const { data: connections } = await access.supabase
    .from('connections')
    .select('id, provider, status, last_synced_at')
    .eq('organization_id', access.organization.id)
    .eq('client_id', client)
    .order('provider');

  const { data: issues } = await access.supabase
    .from('data_quality_issues')
    .select('id, rule, severity, state, object_type')
    .eq('organization_id', access.organization.id)
    .eq('client_id', client)
    .eq('state', 'open')
    .limit(20);

  return (
    <>
      <div className="card">
        <h1>Conexões · {clientRow?.name ?? 'Cliente'}</h1>
        <p className="muted small">
          Cada conexão pertence a este cliente. Autorizar uma conta em outro cliente exige fluxo
          próprio (§4.1). Moeda do cliente: {clientRow?.currency ?? '—'}.
        </p>
        {(connections ?? []).length === 0 ? (
          <p className="muted">Nenhuma conexão. Conecte uma fonte ou importe CSV abaixo.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Status</th>
                <th>Última sync</th>
              </tr>
            </thead>
            <tbody>
              {(connections ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.provider}</td>
                  <td>
                    <span
                      className={`badge ${
                        c.status === 'connected' ? 'ok' : c.status === 'error' ? 'danger' : 'warn'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="muted small">{c.last_synced_at ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Google Ads</h2>
        {!canManage ? (
          <div className="notice">Seu papel não gerencia conexões (requer connections.manage).</div>
        ) : !googleConfigured ? (
          <div className="notice">
            Google Ads não configurado neste ambiente (<code>GOOGLE_ADS_*</code> ausentes). O botão
            de conectar fica indisponível até o app OAuth do proprietário ser configurado (ADS-08).
          </div>
        ) : (
          <ConnectGoogleButton org={org} client={client} />
        )}
      </div>

      {canManage && (
        <div className="card">
          <h2>Importar CSV de mídia</h2>
          <p className="muted small">
            Modelo <code>media.v1</code>: date, campaign_external_id, campaign_name, spend,
            impressions, clicks, conversions, conversion_value. Namespace separado do conector;
            reimportar a mesma chave (date+campaign) substitui, não duplica.
          </p>
          <MediaImport org={org} client={client} currency={clientRow?.currency ?? 'BRL'} />
        </div>
      )}

      <div className="card">
        <h2>Qualidade de dados</h2>
        {(issues ?? []).length === 0 ? (
          <p className="muted">Nenhum problema aberto.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Regra</th>
                <th>Objeto</th>
                <th>Gravidade</th>
              </tr>
            </thead>
            <tbody>
              {(issues ?? []).map((i) => (
                <tr key={i.id}>
                  <td>{i.rule}</td>
                  <td className="muted">{i.object_type}</td>
                  <td>
                    <span className={`badge ${i.severity === 'critical' ? 'danger' : 'warn'}`}>
                      {i.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

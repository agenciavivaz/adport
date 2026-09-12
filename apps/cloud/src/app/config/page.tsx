import { readPublicEnv } from '@/lib/env';

/** Diagnóstico de configuração — PRD §18.3 (nunca simular). */
export default function ConfigPage() {
  const { diagnostic } = readPublicEnv();

  if (diagnostic.ok) {
    return (
      <main className="center-narrow">
        <div className="card">
          <h1>Configuração OK</h1>
          <p className="muted">As variáveis públicas necessárias estão presentes.</p>
          <div className="btn-row">
            <a className="btn primary" href="/app">
              Ir para a aplicação
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="center-narrow">
      <div className="card">
        <h1>Configuração ausente</h1>
        <p className="muted">
          O aplicativo não inicia sem as variáveis abaixo. Não há dados simulados — preencha o
          ambiente e recarregue. Veja <code>.env.example</code> e <code>docs/runbooks/local-dev.md</code>.
        </p>
        <ul>
          {diagnostic.missing.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
        <div className="notice info small">
          Segredos server-only (service_role, client secrets, dispatcher) nunca usam o prefixo
          <code> NEXT_PUBLIC_</code>.
        </div>
      </div>
    </main>
  );
}

# ADR-0001 — Modelo multiempresa: plataforma → agência → cliente

- **Status:** aceito
- **Data:** 2026-09-12
- **Contexto:** PRD §4. O isolamento por organização do upstream não resolve o
  acesso entre clientes da mesma agência.

## Decisão

Dois níveis de escopo, ambos materializados em colunas e FKs:

- `organization_id` — a agência (tenant). Delimita todo dado de negócio.
- `client_id` — o negócio atendido dentro da agência. Delimita dados comerciais.

Regras invariantes:

- **TEN-01:** toda tabela de negócio tem `organization_id` e, quando aplicável,
  `client_id` **não nulos**.
- **TEN-02:** FKs **compostas** (`(organization_id, client_id)` e derivadas)
  impedem que um filho referencie cliente de outra organização. Validação de
  frontend não substitui integridade no banco.
- Um usuário pode participar de várias organizações com papéis diferentes
  (`organization_memberships`).
- Acesso do membro a clientes é por **grant explícito** (`client_access_grants`),
  exceto `agency_owner`/`agency_admin` que alcançam todos os clientes da agência.
- Uma conta externa de ads tem **uma** associação ativa de cliente por
  organização; transferência é fluxo explícito, auditado.

## Consequências

- Consultas sempre filtram por escopo derivado da sessão (ADR-0002), nunca por ID
  de URL como autorização (TEN-05).
- Consolidação de agência abrange só clientes autorizados ao usuário; cache,
  export, busca, IA e jobs herdam o mesmo escopo.
- Trade-off: verbosidade de FKs compostas e índices; aceito em favor de
  isolamento garantido no banco (gate G1).

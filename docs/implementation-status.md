# Status de implementação — Agency Intelligence

> Fonte de verdade rastreável do progresso, conforme PRD §21.1. Cada item traz
> requisito, estado e evidência. **Tela pronta não é tarefa concluída**: backend,
> persistência, autorização, estados de erro e testes fazem parte da tarefa.

**Última atualização:** 2026-09-12
**Etapa atual:** Etapa 1 · Fase 1.1 (Fundação SaaS e super admin)
**Base:** repositório iniciado do zero (não havia commits). Incorporação do
upstream Adport documentada como pendência externa em `docs/adport-upstream.md`.

## Legenda de estado

- ✅ concluído e verificável neste repositório
- 🟡 parcial / em andamento
- ⛔ bloqueado por dependência externa (credencial/acesso) — código independente segue
- ⬜ não iniciado (fase futura)

---

## Fase 0 — Inspeção e preparação

| Entrega | Estado | Evidência / observação |
|---|---|---|
| Registrar commit upstream, licença e inventário de dependências | 🟡 | `docs/adport-upstream.md`. SHA do upstream **não fixado**: acesso a `ynnickw/adport` fora do escopo desta sessão (só `agenciavivaz/adport`). Registrado como bloqueio externo; adapter isolado em `packages/adport-adapter`. |
| Rodar build/testes do upstream e documentar baseline | ⛔ | Depende do acesso ao upstream. Baseline deste repositório derivado documentada abaixo. |
| Mapear schema, papéis, OAuth, cofre e caminhos de leitura/escrita do upstream | 🟡 | Contratos-alvo desenhados em `packages/adport-adapter` e ADR-0004; mapeamento 1:1 do código upstream pendente do acesso. |
| ADRs: agência/cliente, autorização backend, fila/worker, segredos, billing, fork | ✅ | `docs/adr/0001`–`0006`. |
| Scaffold de ambientes, CI e `.env.example` | ✅ | `.env.example`, `.github/workflows/ci.yml`, `pnpm-workspace.yaml`, `tsconfig.base.json`. |
| Fixtures: 2 agências, 2 clientes/agência, papéis variados, IDs externos repetidos entre tenants | ✅ | `supabase/seed.sql` (sintético). |
| Contratos iniciais de métricas, eventos, adapters e source IDs preservados | 🟡 | `packages/shared` (roles, permissões, schemas de eventos/ingestão, `SourceAdapter`). Camada de métricas determinística: fase 1.3+. |

**Gate G0** — aplicação local sobe; baseline documentada; testes de isolamento planejados;
nenhuma dependência crítica sem licença; arquitetura cabe nos limites dos planos.
**Estado:** 🟡 estrutura, migrations, app e testes de isolamento presentes e **executados**:
`pnpm typecheck` + `pnpm build` (13 rotas + middleware) + 28 testes unitários verdes; as 5
migrations + seed aplicam sem erro num Postgres com stubs Supabase. Falta subir Supabase
local completo + Vercel para validar limites de plano em execução real.

---

## Etapa 1 · Fase 1.1 — Fundação SaaS e super admin

Requisitos: TEN-01..TEN-10; ADM-01, ADM-03, ADM-04, ADM-06..ADM-09; onboarding + mapa de telas básico.

| Entrega | Estado | Evidência |
|---|---|---|
| Auth, recuperação, convites, seleção de organização e cliente | 🟡 | `apps/cloud`: `/login`, `/signup`, `/reset-password`, `/invite/[token]`; middleware de sessão; API de convites. Envio de e-mail depende de provedor (⛔ flag desligada). |
| Memberships, papéis, grants e RLS por cliente | ✅ | `supabase/migrations/0002_*`, `0003_*`; `packages/domain` (matriz de permissões). |
| CRUD de clientes, equipe, marca e objetivos | 🟡 | Clientes, equipe e marca: API + telas. Objetivos/metas por cliente: fase 1.3 (ADS-12). |
| Super admin com MFA, organizações, flags e suporte temporário de leitura | 🟡 | Rota `/platform` protegida no servidor; `platform_admins`, `feature_flags`, `support_access_sessions`. Enforcement de MFA: gancho preparado, exige config Supabase Auth (⛔). |
| Auditoria e Storage privado | ✅ | `audit_events` (append-only aplicacional) + helper de auditoria. Buckets privados definidos em migration de storage. |
| Esqueleto de entitlements para trial, sem cobrança real | ✅ | `plans`/`plan_versions`/`saas_subscriptions`; checagem de entitlement no servidor (`packages/domain`). |

**Gate G1** — isolamento entre agências e entre clientes da mesma agência; super admin
sem dados comerciais sem grant de suporte.
**Estado:** 🟡 RLS + FKs compostas implementadas e **exercitadas com RLS real** (papel
`authenticated` + claim `sub`): T01 (agência A não vê nada da B), T02 (analista sem grant não
vê cliente da própria agência), escalada por INSERT bloqueada por RLS, auditoria append-only
(UPDATE/DELETE recusados), aceite de convite concede só o cliente do grant, reserva de quota
idempotente — todos verificados. Suite pgTAP (`supabase/tests/isolation_test.sql`) escrito para
CI; T04/T05 (super admin/suporte) dependem do serviço de suporte (fase 1.5).

---

## Fases seguintes (não iniciadas — resumo)

| Fase | Objetivo | Estado |
|---|---|---|
| 1.2 Google Ads e pipeline de dados | Primeira fonte real (OAuth, filas, fatos) | ⬜ (adapter boundary e schema de jobs preparados) |
| 1.3 Dashboards, Meta e comparação | Análise multicanal com semântica correta | ⬜ |
| 1.4 IA, alertas e relatórios | Diagnóstico acionável com evidências | ⬜ (schema de diagnóstico e contrato de tools definidos em `packages/shared`) |
| 1.5 Cobrança, operação e piloto | SaaS contratável | ⬜ (adapter de billing e ledger de uso preparados) |
| 1.6 Operações de ads com aprovação | Execução controlada | ⬜ |
| 2.1–2.5 CRM/analytics/receita/retenção | Cadeia comercial completa | ⬜ (tabelas conceituais e contratos de evento reservados) |

---

## Baseline técnica deste repositório

- Node 22 / pnpm 10. Monorepo pnpm workspaces.
- `pnpm install` → `pnpm typecheck` → `pnpm build` como pipeline local (ver CI).
- Migrations SQL como fonte de verdade; tipos TS gerados a partir do schema (script documentado em runbook).

## Bloqueios externos registrados (não impedem módulos independentes — PRD §21.2)

1. **Upstream Adport** (`ynnickw/adport`) fora do escopo de acesso desta sessão →
   SHA não fixado; pacotes Google/Meta não incorporados. Fronteira isolada em
   `packages/adport-adapter`. **Ação do proprietário:** conceder acesso/fazer fork privado.
2. **Credenciais OAuth (Google/Meta/Kommo/HubSpot/GA4), Stripe, e-mail e provedor de IA**
   ausentes → flags de produção desligadas; fixtures sintéticas explícitas. **Ação:** provisionar apps e secrets por ambiente.
3. **Supabase/Vercel projetos** não provisionados nesta sessão → execução de migrations,
   RLS e limites de plano validada apenas por revisão estática + testes escritos.

Nenhum dado demo é apresentado como integração concluída (PRD §21.2).

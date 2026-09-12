# Agency Intelligence

SaaS multiempresa de inteligência de **mídia paga, vendas e retenção** para
agências. Relaciona a cadeia investimento → visitas → leads → oportunidades →
vendas → recebimentos → retenção, com IA que transforma evidências em decisões.

- **Stack:** Supabase (Postgres + Auth + Storage + Queues) · Next.js/Vercel · GitHub.
- **Base técnica:** Adport, incorporado de forma controlada (ver `docs/adport-upstream.md`).
- **Especificação:** este repositório implementa o PRD do produto por fases (G0→G11).

> Nome de trabalho configurável. `Apache-2.0` (ver `LICENSE`/`NOTICE`).

## Estado atual

Veja **`docs/implementation-status.md`** para o mapa completo por fase, com
evidências e bloqueios. Resumo:

- **Fase 0 (fundação):** monorepo, ADRs, `.env.example`, CI, fixtures — ✅/🟡.
- **Fase 1.1 (fundação SaaS + super admin):** auth, organizações, papéis, grants,
  RLS por cliente, clientes, equipe, convites, super admin, entitlements de trial,
  auditoria e Storage privado — 🟡 (código + testes escritos; execução em Supabase
  local pendente nesta sessão).
- Fases 1.2+ (Google/Meta, dashboards, IA, cobrança, CRM, atribuição, retenção): ⬜.

## Estrutura

```
apps/cloud/               # Next.js: app, portal, super admin, API /api/v1
packages/shared/          # Papéis, permissões, schemas de eventos, contratos
packages/domain/          # Autorização, invariantes de equipe, entitlements (puro)
packages/adport-adapter/  # Fronteira de integração com provedores upstream
supabase/migrations/      # DDL + RLS + funções + grants (fonte de verdade)
supabase/tests/           # Testes de isolamento (pgTAP)
supabase/seed.sql         # Fixtures sintéticas
docs/                     # ADRs, upstream, runbooks, status
```

## Começar

```bash
pnpm install
cp .env.example .env.local     # sem valores => a app abre /config (não simula)
pnpm typecheck && pnpm test    # unit (shared, domain, adapter)
# Banco local + testes de RLS: ver docs/runbooks/local-dev.md
pnpm dev
```

## Princípios inegociáveis (do PRD)

- Isolamento plataforma → agência → cliente garantido no **banco** (RLS + FKs
  compostas), não só no frontend.
- Nunca somar moedas/conversões distintas; `null` = indisponível, zero = observado.
- Integração real ou nada: sem dados demo apresentados como integração concluída;
  configuração ausente gera diagnóstico, não simulação.
- IA propõe, humano aprova; respostas com evidências rastreáveis.

# Runbook — Desenvolvimento local

## Pré-requisitos

- Node 22 (`.nvmrc`), pnpm 10.
- [Supabase CLI](https://supabase.com/docs/guides/local-development) para banco local.
- Docker (para o stack Supabase local).

## Passos

```bash
# 1. Dependências
pnpm install

# 2. Ambiente
cp .env.example .env.local   # preencher os valores; sem valores => diagnóstico de config

# 3. Supabase local (aplica migrations de supabase/migrations e seed sintético)
supabase start
supabase db reset            # aplica migrations + supabase/seed.sql

# 4. Tipos TypeScript a partir do schema (fonte de verdade = migrations)
supabase gen types typescript --local > packages/shared/src/database.types.ts

# 5. Verificações
pnpm typecheck
pnpm lint
pnpm test                    # inclui unit (domain) e pgTAP (supabase/tests) quando DB local

# 6. App
pnpm dev                     # http://localhost:3000
```

## Testes de isolamento (Gate G1)

```bash
# Requer stack local rodando (pgTAP habilitado em migration 0001)
supabase test db             # roda supabase/tests/*.sql
```

## Geração de tipos

Sempre regenerar `packages/shared/src/database.types.ts` após alterar migrations.
Nunca editar esse arquivo à mão.

## Observações de segurança

- Preview deployments **nunca** recebem dados/credenciais de clientes reais.
- Secrets por ambiente (dev/staging/prod) são distintos.
- `service_role` só no servidor; jamais no bundle do browser.

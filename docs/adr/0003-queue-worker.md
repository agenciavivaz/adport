# ADR-0003 — Fila e worker serverless

- **Status:** aceito
- **Data:** 2026-09-12
- **Contexto:** PRD §6.1, §6.2, §17.2. Funções serverless têm limite de execução;
  não pode haver processo permanente.

## Decisão

- **Fila:** Supabase Queues / `pgmq` (fila baseada em Postgres). A aplicação
  implementa consumo e semântica de efeitos.
- **Agendamento:** Supabase Cron **enfileira** tarefas; nunca roda análise pesada
  dentro de transação SQL.
- **Dispatcher:** função leve (Supabase Function ou rota interna autenticada)
  reserva jobs elegíveis com **lease + lock**, e chama o worker autenticado com o
  `INTERNAL_DISPATCHER_SECRET`.
- **Worker:** Vercel Node function autenticada, lotes curtos (meta: ≤30 s/unidade,
  abaixo do limite do plano). Sem promise sem `await` após a resposta HTTP.
- **Idempotência:** cada job carrega IDs internos e referência ao segredo, nunca
  refresh token no payload. Persistir dados + checkpoint + registro de efeito na
  mesma transação, e só então confirmar o item. Lease expirado ⇒ reentrega;
  efeitos idempotentes (sem promessa de exactly-once ponta a ponta).
- **DLQ:** com código, contexto redigido e reprocesso idempotente.
- **Fairness:** limitar concorrência por tenant; backfill grande não monopoliza.
- **Um único scheduler por fluxo:** se adotar Vercel Cron como alternativa, não
  manter dois schedulers ativos para o mesmo fluxo (§17.2 [S10]).

## Consequências

- `sync_jobs` guarda `lease`, `attempts`, `next_run_at`, `error_code`, `cursor`,
  `partition`. Locks por conexão/partição evitam execução concorrente.
- Validação de limites de plano (Vercel/Supabase) fica como tarefa de Gate G0/G2
  em execução real.

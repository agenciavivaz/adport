# ADR-0006 — Estratégia de fork e incorporação do Adport

- **Status:** aceito (com bloqueio externo registrado)
- **Data:** 2026-09-12
- **Contexto:** PRD §3.2.

## Decisão

- O produto vive em repositório **derivado privado** do proprietário
  (`agenciavivaz/adport`). Não publicar nem modificar o upstream.
- A incorporação do código upstream ocorre por **commit fixado** (SHA + data +
  licença + patches em `docs/adport-upstream.md`); nenhuma dependência aponta para
  `main` sem pin.
- Provedores upstream entram atrás de `packages/adport-adapter`. UI e domínio
  comercial **não** importam implementações de provedor diretamente.
- Alterações de upstream entram por **PR com testes de contrato e regressão**;
  nunca por atualização automática em produção.

## Estado / bloqueio

Acesso ao upstream `ynnickw/adport` fora do escopo desta sessão. Portanto:

- Domínio SaaS (organizações, clientes, permissões, RLS, billing, super admin)
  construído **de forma independente** primeiro, como o PRD permite para módulos
  independentes (§21.2).
- Fronteira do adapter definida por contratos (`SourceAdapter`) para plugar os
  pacotes upstream sem reescrever o domínio.
- Pin do SHA e reuso de código upstream: **ação do proprietário** (fork/acesso).

## Consequências

- Risco "Adport não ser produção pronta" mitigado por gates G0–G3 e inventário
  antes de assumir maturidade (PRD §22).

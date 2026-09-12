# ADR-0002 — Autorização no servidor + RLS

- **Status:** aceito
- **Data:** 2026-09-12
- **Contexto:** PRD §4.3 (TEN-03..TEN-06), §16.1.

## Decisão

Autorização em duas camadas que se reforçam:

1. **RLS no Postgres** (defesa de dados). Toda tabela exposta tem RLS habilitada
   com políticas por ação (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) que validam estado
   novo e antigo. Funções `SECURITY DEFINER` estáveis derivam o contexto do
   `auth.uid()` da sessão verificada — nunca de claims editáveis pelo cliente
   (TEN-04). Ex.: `app.current_membership(org)`, `app.has_client_access(org, client)`.
2. **Autorização de aplicação** (defesa de rota). Todo route handler normaliza o
   contexto de acesso no servidor a partir da sessão (`packages/domain`), resolve
   organização + clientes autorizados + capacidades, e retorna `404` para objeto
   fora de escopo sem revelar existência (§14.1).

Regras:

- **TEN-06:** APIs de aplicação **não** usam `service_role` como atalho. Usam o JWT
  do usuário com RLS. Workers e super admin usam interfaces próprias auditadas com
  verificação equivalente.
- **TEN-05:** IDs de URL são seletores, não autorização.
- **TEN-09:** trocar de tenant no navegador limpa contexto, queries e conversas.
- Super admin **não** tem RLS universal `is_super_admin() => true` nas tabelas de
  clientes (§5). Leitura assistida passa por serviço de suporte que verifica grant
  temporário (`support_access_sessions`) em cada requisição.

## Consequências

- Dois pontos de verdade (RLS + app) exigem testes pgTAP dedicados (T01–T05).
- Nenhuma view exposta ignora o chamador; views de conveniência são
  `security_invoker` ou servidas por API autorizada.

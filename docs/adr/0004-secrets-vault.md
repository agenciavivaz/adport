# ADR-0004 — Cofre e segredos por tenant

- **Status:** aceito (com ponto de verificação em produção)
- **Data:** 2026-09-12
- **Contexto:** PRD §6.3. Preservar/melhorar a criptografia por tenant do runtime
  Adport; nunca migrar tokens para colunas legíveis pelo navegador.

## Decisão

- Tokens de provedores e client secrets cifrados como **AES-GCM** com **AAD**
  vinculada a `(organization_id, client_id, provider, connection_id)`. Chave
  versionada no **Supabase Vault**, acessível apenas por interface backend restrita.
- `connections.secret_ref` guarda apenas a **referência**; metadados públicos da
  conexão ficam separados do material secreto. A função de leitura verifica papel
  de serviço + escopo + job autorizado; **não** aceita `secret_id` arbitrário vindo
  do browser.
- `service_role`, login backend, segredo do dispatcher e client secrets **somente
  no servidor**. `NEXT_PUBLIC_*` restrito à URL Supabase e chave anon.
- Refresh de token com **lock por conexão**, persistência imediata da rotação e
  prevenção de refresh concorrente que perca credencial válida (§16.1).

## Ponto de verificação

Confrontar com as exigências de produção do upstream [S2]. Se identidade/rotação
não puderem ser atendidas com segurança pelo Vault, **registrar bloqueio** e adotar
KMS externo por adapter; não declarar equivalência a KMS dedicado sem validação.
Não expor as views de decifração do Vault [S9].

## Consequências

- Interface de cofre isolada (`packages/adport-adapter` + serviço backend). Nenhum
  token trafega para o cliente, analytics, traces, erros ou prompts de IA.

# ADR-0005 — Cobrança por adapter (Stripe inicial)

- **Status:** aceito
- **Data:** 2026-09-12
- **Contexto:** PRD §2.3.6, §15. Cobrança é serviço externo, fora da stack de
  hospedagem.

## Decisão

- Interface `BillingProvider` (checkout, portal, sync de assinatura, webhook)
  com implementação inicial **Stripe**. Disponibilidade de conta/meios de pagamento
  deve ser validada antes de habilitar.
- **Não** armazenar cartão; checkout/portal hospedados pelo provedor (BILL-01).
- Estados separados: contratual (`trialing/active/canceled/...`), acesso e
  pagamento (BILL-02). Webhook validado, deduplicado e conciliado com o estado atual
  do provedor; redirect de checkout não concede plano (BILL-03).
- Entitlement validado no servidor em toda operação limitada; concorrência não pode
  ultrapassar limite (BILL-04). Reserva de quota atômica.
- `plans`/`plan_versions` versionados: editar catálogo não muda assinaturas
  existentes (BILL-07). Créditos/estornos são registros em `usage_ledger`/`billing_events`,
  não edição retroativa (BILL-08).
- Receita da **plataforma** usa `saas_subscriptions`; **nunca** misturar com receita
  dos clientes atendidos (ADM-08).

## Consequências

- Nesta fase (1.1) só o **esqueleto de entitlements** de trial é exigido; cobrança
  real fica na fase 1.5 com a flag desligada até validação de conta Stripe.

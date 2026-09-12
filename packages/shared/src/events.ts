/**
 * Contratos de eventos de ingestão genérica — PRD §14.2.
 *
 * Organização/cliente são derivados da credencial; um campo desses no payload
 * NÃO muda o escopo. Contratos monetários exigem moeda e precisão; valores
 * desconhecidos não recebem zero padrão.
 */
import { z } from 'zod';

export const EVENT_TYPES = [
  'lead.created',
  'deal.updated',
  'payment.received',
  'payment.refunded',
  'contract.started',
  'contract.ended',
  'contract.reactivated',
  'activity.recorded',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Dinheiro: valor original + moeda ISO + escala; nunca ponto flutuante em finanças. */
export const moneySchema = z.object({
  /** Valor em unidade menor (ex.: centavos) OU string decimal exata. */
  amount: z.union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number().int()]),
  currency: z.string().length(3).toUpperCase(),
  /** Casas decimais da moeda (BRL/USD = 2). */
  scale: z.number().int().min(0).max(6).default(2),
});
export type Money = z.infer<typeof moneySchema>;

const baseEnvelope = z.object({
  schema_version: z.literal('1.0'),
  event_id: z.string().min(1).max(255),
  occurred_at: z.string().datetime({ offset: true }),
  source: z.string().min(1).max(120),
  external_object_id: z.string().min(1).max(255).optional(),
});

const leadCreated = baseEnvelope.extend({
  event_type: z.literal('lead.created'),
  payload: z.object({
    lead_capture_id: z.string().max(255).optional(),
    external_customer_id: z.string().max(255).optional(),
    campaign_external_id: z.string().max(255).optional(),
    provider: z.string().max(60).optional(),
  }),
});

const dealUpdated = baseEnvelope.extend({
  event_type: z.literal('deal.updated'),
  payload: z.object({
    external_deal_id: z.string().min(1).max(255),
    stage_external_id: z.string().max(255).optional(),
    amount: moneySchema.optional(),
    won_at: z.string().datetime({ offset: true }).optional(),
    lost_at: z.string().datetime({ offset: true }).optional(),
    loss_reason: z.string().max(500).optional(),
  }),
});

const paymentReceived = baseEnvelope.extend({
  event_type: z.literal('payment.received'),
  payload: z.object({
    external_payment_id: z.string().min(1).max(255),
    amount: moneySchema, // obrigatório: contrato monetário
    external_customer_id: z.string().max(255).optional(),
    external_deal_id: z.string().max(255).optional(),
    contract_external_id: z.string().max(255).optional(),
  }),
});

const paymentRefunded = baseEnvelope.extend({
  event_type: z.literal('payment.refunded'),
  payload: z.object({
    external_payment_id: z.string().min(1).max(255),
    amount: moneySchema, // valor a estornar (positivo; sinal aplicado no ledger)
    refund_external_id: z.string().max(255).optional(),
  }),
});

const contractStarted = baseEnvelope.extend({
  event_type: z.literal('contract.started'),
  payload: z.object({
    contract_external_id: z.string().min(1).max(255),
    external_customer_id: z.string().max(255).optional(),
    recurring_amount: moneySchema.optional(),
    interval: z.enum(['monthly', 'annual', 'variable']).optional(),
    service_started_at: z.string().datetime({ offset: true }).optional(),
  }),
});

const contractEnded = baseEnvelope.extend({
  event_type: z.literal('contract.ended'),
  payload: z.object({
    contract_external_id: z.string().min(1).max(255),
    effective_end_at: z.string().datetime({ offset: true }).optional(),
    reason: z.string().max(500).optional(),
  }),
});

const contractReactivated = baseEnvelope.extend({
  event_type: z.literal('contract.reactivated'),
  payload: z.object({
    contract_external_id: z.string().min(1).max(255),
    reactivated_at: z.string().datetime({ offset: true }).optional(),
  }),
});

const activityRecorded = baseEnvelope.extend({
  event_type: z.literal('activity.recorded'),
  payload: z.object({
    external_customer_id: z.string().max(255).optional(),
    activity_type: z.string().max(120),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const ingestionEventSchema = z.discriminatedUnion('event_type', [
  leadCreated,
  dealUpdated,
  paymentReceived,
  paymentRefunded,
  contractStarted,
  contractEnded,
  contractReactivated,
  activityRecorded,
]);
export type IngestionEvent = z.infer<typeof ingestionEventSchema>;

/** Evento público de tracking (chave de site não secreta) — PRD §9.2 AN-06. */
export const publicTrackingEventSchema = z.object({
  schema_version: z.literal('1.0'),
  event_id: z.string().min(1).max(255),
  event_type: z.enum(['page_view', 'session_start', 'touchpoint', 'form_submit']),
  occurred_at: z.string().datetime({ offset: true }),
  lead_capture_id: z.string().max(255).optional(),
  utms: z
    .object({
      source: z.string().max(255).optional(),
      medium: z.string().max(255).optional(),
      campaign: z.string().max(255).optional(),
      term: z.string().max(255).optional(),
      content: z.string().max(255).optional(),
    })
    .optional(),
  click_ids: z
    .object({
      gclid: z.string().max(512).optional(),
      gbraid: z.string().max(512).optional(),
      wbraid: z.string().max(512).optional(),
      fbclid: z.string().max(512).optional(),
    })
    .optional(),
  // Nunca coletar conteúdo de formulário, senha ou parâmetros arbitrários (AN-07).
});
export type PublicTrackingEvent = z.infer<typeof publicTrackingEventSchema>;

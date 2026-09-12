/**
 * Schema de diagnóstico de IA — PRD §12.3.
 *
 * Valores numéricos da resposta devem existir nas evidências ou ser cálculos
 * determinísticos registrados. Referência inválida/acesso negado/dado insuficiente
 * => resposta limitada, nunca fallback com dados de outro tenant.
 */
import { z } from 'zod';

export const suggestedActionSchema = z.object({
  description: z.string().min(1),
  requires_approval: z.literal(true), // IA nunca aprova/executa (AI-07)
  action_type: z.enum(['investigate', 'test', 'propose_change']),
});

export const diagnosisSchema = z.object({
  schema_version: z.literal('1.0'),
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(['info', 'warning', 'critical']),
  evidence_ids: z.array(z.string().uuid()),
  data_quality: z.enum(['sufficient', 'partial', 'insufficient']),
  limitations: z.array(z.string()),
  hypotheses: z.array(z.string()),
  suggested_actions: z.array(suggestedActionSchema),
  causality_claim: z.literal(false), // atribuição observacional não prova causalidade
});
export type Diagnosis = z.infer<typeof diagnosisSchema>;

/** Ferramentas de leitura da IA (allowlist) — PRD §12.2. Contexto injetado pelo servidor. */
export const AI_TOOLS_STAGE1 = [
  'get_media_summary',
  'compare_campaigns',
  'get_data_quality',
  'get_finding_evidence',
] as const;

export const AI_TOOLS_STAGE2 = [
  'get_funnel',
  'get_attribution',
  'get_cohort_retention',
  'get_revenue_reconciliation',
] as const;

export type AiTool = (typeof AI_TOOLS_STAGE1)[number] | (typeof AI_TOOLS_STAGE2)[number];

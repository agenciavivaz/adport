/**
 * Entitlements e limites de plano — PRD §15 (BILL-04, BILL-06, BILL-09).
 *
 * Validado no servidor em toda operação limitada. Concorrência não pode permitir
 * ultrapassar limite: a checagem deve ocorrer numa transação/reserva atômica no
 * banco (ver migration de usage). Aqui ficam as regras puras.
 */

export interface PlanLimits {
  activeClients: number | null; // null = ilimitado (Custom)
  adAccounts: number | null;
  internalUsers: number | null;
  aiRunsPerMonth: number | null;
  portalUsers: number | null;
  /** Teto monetário interno de IA por mês (centavos BRL). */
  aiMonthlyBudgetCents: number | null;
  /** Flags de recurso do plano. */
  features: {
    stage2: boolean;
    externalMutations: boolean;
    branding: boolean;
    portal: boolean;
  };
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'suspended'
  | 'none';

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
}

/** Estados que permitem operações normais. */
export function isActiveSubscription(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active';
}

/**
 * Checa se uma nova unidade cabe no limite. `current` é a contagem já usada.
 * Rejeita quando current >= limit (BILL-04); ilimitado (null) sempre permite.
 */
export function checkQuota(
  current: number,
  limit: number | null,
  resource: string,
): EntitlementCheck {
  if (limit === null) return { allowed: true };
  if (current >= limit) {
    return { allowed: false, reason: `quota_exceeded:${resource}` };
  }
  return { allowed: true };
}

/**
 * BILL-05/TEN-10: durante carência (past_due) ou suspensão, sem mutações externas
 * nem novas análises; leitura permitida preservada (BILL-09).
 */
export function canMutateExternally(status: SubscriptionStatus, features: PlanLimits['features']): EntitlementCheck {
  if (!features.externalMutations) {
    return { allowed: false, reason: 'feature_disabled:external_mutations' };
  }
  if (status === 'suspended') return { allowed: false, reason: 'subscription_suspended' };
  if (status === 'past_due') return { allowed: false, reason: 'subscription_past_due_grace' };
  if (status === 'canceled') return { allowed: false, reason: 'subscription_canceled' };
  return { allowed: true };
}

export function canRunAiAnalysis(
  status: SubscriptionStatus,
  runsThisMonth: number,
  limits: PlanLimits,
): EntitlementCheck {
  if (status === 'suspended') return { allowed: false, reason: 'subscription_suspended' };
  return checkQuota(runsThisMonth, limits.aiRunsPerMonth, 'ai_runs');
}

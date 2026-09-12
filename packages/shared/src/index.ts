export * from './roles';
export * from './events';
export * from './adapter';
export * from './diagnosis';

/** Estados de UI obrigatórios — PRD §7.3. */
export const UI_STATES = [
  'loading',
  'empty',
  'not_connected',
  'syncing',
  'partial',
  'stale',
  'no_permission',
  'error',
  'plan_unavailable',
] as const;
export type UiState = (typeof UI_STATES)[number];

/**
 * Divisão segura para razões (§7.3): divisão por zero retorna null com motivo.
 * `null` = indisponível/indefinido; zero = valor observado igual a zero.
 */
export function safeRatio(
  numerator: number | null,
  denominator: number | null,
): { value: number | null; reason?: string } {
  if (numerator === null || denominator === null) {
    return { value: null, reason: 'operando_indisponivel' };
  }
  if (denominator === 0) {
    return { value: null, reason: 'divisao_por_zero' };
  }
  return { value: numerator / denominator };
}

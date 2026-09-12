/**
 * Conversão de micros → unidade maior, UMA vez (§13.1: não dividir micros duas
 * vezes). Retorna string decimal exata para preservar precisão financeira; nunca
 * usar ponto flutuante binário em cálculos monetários.
 */
export function microsToAmount(micros: number | bigint | string): string {
  const n = BigInt(typeof micros === 'string' ? micros.split('.')[0] || '0' : micros);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const intPart = abs / 1_000_000n;
  const fracPart = abs % 1_000_000n;
  const frac = fracPart.toString().padStart(6, '0').replace(/0+$/, '');
  const body = frac.length > 0 ? `${intPart}.${frac}` : `${intPart}`;
  return neg ? `-${body}` : body;
}

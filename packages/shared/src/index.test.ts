import { describe, it, expect } from 'vitest';
import { safeRatio } from './index';

describe('safeRatio', () => {
  it('T13: denominador zero retorna null com motivo, não infinito', () => {
    expect(safeRatio(100, 0)).toEqual({ value: null, reason: 'divisao_por_zero' });
  });

  it('T13: numerador null (conversão ausente) retorna null com motivo, não zero', () => {
    expect(safeRatio(null, 10)).toEqual({ value: null, reason: 'operando_indisponivel' });
  });

  it('zero observado no numerador é valor válido (0), não null', () => {
    expect(safeRatio(0, 10)).toEqual({ value: 0 });
  });

  it('razão normal', () => {
    // Fixture A: CPC consolidado = 1500/150 = 10
    expect(safeRatio(1500, 150)).toEqual({ value: 10 });
  });
});

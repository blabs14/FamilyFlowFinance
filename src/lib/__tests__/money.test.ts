import { describe, it, expect } from 'vitest';
import { euroToCents, centsToEuro, formatMoney, parseMoney } from '../money';

describe('money helpers', () => {
  describe('euroToCents', () => {
    it('converte euros inteiros', () => expect(euroToCents(10)).toBe(1000));
    it('arredonda meio cêntimo para cima', () => expect(euroToCents(10.005)).toBe(1001));
    it('preserva 2 casas decimais', () => expect(euroToCents(9.99)).toBe(999));
    it('funciona com zero', () => expect(euroToCents(0)).toBe(0));
    it('funciona com valores negativos', () => expect(euroToCents(-5.50)).toBe(-550));
  });

  describe('centsToEuro', () => {
    it('converte cêntimos para euros', () => expect(centsToEuro(1000)).toBe(10));
    it('preserva decimais', () => expect(centsToEuro(999)).toBeCloseTo(9.99));
    it('funciona com zero', () => expect(centsToEuro(0)).toBe(0));
  });

  describe('formatMoney', () => {
    it('formata em euros PT', () => {
      expect(formatMoney(1000)).toMatch(/10/);
    });
    it('retorna string não vazia para zero', () => {
      expect(formatMoney(0)).toBeTruthy();
    });
  });

  describe('parseMoney', () => {
    it('faz parse de string com vírgula PT', () => expect(parseMoney('9,99')).toBeCloseTo(9.99));
    it('faz parse de string com ponto EN', () => expect(parseMoney('9.99')).toBeCloseTo(9.99));
    it('retorna null para string inválida', () => expect(parseMoney('abc')).toBeNull());
    it('ignora símbolo de euro', () => expect(parseMoney('€ 5,00')).toBeCloseTo(5.0));
  });
});

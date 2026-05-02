// src/validation/__tests__/transactionSchema.test.ts
// Unit 6: atualizado para amount_cents + validação de data futura
import { describe, it, expect } from 'vitest';
import { transactionSchema } from '../transactionSchema';

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const validBase = {
  account_id: 'acc-uuid-1234',
  amount_cents: 1000,
  categoria_id: 'cat-uuid-1234',
  data: today,
  tipo: 'despesa' as const,
};

describe('transactionSchema', () => {
  describe('validação básica', () => {
    it('deve validar uma transação de receita válida', () => {
      const result = transactionSchema.safeParse({ ...validBase, tipo: 'receita' });
      expect(result.success).toBe(true);
    });

    it('deve validar uma transação de despesa válida', () => {
      const result = transactionSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });
  });

  describe('validação de account_id', () => {
    it('deve rejeitar account_id vazio', () => {
      const result = transactionSchema.safeParse({ ...validBase, account_id: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Conta obrigatória');
      }
    });

    it('deve rejeitar account_id ausente', () => {
      const { account_id: _, ...rest } = validBase;
      const result = transactionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('validação de amount_cents', () => {
    it('aceita amount_cents positivo', () => {
      expect(transactionSchema.safeParse(validBase).success).toBe(true);
    });

    it('rejeita amount_cents zero', () => {
      const result = transactionSchema.safeParse({ ...validBase, amount_cents: 0 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Valor obrigatório');
      }
    });

    it('rejeita amount_cents negativo', () => {
      const result = transactionSchema.safeParse({ ...validBase, amount_cents: -1 });
      expect(result.success).toBe(false);
    });

    it('rejeita amount_cents decimal (não-inteiro)', () => {
      const result = transactionSchema.safeParse({ ...validBase, amount_cents: 10.5 });
      expect(result.success).toBe(false);
    });

    it('rejeita amount_cents ausente', () => {
      const { amount_cents: _, ...rest } = validBase;
      const result = transactionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('validação de data futura', () => {
    it('aceita transação com data de hoje', () => {
      expect(transactionSchema.safeParse({ ...validBase, data: today }).success).toBe(true);
    });

    it('aceita transação com data passada', () => {
      expect(transactionSchema.safeParse({ ...validBase, data: yesterday }).success).toBe(true);
    });

    it('rejeita transação com data futura', () => {
      const result = transactionSchema.safeParse({ ...validBase, data: tomorrow });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.issues.map(i => i.message);
        expect(msgs.some(m => m.includes('futura') || m.includes('future') || m.includes('hoje'))).toBe(true);
      }
    });

    it('deve rejeitar formato de data inválido', () => {
      const invalidDates = ['2024/01/01', '01-01-2024', '2024-1-1', 'hoje'];
      invalidDates.forEach(invalidDate => {
        const result = transactionSchema.safeParse({ ...validBase, data: invalidDate });
        expect(result.success).toBe(false);
      });
    });

    it('deve rejeitar data ausente', () => {
      const { data: _, ...rest } = validBase;
      const result = transactionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('validação de categoria_id', () => {
    it('deve aceitar sem categoria_id (opcional)', () => {
      const { categoria_id: _, ...rest } = validBase;
      expect(transactionSchema.safeParse(rest).success).toBe(true);
    });

    it('deve aceitar categoria_id null', () => {
      expect(transactionSchema.safeParse({ ...validBase, categoria_id: null }).success).toBe(true);
    });

    it('deve rejeitar categoria_id vazio (quando fornecido)', () => {
      const result = transactionSchema.safeParse({ ...validBase, categoria_id: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('validação de tipo', () => {
    it('deve aceitar "receita"', () => {
      expect(transactionSchema.safeParse({ ...validBase, tipo: 'receita' }).success).toBe(true);
    });

    it('deve aceitar "despesa"', () => {
      expect(transactionSchema.safeParse({ ...validBase, tipo: 'despesa' }).success).toBe(true);
    });

    it('deve rejeitar tipo inválido', () => {
      const result = transactionSchema.safeParse({ ...validBase, tipo: 'transferencia' as any });
      expect(result.success).toBe(false);
    });
  });

  describe('validação de descrição', () => {
    it('deve aceitar descrição opcional ausente', () => {
      expect(transactionSchema.safeParse(validBase).success).toBe(true);
    });

    it('deve rejeitar descrição muito longa', () => {
      const result = transactionSchema.safeParse({ ...validBase, descricao: 'a'.repeat(256) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Descrição demasiado longa');
      }
    });

    it('deve aceitar descrição no limite máximo (255 chars)', () => {
      expect(transactionSchema.safeParse({ ...validBase, descricao: 'a'.repeat(255) }).success).toBe(true);
    });
  });

  describe('campos opcionais', () => {
    it('aceita credit_card_id uuid válido', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        credit_card_id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('rejeita credit_card_id com formato inválido', () => {
      const result = transactionSchema.safeParse({ ...validBase, credit_card_id: 'não-uuid' });
      expect(result.success).toBe(false);
    });

    it('aceita operation_id uuid válido', () => {
      const result = transactionSchema.safeParse({
        ...validBase,
        operation_id: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('casos extremos', () => {
    it('deve rejeitar objeto vazio', () => {
      expect(transactionSchema.safeParse({}).success).toBe(false);
    });

    it('deve rejeitar null', () => {
      expect(transactionSchema.safeParse(null).success).toBe(false);
    });

    it('deve ignorar campos extras', () => {
      const result = transactionSchema.safeParse({ ...validBase, campoExtra: 'x' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect('campoExtra' in result.data).toBe(false);
      }
    });
  });
});

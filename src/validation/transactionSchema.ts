// src/validation/transactionSchema.ts
// Unit 6: usa amount_cents (cêntimos, inteiro), validação data ≤ hoje
import { z } from 'zod';

const today = () => new Date().toISOString().slice(0, 10);

export const transactionSchema = z.object({
  account_id:   z.string().trim().min(1, 'Conta obrigatória'),
  // amount_cents: valor em cêntimos (inteiro positivo)
  amount_cents: z.number({ invalid_type_error: 'Valor inválido' })
                 .int('Valor deve ser número inteiro de cêntimos')
                 .min(1, 'Valor obrigatório'),
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória').nullable().optional(),
  data: z.string()
         .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)')
         .refine(
           (d) => d <= today(),
           'Não é possível registar transações com data futura'
         ),
  descricao:    z.string().trim().max(255, 'Descrição demasiado longa').optional().nullable(),
  tipo:         z.enum(['receita', 'despesa']),
  // Campos opcionais (operações de cartão e splits)
  credit_card_id: z.string().uuid().optional().nullable(),
  operation_id:   z.string().uuid().optional().nullable(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

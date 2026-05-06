import { z } from 'zod';

// Schema para contas bancárias (não inclui cartões de crédito — têm schema próprio)
export const accountSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório (mínimo 2 caracteres)'),
  tipo: z.enum(['corrente', 'poupança', 'investimento', 'outro'], { message: 'Tipo inválido' }),
  currency: z.string().default('EUR'),
  saldoAtual: z.number().optional(),
  ajusteSaldo: z.number().optional(),
});

export type AccountSchema = z.infer<typeof accountSchema>;

// Schema para cartões de crédito
export const creditCardSchema = z.object({
  nome: z.string().trim().min(2, 'Nome obrigatório (mínimo 2 caracteres)'),
  credit_limit_cents: z
    .number({ required_error: 'Limite obrigatório' })
    .int('O limite deve ser em cêntimos (inteiro)')
    .nonnegative('O limite não pode ser negativo'),
  closing_day: z
    .number()
    .int()
    .min(1)
    .max(28, 'Dia de fecho deve ser entre 1 e 28')
    .nullable()
    .optional(),
  payment_day: z
    .number()
    .int()
    .min(1)
    .max(28, 'Dia de pagamento deve ser entre 1 e 28')
    .nullable()
    .optional(),
  apr: z.number().min(0).max(1, 'APR deve ser entre 0 e 1 (ex: 0.1999 = 19.99%)').default(0),
  annual_fee_cents: z.number().int().nonnegative().default(0),
  currency: z.string().default('EUR'),
});

export type CreditCardSchema = z.infer<typeof creditCardSchema>;

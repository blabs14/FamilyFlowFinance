// src/validation/goalSchema.ts
import { z } from 'zod';

export const goalSchema = z.object({
  nome: z.string().trim().min(1, 'Nome obrigatório'),
  target_cents: z.number().int().min(1, 'Valor objetivo deve ser positivo'),
  tipo: z.enum(['savings', 'amortization']).default('savings'),
  prazo: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(5).default(3),
  order_index: z.number().int().default(0),
  family_id: z.string().uuid().nullable().optional(),
  target_account_id: z.string().uuid().nullable().optional(),
  ativa: z.boolean().default(true),
  status: z.string().optional().nullable(),
});

export type GoalFormData = z.infer<typeof goalSchema>;

export const goalAllocationSchema = z.object({
  goal_id: z.string().min(1, 'ID do objetivo obrigatório'),
  account_id: z.string().min(1, 'ID da conta obrigatório'),
  amount_cents: z.number().int().min(1, 'Valor deve ser positivo'),
  description: z.string().optional(),
});

export type GoalAllocationFormData = z.infer<typeof goalAllocationSchema>;

// Legacy re-export for old imports
export { goalAllocationSchema as createGoalAllocationSchema };

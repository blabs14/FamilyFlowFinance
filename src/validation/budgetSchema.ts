// src/validation/budgetSchema.ts
import { z } from 'zod';

// Base schema (extendable — no .refine())
export const budgetTemplateBaseSchema = z.object({
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória'),
  amount_cents: z.number().int().min(1, 'Valor deve ser positivo'),
  period_type: z.enum(['monthly', 'annual']).default('monthly'),
  rollover_mode: z.enum(['reset', 'accumulate', 'transfer_to_goal']).default('reset'),
  cap_type: z.enum(['flexible', 'hard']).default('flexible'),
  parent_id: z.string().uuid().nullable().optional(),
  target_goal_id: z.string().uuid().nullable().optional(),
  family_id: z.string().uuid().nullable().optional(),
});

// Refined schema (adds cross-field validation)
export const budgetTemplateSchema = budgetTemplateBaseSchema.refine(
  (d) => d.rollover_mode !== 'transfer_to_goal' || !!d.target_goal_id,
  { message: 'Objetivo obrigatório para modo transfer_to_goal', path: ['target_goal_id'] }
);

export type BudgetTemplateFormData = z.infer<typeof budgetTemplateBaseSchema>;

// Backwards compat alias (para código legado que ainda importa budgetSchema)
export const budgetSchema = z.object({
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória'),
  valor: z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v) : v),
    z.number({ invalid_type_error: 'Valor inválido' }).min(0.01, 'Valor obrigatório')
  ),
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (YYYY-MM)').min(1, 'Mês obrigatório'),
});

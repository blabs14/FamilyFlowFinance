import { z } from 'zod';

export const transactionSchema = z.object({
  account_id: z.string().trim().min(1, 'Conta obrigatória'),
  valor: z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v) : v),
    z.number({ invalid_type_error: 'Valor inválido' }).min(0.01, 'Valor obrigatório')
  ),
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD)').min(1, 'Data obrigatória'),
  descricao: z.string().trim().max(255, 'Descrição demasiado longa').optional(),
  tipo: z.enum(['receita', 'despesa']),
});
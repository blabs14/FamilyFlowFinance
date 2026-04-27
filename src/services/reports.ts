import { supabase } from '../lib/supabaseClient';

// Relatório: Total de despesas por categoria (com nome da categoria e filtro opcional por mês)
export const getExpensesByCategory = async (
  user_id: string,
  mes?: string
): Promise<{ data: { categoria: string; total: number }[]; error: unknown }> => {
  let query = supabase
    .from('transactions')
    .select('valor, categoria_id, categorias:categoria_id(nome)')
    .eq('user_id', user_id);

  // Se o mês for fornecido, filtra as transações desse mês (YYYY-MM)
  if (mes) {
    // Considera que o campo 'data' está em formato ISO (YYYY-MM-DD)
    query = query.gte('data', `${mes}-01`).lt('data', `${mes}-31`);
  }

  const { data, error } = await query;
  if (error) return { data: [], error };

  // Agregar por categoria
  const agregados: Record<string, number> = {};
  const rows = (data as Array<{ valor: number | null; categorias?: { nome?: string | null } }> | null) || [];
  rows.forEach((t) => {
    const nome = t.categorias?.nome || 'Sem categoria';
    agregados[nome] = (agregados[nome] || 0) + (t.amount_cents || 0) / 100;
  });

  const resultado = Object.entries(agregados).map(([categoria, total]) => ({ categoria, total }));
  return { data: resultado, error: null };
};

// Relatório: Total de receitas por mês
export const getIncomeByMonth = async (user_id: string) => {
  return supabase
    .from('transactions')
    .select('data, valor, tipo')
    .eq('user_id', user_id)
    .eq('tipo', 'receita');
};

// Podes adicionar mais funções de agregação conforme necessário
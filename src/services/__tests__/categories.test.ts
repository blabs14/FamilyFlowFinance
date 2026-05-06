// src/services/__tests__/categories.test.ts
// Unit 6: estendido com getCategoriesTree e bloqueio de is_system em updateCategory
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSingle, mockEq, mockIs, mockSelect, mockInsert, mockOrder, mockIlike, mockOr, mockLimit, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn().mockReturnThis();
  const mockIs = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockIlike = vi.fn().mockReturnThis();
  const mockOr = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });

  const mockChain = { select: mockSelect, insert: mockInsert, eq: mockEq, is: mockIs, order: mockOrder, single: mockSingle, ilike: mockIlike, or: mockOr, limit: mockLimit };
  const mockFrom = vi.fn(() => mockChain);
  return { mockSingle, mockEq, mockIs, mockSelect, mockInsert, mockOrder, mockIlike, mockOr, mockLimit, mockFrom };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

// also mock categoryCustomizations dependency
vi.mock('../categoryCustomizations', () => ({
  getUserCategoryCustomizations: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

import { getSystemCategories, getCategoriesTree, updateCategory } from '../categories';

describe('categories service (Unit 6 extensions)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSystemCategories filtra por is_system = true', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    await getSystemCategories();

    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(mockEq).toHaveBeenCalledWith('is_system', true);
  });

  it('getCategoriesTree carrega todas as categorias e agrupa pai/filho', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        { id: 'p-1', nome: 'Alimentação', parent_id: null, is_system: true },
        { id: 'c-1', nome: 'Supermercado', parent_id: 'p-1', is_system: false },
        { id: 'c-2', nome: 'Restaurante',  parent_id: 'p-1', is_system: false },
      ],
      error: null,
    });

    const result = await getCategoriesTree();

    expect(result.data).toHaveLength(1);       // 1 pai
    expect(result.data![0].children).toHaveLength(2); // 2 filhos
  });

  it('updateCategory rejeita edição de categoria is_system', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'cat-1', nome: 'Alimentação', is_system: true },
      error: null,
    });

    const result = await updateCategory('cat-1', { nome: 'Comida' });

    expect(result.error).toBeTruthy();
    expect((result.error as Error).message).toMatch(/sistema|system/i);
  });
});

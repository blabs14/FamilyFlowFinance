import { describe, it, expect, vi } from 'vitest';
import * as svc from '@/services/budgets';

// Mock do supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockResolvedValue({ data: [], error: null })
    })),
    auth: {
      signUp: vi.fn().mockImplementation(({ email }) => Promise.resolve({ 
        data: { user: { email } }, 
        error: null 
      })),
      signInWithPassword: vi.fn().mockImplementation(({ email }) => Promise.resolve({ 
        data: { user: { email } }, 
        error: null 
      }))
    }
  }
}));

// Nota: import dinâmico removido; mocks acima são suficientes para estes testes

describe('budgets service', () => {
  it('getBudgets retorna um array', async () => {
    const { data, error } = await svc.getBudgets();
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
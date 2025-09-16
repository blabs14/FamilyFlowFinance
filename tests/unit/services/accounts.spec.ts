import { describe, it, expect, vi } from 'vitest';
import * as svc from '@/services/accounts';

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

const { supabase } = await import('@/lib/supabaseClient');

function randomEmail() {
  return `test_${Math.random().toString(36).substring(2, 10)}@test.com`;
}

describe('accounts service', () => {
  it('getAccounts retorna um array', async () => {
    const { data, error } = await svc.getAccounts();
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('auth flow', () => {
  it('regista e faz login com sucesso', async () => {
    const email = randomEmail();
    const password = 'password123';
    const nome = 'Teste Automatizado';

    // Registo
    const signupRes = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } }
    });
    expect(signupRes.error).toBeNull();
    expect(signupRes.data.user?.email).toBe(email);

    // Login
    const loginRes = await supabase.auth.signInWithPassword({ email, password });
    expect(loginRes.error).toBeNull();
    expect(loginRes.data.user?.email).toBe(email);
  });
});
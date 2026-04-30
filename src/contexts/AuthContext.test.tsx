import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('../hooks/useUserDataInvalidation', () => ({
  useUserDataInvalidation: vi.fn(),
}));

vi.mock('../shared/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helper component ─────────────────────────────────────────────────────────

function TestConsumer() {
  const { loading, user } = useAuth();
  const status = loading ? 'loading' : user ? 'authenticated' : 'unauthenticated';
  return <div data-testid="status">{status}</div>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('deve começar no estado loading=true', async () => {
    const { supabase } = await import('../lib/supabaseClient');
    // getSession never resolves — keeps us in loading state
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('deve resolver para unauthenticated quando getSession retorna sessão nula', async () => {
    const { supabase } = await import('../lib/supabaseClient');
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Flush all microtasks + timers so the resolved promise and state update settle
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('fallback timer deve ter timeout >= 5000ms (esperado: 8000ms)', async () => {
    const { supabase } = await import('../lib/supabaseClient');
    const { logger } = await import('../shared/lib/logger');

    // getSession blocks forever — only the fallback timer can resolve loading
    (supabase.auth.getSession as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {})
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Deve ainda estar em loading ao avançar 4900ms
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(screen.getByTestId('status').textContent).toBe('loading');

    // Ao atingir 8000ms totais, deve resolver (React flushed inside act)
    await act(async () => {
      vi.advanceTimersByTime(3100); // 4900 + 3100 = 8000
    });

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Timeout'),
      expect.anything()
    );
  });
});

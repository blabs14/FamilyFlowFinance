import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do cliente Supabase
vi.mock('@/lib/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

import { supabase } from '@/lib/supabaseClient';
import { usePayroll } from '@/features/payroll/hooks/usePayroll';

describe('usePayroll.exportPayslips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exporta com sucesso e abre URL assinada (CSV)', async () => {
    const signedUrl = 'https://example.com/signed.csv?token=abc';
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { signedUrl }, error: null });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { result } = renderHook(() => usePayroll());

    await act(async () => {
      const resp = await result.current.exportPayslips(['id-1','id-2'], 'csv');
      expect(resp.success).toBe(true);
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('export-payslips', {
      body: { ids: ['id-1','id-2'], format: 'csv' },
    });
    expect(openSpy).toHaveBeenCalledWith(signedUrl, '_blank');
    openSpy.mockRestore();
  });

  it('propaga erro vindo da Edge Function e define estado de erro', async () => {
    (supabase.functions.invoke as any).mockResolvedValueOnce({ data: null, error: { message: 'Rate limit excedido' } });

    const { result } = renderHook(() => usePayroll());

    await act(async () => {
      const resp = await result.current.exportPayslips(['id-3'], 'pdf');
      expect(resp.success).toBe(false);
      expect(resp.error).toBe('Rate limit excedido');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('export-payslips', {
      body: { ids: ['id-3'], format: 'pdf' },
    });
    // Verificar estado de erro exposto no hook
    expect(result.current.error).toBe('Rate limit excedido');
  });

  it('lida com exceções de runtime (ex.: falha de rede)', async () => {
    (supabase.functions.invoke as any).mockRejectedValueOnce(new Error('Falha de rede'));

    const { result } = renderHook(() => usePayroll());

    await act(async () => {
      const resp = await result.current.exportPayslips(['id-4']);
      expect(resp.success).toBe(false);
      expect(resp.error).toBe('Falha de rede');
    });

    expect(result.current.error).toBe('Falha de rede');
  });
});
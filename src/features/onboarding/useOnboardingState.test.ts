import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardingState } from './useOnboardingState';

// Mock useUpdateUserPreferences so completeOnboarding doesn't hit Supabase
vi.mock('../../hooks/useUserPreferences', () => ({
  useUpdateUserPreferences: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

const STORAGE_KEY = 'fff_onboarding_done';

// setupTests.ts substitui localStorage por spies sem estado real.
// Criamos um store em memória e ligamos as implementações.
let store: Record<string, string> = {};

const setupLocalStorageMock = () => {
  store = {};
  vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => { store[key] = value; });
  vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { delete store[key]; });
  vi.mocked(localStorage.clear).mockImplementation(() => { store = {}; });
};

describe('useOnboardingState', () => {
  beforeEach(() => {
    setupLocalStorageMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('showWizard=true no primeiro login (sem flag no localStorage)', () => {
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.showWizard).toBe(true);
  });

  it('showWizard=false se flag já existir no localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.showWizard).toBe(false);
  });

  it('completeOnboarding persiste a flag e fecha o wizard', async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(async () => { await result.current.completeOnboarding(); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(result.current.showWizard).toBe(false);
  });

  it('skipOnboarding persiste a flag e fecha o wizard', async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(async () => { result.current.skipOnboarding(); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(result.current.showWizard).toBe(false);
  });

  it('currentStep começa em 1', () => {
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.currentStep).toBe(1);
  });

  it('nextStep avança o passo de 1 para 2', () => {
    const { result } = renderHook(() => useOnboardingState());
    act(() => { result.current.nextStep(); });
    expect(result.current.currentStep).toBe(2);
  });

  it('nextStep no último passo (4) chama completeOnboarding', async () => {
    const { result } = renderHook(() => useOnboardingState());
    act(() => { result.current.nextStep(); }); // 1→2
    act(() => { result.current.nextStep(); }); // 2→3
    act(() => { result.current.nextStep(); }); // 3→4
    await act(async () => { result.current.nextStep(); }); // 4→complete
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(result.current.showWizard).toBe(false);
  });
});

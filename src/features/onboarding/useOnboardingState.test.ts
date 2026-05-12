import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboardingState, ONBOARDING_TOTAL_STEPS } from './useOnboardingState';

// Mock useUpdateUserPreferences so completeOnboarding doesn't hit Supabase
vi.mock('../../hooks/useUserPreferences', () => ({
  useUpdateUserPreferences: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

describe('useOnboardingState', () => {
  it('exports ONBOARDING_TOTAL_STEPS as 4', () => {
    expect(ONBOARDING_TOTAL_STEPS).toBe(4);
  });

  it('showWizard starts as false', () => {
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.showWizard).toBe(false);
  });

  it('currentStep starts at 1', () => {
    const { result } = renderHook(() => useOnboardingState());
    expect(result.current.currentStep).toBe(1);
  });

  it('nextStep advances from step 1 to 2', async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(async () => { await result.current.nextStep(); });
    expect(result.current.currentStep).toBe(2);
  });

  it('completeOnboarding closes the wizard', async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(async () => { await result.current.completeOnboarding(); });
    expect(result.current.showWizard).toBe(false);
  });

  it('skipOnboarding closes the wizard', async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(async () => { await result.current.skipOnboarding(); });
    expect(result.current.showWizard).toBe(false);
  });

  it('nextStep on last step calls completeOnboarding (closes wizard)', async () => {
    const { result } = renderHook(() => useOnboardingState());
    await act(async () => { await result.current.nextStep(); }); // 1→2
    await act(async () => { await result.current.nextStep(); }); // 2→3
    await act(async () => { await result.current.nextStep(); }); // 3→4
    await act(async () => { await result.current.nextStep(); }); // 4→complete
    expect(result.current.showWizard).toBe(false);
  });
});

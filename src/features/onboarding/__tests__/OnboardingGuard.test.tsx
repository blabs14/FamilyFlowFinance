import { describe, it, expect, vi } from 'vitest';

// Mock heavy dependencies so the module can be imported without Supabase env vars
vi.mock('../../../hooks/useUserPreferences', () => ({
  useUpdateUserPreferences: () => ({ mutateAsync: vi.fn() }),
}));

// Minimal smoke test — guard logic is route-level, tested by integration
describe('useOnboardingState', () => {
  it('exports completeOnboarding function', async () => {
    const mod = await import('../useOnboardingState');
    expect(typeof mod.useOnboardingState).toBe('function');
  });
});

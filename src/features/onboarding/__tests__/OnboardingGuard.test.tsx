import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OnboardingGuard } from '../../../components/OnboardingGuard';

vi.mock('../../../hooks/useUserPreferences', () => ({
  useUserPreferences: vi.fn(),
}));

import { useUserPreferences } from '../../../hooks/useUserPreferences';

describe('useOnboardingState', () => {
  it('exports useOnboardingState function', async () => {
    const mod = await import('../useOnboardingState');
    expect(typeof mod.useOnboardingState).toBe('function');
  });
});

describe('OnboardingGuard', () => {
  it('shows null while loading', () => {
    vi.mocked(useUserPreferences).mockReturnValue({ data: undefined, isLoading: true } as any);
    const { container } = render(
      <MemoryRouter initialEntries={['/app']}>
        <OnboardingGuard><div>content</div></OnboardingGuard>
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders children when onboarding_completed_at is set', () => {
    vi.mocked(useUserPreferences).mockReturnValue({
      data: { onboarding_completed_at: '2026-01-01T00:00:00Z' },
      isLoading: false,
    } as any);
    render(
      <MemoryRouter initialEntries={['/app']}>
        <OnboardingGuard><div>content</div></OnboardingGuard>
      </MemoryRouter>
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders children for exempt path even without onboarding_completed_at', () => {
    vi.mocked(useUserPreferences).mockReturnValue({
      data: { onboarding_completed_at: null },
      isLoading: false,
    } as any);
    render(
      <MemoryRouter initialEntries={['/app/settings']}>
        <OnboardingGuard><div>content</div></OnboardingGuard>
      </MemoryRouter>
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

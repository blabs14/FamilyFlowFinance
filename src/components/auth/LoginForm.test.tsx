import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import LoginForm from './LoginForm';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    login: vi.fn(),
    loading: false,
    user: null,
  })),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../../services/authProviders', () => ({
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  signInWithFacebook: vi.fn(),
}));

vi.mock('../../lib/utils', () => ({
  showError: vi.fn(),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// ── Tests — OAuth desabilitados ──────────────────────────────────────────────

describe('LoginForm — OAuth buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('botão Google deve estar desabilitado', () => {
    render(<LoginForm />);
    const btn = screen.getByRole('button', { name: /google/i });
    expect(btn).toBeDisabled();
  });

  it('botão Google deve mostrar "Em breve"', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: /google/i })).toHaveTextContent(/em breve/i);
  });

  it('botão Apple deve estar desabilitado', () => {
    render(<LoginForm />);
    const btn = screen.getByRole('button', { name: /apple/i });
    expect(btn).toBeDisabled();
  });

  it('botão Apple deve mostrar "Em breve"', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: /apple/i })).toHaveTextContent(/em breve/i);
  });

  it('botão Facebook deve estar desabilitado', () => {
    render(<LoginForm />);
    const btn = screen.getByRole('button', { name: /facebook/i });
    expect(btn).toBeDisabled();
  });

  it('botão Facebook deve mostrar "Em breve"', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: /facebook/i })).toHaveTextContent(/em breve/i);
  });

  it('clicar nos botões OAuth desabilitados não deve chamar signIn', async () => {
    const user = userEvent.setup();
    const { signInWithGoogle, signInWithApple, signInWithFacebook } =
      await import('../../services/authProviders');

    render(<LoginForm />);

    // Buttons are disabled — clicks should not fire handlers
    const googleBtn = screen.getByRole('button', { name: /google/i });
    const appleBtn = screen.getByRole('button', { name: /apple/i });
    const facebookBtn = screen.getByRole('button', { name: /facebook/i });

    await user.click(googleBtn);
    await user.click(appleBtn);
    await user.click(facebookBtn);

    expect(signInWithGoogle).not.toHaveBeenCalled();
    expect(signInWithApple).not.toHaveBeenCalled();
    expect(signInWithFacebook).not.toHaveBeenCalled();
  });
});

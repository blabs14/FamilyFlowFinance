import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginForm from '@/components/auth/LoginForm';
import { setupUser } from '../../utils/testHelpers';

const loginMock = vi.fn();
const navigateMock = vi.fn();
const showErrorMock = vi.fn();
const signInWithGoogleMock = vi.fn();
const signInWithAppleMock = vi.fn();
const signInWithFacebookMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: loginMock,
    register: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/authProviders', () => ({
  signInWithGoogle: () => signInWithGoogleMock(),
  signInWithApple: () => signInWithAppleMock(),
  signInWithFacebook: () => signInWithFacebookMock(),
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');

  return {
    ...actual,
    showError: (message: string) => showErrorMock(message),
  };
});

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password inputs and submit button', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting an empty form', async () => {
    const user = setupUser();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText('Email é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Password é obrigatória')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login with email and password on valid submit', async () => {
    const user = setupUser();
    loginMock.mockResolvedValue({ error: null });
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('user@example.com', 'secret123');
    });
    expect(navigateMock).toHaveBeenCalledWith('/app');
  });

  it('displays an error message when login fails', async () => {
    const user = setupUser();
    loginMock.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong123');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(showErrorMock).toHaveBeenCalledWith('Erro ao iniciar sessão: Invalid credentials');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('disables the submit button while login is pending', async () => {
    const user = setupUser();
    let resolveLogin!: (value: { error: null }) => void;
    loginMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');

    const submitButton = screen.getByRole('button', { name: /^entrar$/i });
    await user.click(submitButton);

    await waitFor(() => expect(screen.getByRole('button', { name: /a entrar/i })).toBeDisabled());

    resolveLogin({ error: null });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/app'));
  });
});

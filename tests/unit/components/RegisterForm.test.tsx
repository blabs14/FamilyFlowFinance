import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RegisterForm from '@/components/auth/RegisterForm';
import { setupUser } from '../../utils/testHelpers';

const registerMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    register: registerMock,
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

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all inputs and the submit button', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting an empty form', async () => {
    const user = setupUser();
    render(<RegisterForm />);

    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('Nome é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Email é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Password é obrigatória')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for a weak password', async () => {
    const user = setupUser();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/nome/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/password/i), '123456');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('Password deve conter pelo menos uma letra')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('calls register with email, password and name on valid submit', async () => {
    const user = setupUser();
    registerMock.mockResolvedValue({ error: null });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/nome/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Secret123');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('ana@example.com', 'Secret123', 'Ana Silva');
    });
  });

  it('surfaces an already registered email error inline', async () => {
    const user = setupUser();
    registerMock.mockResolvedValue({ error: { message: 'email already registered' } });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/nome/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Secret123');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('email already registered')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows success feedback and redirects to login after a valid registration', async () => {
    const user = setupUser();
    registerMock.mockResolvedValue({ error: null });
    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/nome/i), 'Ana Silva');
    await user.type(screen.getByLabelText(/email/i), 'ana@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Secret123');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/Conta criada com sucesso/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login');
    }, { timeout: 2500 });
  }, 4000);
});

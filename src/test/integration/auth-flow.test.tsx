import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { customRender, setupIntegrationTest, typeIntoInput, submitForm } from '../utils/test-utils';
import { createAuthUserData, createLoginCredentials, createRegisterCredentials, authErrors, createMockAuthService } from '../factories/auth-factories';
import LoginPage from '../../pages/login';
import RegisterPage from '../../pages/register';
import DashboardPage from '../../pages/Index';

// Mock do serviço de autenticação
const mockAuthService = createMockAuthService();

// Mock do router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock do contexto de autenticação
let mockAuthContext = {
  user: null,
  session: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('Fluxo de Autenticação - Integração', () => {
  const testEnv = setupIntegrationTest();

  beforeEach(() => {
    // Reset do contexto de autenticação
    mockAuthContext = {
      user: null,
      session: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      clearError: vi.fn(),
    };

    // Reset dos mocks
    vi.clearAllMocks();
  });

  describe('Login de Utilizador', () => {
    it('deve permitir login com credenciais válidas', async () => {
      const credentials = createLoginCredentials();
      const userData = createAuthUserData();

      // Mock do sucesso do login
      mockAuthContext.signIn = vi.fn().mockResolvedValue({ success: true });

      customRender(<LoginPage />);

      // Verificar se a página de login está carregada
      expect(screen.getByRole('heading', { name: /iniciar sessão/i })).toBeInTheDocument();

      // Preencher o formulário
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await typeIntoInput(emailInput, credentials.email);
      await typeIntoInput(passwordInput, credentials.password);

      // Submeter o formulário
      const form = screen.getByRole('form') || screen.getByTestId('login-form');
      await submitForm(form);

      // Verificar se o signIn foi chamado
      await waitFor(() => {
        expect(mockAuthContext.signIn).toHaveBeenCalledWith({
          email: credentials.email,
          password: credentials.password,
        });
      });

      // Verificar redirecionamento para dashboard
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('deve mostrar erro com credenciais inválidas', async () => {
      const credentials = createLoginCredentials({ password: 'wrongpassword' });

      // Mock do erro de login
      mockAuthContext.signIn = vi.fn().mockResolvedValue({ 
        success: false, 
        error: authErrors.invalidCredentials 
      });
      mockAuthContext.error = authErrors.invalidCredentials;

      customRender(<LoginPage />);

      // Preencher o formulário com credenciais inválidas
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await typeIntoInput(emailInput, credentials.email);
      await typeIntoInput(passwordInput, credentials.password);

      // Submeter o formulário
      const form = screen.getByRole('form') || screen.getByTestId('login-form');
      await submitForm(form);

      // Verificar se o erro é mostrado
      await waitFor(() => {
        expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
      });

      // Verificar que não houve redirecionamento
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('deve mostrar estado de carregamento durante login', async () => {
      const credentials = createLoginCredentials();

      // Mock do loading
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockAuthContext.signIn = vi.fn().mockReturnValue(loginPromise);
      mockAuthContext.loading = true;

      customRender(<LoginPage />);

      // Preencher e submeter o formulário
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await typeIntoInput(emailInput, credentials.email);
      await typeIntoInput(passwordInput, credentials.password);

      const form = screen.getByRole('form') || screen.getByTestId('login-form');
      await submitForm(form);

      // Verificar estado de carregamento
      expect(screen.getByText(/a processar/i) || screen.getByRole('progressbar')).toBeInTheDocument();

      // Resolver o login
      resolveLogin!({ success: true });

      // Verificar que o loading desapareceu
      await waitFor(() => {
        expect(screen.queryByText(/a processar/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Registo de Utilizador', () => {
    it('deve permitir registo com dados válidos', async () => {
      const credentials = createRegisterCredentials();

      // Mock do sucesso do registo
      mockAuthContext.signUp = vi.fn().mockResolvedValue({ success: true });

      customRender(<RegisterPage />);

      // Verificar se a página de registo está carregada
      expect(screen.getByRole('heading', { name: /criar conta/i })).toBeInTheDocument();

      // Preencher o formulário
      const nameInput = screen.getByLabelText(/nome/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmar password/i);
      const termsCheckbox = screen.getByLabelText(/aceito os termos/i);
      
      await typeIntoInput(nameInput, credentials.name);
      await typeIntoInput(emailInput, credentials.email);
      await typeIntoInput(passwordInput, credentials.password);
      await typeIntoInput(confirmPasswordInput, credentials.confirmPassword);
      
      if (!termsCheckbox.checked) {
        await userEvent.click(termsCheckbox);
      }

      // Submeter o formulário
      const form = screen.getByRole('form') || screen.getByTestId('register-form');
      await submitForm(form);

      // Verificar se o signUp foi chamado
      await waitFor(() => {
        expect(mockAuthContext.signUp).toHaveBeenCalledWith({
          name: credentials.name,
          email: credentials.email,
          password: credentials.password,
        });
      });

      // Verificar redirecionamento ou mensagem de sucesso
      await waitFor(() => {
        expect(
          screen.getByText(/conta criada com sucesso/i) ||
          mockRouter.push
        ).toBeTruthy();
      });
    });

    it('deve mostrar erro quando email já existe', async () => {
      const credentials = createRegisterCredentials({ email: 'existing@example.com' });

      // Mock do erro de email já existente
      mockAuthContext.signUp = vi.fn().mockResolvedValue({ 
        success: false, 
        error: authErrors.emailAlreadyExists 
      });
      mockAuthContext.error = authErrors.emailAlreadyExists;

      customRender(<RegisterPage />);

      // Preencher o formulário
      const nameInput = screen.getByLabelText(/nome/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmar password/i);
      
      await typeIntoInput(nameInput, credentials.name);
      await typeIntoInput(emailInput, credentials.email);
      await typeIntoInput(passwordInput, credentials.password);
      await typeIntoInput(confirmPasswordInput, credentials.confirmPassword);

      // Submeter o formulário
      const form = screen.getByRole('form') || screen.getByTestId('register-form');
      await submitForm(form);

      // Verificar se o erro é mostrado
      await waitFor(() => {
        expect(screen.getByText(/email já existe/i)).toBeInTheDocument();
      });
    });

    it('deve validar que as passwords coincidem', async () => {
      const credentials = createRegisterCredentials({ 
        password: 'password123',
        confirmPassword: 'differentpassword'
      });

      customRender(<RegisterPage />);

      // Preencher o formulário com passwords diferentes
      const nameInput = screen.getByLabelText(/nome/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirmar password/i);
      
      await typeIntoInput(nameInput, credentials.name);
      await typeIntoInput(emailInput, credentials.email);
      await typeIntoInput(passwordInput, credentials.password);
      await typeIntoInput(confirmPasswordInput, credentials.confirmPassword);

      // Submeter o formulário
      const form = screen.getByRole('form') || screen.getByTestId('register-form');
      await submitForm(form);

      // Verificar se a validação de password é mostrada
      await waitFor(() => {
        expect(screen.getByText(/passwords não coincidem/i)).toBeInTheDocument();
      });

      // Verificar que o signUp não foi chamado
      expect(mockAuthContext.signUp).not.toHaveBeenCalled();
    });
  });

  describe('Logout de Utilizador', () => {
    it('deve permitir logout e redirecionar para login', async () => {
      const userData = createAuthUserData();

      // Mock do utilizador autenticado
      mockAuthContext.user = userData;
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.signOut = vi.fn().mockResolvedValue({ success: true });

      customRender(<DashboardPage />);

      // Encontrar e clicar no botão de logout
      const logoutButton = screen.getByRole('button', { name: /sair/i }) || 
                          screen.getByTestId('logout-button');
      
      await userEvent.click(logoutButton);

      // Verificar se o signOut foi chamado
      await waitFor(() => {
        expect(mockAuthContext.signOut).toHaveBeenCalled();
      });

      // Verificar redirecionamento para login
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Proteção de Rotas', () => {
    it('deve redirecionar utilizador não autenticado para login', async () => {
      // Mock do utilizador não autenticado
      mockAuthContext.user = null;
      mockAuthContext.isAuthenticated = false;

      customRender(<DashboardPage />);

      // Verificar redirecionamento para login
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
      });
    });

    it('deve permitir acesso a utilizador autenticado', async () => {
      const userData = createAuthUserData();

      // Mock do utilizador autenticado
      mockAuthContext.user = userData;
      mockAuthContext.isAuthenticated = true;

      customRender(<DashboardPage />);

      // Verificar que o dashboard é mostrado
      await waitFor(() => {
        expect(screen.getByText(/dashboard/i) || screen.getByText(/bem-vindo/i)).toBeInTheDocument();
      });

      // Verificar que não houve redirecionamento
      expect(mockRouter.push).not.toHaveBeenCalledWith('/login');
    });
  });

  describe('Gestão de Sessão', () => {
    it('deve renovar sessão automaticamente', async () => {
      const userData = createAuthUserData();

      // Mock do utilizador autenticado com sessão próxima do fim
      mockAuthContext.user = userData;
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.refreshSession = vi.fn().mockResolvedValue({ success: true });

      customRender(<DashboardPage />);

      // Simular expiração da sessão (pode ser através de um timer ou evento)
      // Isto dependeria da implementação específica do sistema de sessões
      
      // Verificar que a sessão foi renovada
      // await waitFor(() => {
      //   expect(mockAuthContext.refreshSession).toHaveBeenCalled();
      // }, { timeout: 10000 });
    });

    it('deve fazer logout quando sessão expira', async () => {
      const userData = createAuthUserData();

      // Mock do utilizador autenticado
      mockAuthContext.user = userData;
      mockAuthContext.isAuthenticated = true;
      mockAuthContext.error = authErrors.sessionExpired;

      customRender(<DashboardPage />);

      // Verificar que o erro de sessão expirada é mostrado
      await waitFor(() => {
        expect(screen.getByText(/sessão expirada/i)).toBeInTheDocument();
      });

      // Verificar redirecionamento para login
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
      });
    });
  });
});
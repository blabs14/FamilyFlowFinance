import { vi } from 'vitest';

// Interfaces para dados de autenticação
export interface AuthUserData {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
  role: 'admin' | 'user' | 'viewer';
  preferences: {
    language: string;
    currency: string;
    timezone: string;
    notifications: boolean;
  };
}

export interface AuthSessionData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: AuthUserData;
}

export interface AuthErrorData {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

export interface AuthStateData {
  user: AuthUserData | null;
  session: AuthSessionData | null;
  loading: boolean;
  error: AuthErrorData | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface ResetPasswordData {
  email: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ProfileUpdateData {
  name?: string;
  avatar_url?: string;
  phone?: string;
  preferences?: Partial<AuthUserData['preferences']>;
}

// Factory para criar dados de utilizador autenticado
export const createAuthUserData = (overrides: Partial<AuthUserData> = {}): AuthUserData => ({
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  name: 'Utilizador Teste',
  avatar_url: 'https://example.com/avatar.jpg',
  phone: '+351912345678',
  email_verified: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  last_sign_in_at: '2024-01-15T09:00:00Z',
  role: 'user',
  preferences: {
    language: 'pt-PT',
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    notifications: true,
  },
  ...overrides,
});

// Factory para criar dados de sessão
export const createAuthSessionData = (overrides: Partial<AuthSessionData> = {}): AuthSessionData => {
  const user = createAuthUserData(overrides.user);
  const expiresIn = 3600; // 1 hora
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  
  return {
    access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: user.id, email: user.email, exp: expiresAt }))}`,
    refresh_token: `refresh_${Math.random().toString(36).substr(2, 32)}`,
    expires_in: expiresIn,
    expires_at: expiresAt,
    token_type: 'bearer',
    user,
    ...overrides,
  };
};

// Factory para criar dados de erro de autenticação
export const createAuthErrorData = (overrides: Partial<AuthErrorData> = {}): AuthErrorData => ({
  message: 'Erro de autenticação',
  status: 401,
  code: 'AUTH_ERROR',
  details: null,
  ...overrides,
});

// Factory para criar estado de autenticação
export const createAuthStateData = (overrides: Partial<AuthStateData> = {}): AuthStateData => {
  const session = overrides.session !== undefined ? overrides.session : createAuthSessionData();
  const user = session?.user || null;
  
  return {
    user,
    session,
    loading: false,
    error: null,
    isAuthenticated: !!user,
    ...overrides,
  };
};

// Factory para criar credenciais de login
export const createLoginCredentials = (overrides: Partial<LoginCredentials> = {}): LoginCredentials => ({
  email: 'test@example.com',
  password: 'password123',
  remember: false,
  ...overrides,
});

// Factory para criar credenciais de registo
export const createRegisterCredentials = (overrides: Partial<RegisterCredentials> = {}): RegisterCredentials => ({
  email: 'newuser@example.com',
  password: 'password123',
  name: 'Novo Utilizador',
  confirmPassword: 'password123',
  acceptTerms: true,
  ...overrides,
});

// Factory para criar dados de reset de password
export const createResetPasswordData = (overrides: Partial<ResetPasswordData> = {}): ResetPasswordData => ({
  email: 'test@example.com',
  ...overrides,
});

// Factory para criar dados de alteração de password
export const createChangePasswordData = (overrides: Partial<ChangePasswordData> = {}): ChangePasswordData => ({
  currentPassword: 'oldpassword123',
  newPassword: 'newpassword123',
  confirmPassword: 'newpassword123',
  ...overrides,
});

// Factory para criar dados de atualização de perfil
export const createProfileUpdateData = (overrides: Partial<ProfileUpdateData> = {}): ProfileUpdateData => ({
  name: 'Nome Atualizado',
  phone: '+351987654321',
  preferences: {
    language: 'en-US',
    notifications: false,
  },
  ...overrides,
});

// Estados de autenticação pré-definidos
export const authStates = {
  // Utilizador não autenticado
  unauthenticated: createAuthStateData({
    user: null,
    session: null,
    isAuthenticated: false,
  }),
  
  // Utilizador autenticado
  authenticated: createAuthStateData(),
  
  // Estado de carregamento
  loading: createAuthStateData({
    loading: true,
  }),
  
  // Estado de erro
  error: createAuthStateData({
    user: null,
    session: null,
    isAuthenticated: false,
    error: createAuthErrorData(),
  }),
  
  // Utilizador admin
  admin: createAuthStateData({
    user: createAuthUserData({ role: 'admin' }),
  }),
  
  // Utilizador com email não verificado
  unverified: createAuthStateData({
    user: createAuthUserData({ email_verified: false }),
  }),
};

// Tipos de erro comuns
export const authErrors = {
  invalidCredentials: createAuthErrorData({
    message: 'Credenciais inválidas',
    status: 401,
    code: 'INVALID_CREDENTIALS',
  }),
  
  emailNotVerified: createAuthErrorData({
    message: 'Email não verificado',
    status: 403,
    code: 'EMAIL_NOT_VERIFIED',
  }),
  
  userNotFound: createAuthErrorData({
    message: 'Utilizador não encontrado',
    status: 404,
    code: 'USER_NOT_FOUND',
  }),
  
  emailAlreadyExists: createAuthErrorData({
    message: 'Email já existe',
    status: 409,
    code: 'EMAIL_ALREADY_EXISTS',
  }),
  
  weakPassword: createAuthErrorData({
    message: 'Password muito fraca',
    status: 400,
    code: 'WEAK_PASSWORD',
  }),
  
  sessionExpired: createAuthErrorData({
    message: 'Sessão expirada',
    status: 401,
    code: 'SESSION_EXPIRED',
  }),
  
  networkError: createAuthErrorData({
    message: 'Erro de rede',
    status: 500,
    code: 'NETWORK_ERROR',
  }),
};

// Mocks para serviços de autenticação
export const createMockAuthService = () => ({
  signIn: vi.fn().mockResolvedValue({ data: createAuthSessionData(), error: null }),
  signUp: vi.fn().mockResolvedValue({ data: createAuthUserData(), error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  resetPassword: vi.fn().mockResolvedValue({ error: null }),
  changePassword: vi.fn().mockResolvedValue({ error: null }),
  updateProfile: vi.fn().mockResolvedValue({ data: createAuthUserData(), error: null }),
  refreshSession: vi.fn().mockResolvedValue({ data: createAuthSessionData(), error: null }),
  verifyEmail: vi.fn().mockResolvedValue({ error: null }),
  resendVerification: vi.fn().mockResolvedValue({ error: null }),
  getUser: vi.fn().mockResolvedValue({ data: createAuthUserData(), error: null }),
  getSession: vi.fn().mockResolvedValue({ data: createAuthSessionData(), error: null }),
});

// Mock do contexto de autenticação
export const createMockAuthContext = (state: Partial<AuthStateData> = {}) => {
  const authState = createAuthStateData(state);
  
  return {
    ...authState,
    signIn: vi.fn().mockResolvedValue({ success: true }),
    signUp: vi.fn().mockResolvedValue({ success: true }),
    signOut: vi.fn().mockResolvedValue({ success: true }),
    resetPassword: vi.fn().mockResolvedValue({ success: true }),
    changePassword: vi.fn().mockResolvedValue({ success: true }),
    updateProfile: vi.fn().mockResolvedValue({ success: true }),
    refreshSession: vi.fn().mockResolvedValue({ success: true }),
    verifyEmail: vi.fn().mockResolvedValue({ success: true }),
    clearError: vi.fn(),
  };
};

// Mock do hook useAuth
export const createMockUseAuth = (state: Partial<AuthStateData> = {}) => {
  return vi.fn().mockReturnValue(createMockAuthContext(state));
};

// Utility para simular diferentes cenários de autenticação
export const authScenarios = {
  // Login bem-sucedido
  successfulLogin: {
    request: createLoginCredentials(),
    response: { data: createAuthSessionData(), error: null },
  },
  
  // Login falhado
  failedLogin: {
    request: createLoginCredentials({ password: 'wrongpassword' }),
    response: { data: null, error: authErrors.invalidCredentials },
  },
  
  // Registo bem-sucedido
  successfulRegister: {
    request: createRegisterCredentials(),
    response: { data: createAuthUserData(), error: null },
  },
  
  // Registo falhado (email já existe)
  failedRegister: {
    request: createRegisterCredentials({ email: 'existing@example.com' }),
    response: { data: null, error: authErrors.emailAlreadyExists },
  },
  
  // Reset de password bem-sucedido
  successfulReset: {
    request: createResetPasswordData(),
    response: { error: null },
  },
  
  // Sessão expirada
  expiredSession: {
    state: authStates.error,
    error: authErrors.sessionExpired,
  },
};

// Utility para resetar todos os mocks de autenticação
export const resetAuthMocks = () => {
  vi.clearAllMocks();
};

// Utility para simular delay em operações de autenticação
export const createAuthDelay = (ms: number = 500) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Utility para criar tokens JWT de teste
export const createTestJWT = (payload: any = {}) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const defaultPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  
  const finalPayload = { ...defaultPayload, ...payload };
  
  return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(finalPayload))}.signature`;
};
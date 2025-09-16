/**
 * Test Utilities - Helpers reutilizáveis para testes
 * Criado como parte da nova estratégia de testes simplificada
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { expect } from 'vitest';

// Mock do AuthContext
const AuthContext = React.createContext(null);
const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const value = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' }
    },
    loading: false,
    signOut: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn()
  };
  return React.createElement(AuthContext.Provider, { value }, children);
};

// Mock do AuthContext simplificado
export const mockAuthContext = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' }
  },
  loading: false,
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn()
};

// Provider wrapper para testes
interface TestProvidersProps {
  children: React.ReactNode;
}

const TestProviders: React.FC<TestProvidersProps> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return React.createElement(
    AuthProvider,
    null,
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        BrowserRouter,
        null,
        children
      )
    )
  );
};

// Função de render customizada
export const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui, {
    wrapper: TestProviders,
  });
};

// Helper functions para assertions comuns
export const expectElementToBeVisible = (text: string) => {
  expect(screen.getByText(text)).toBeInTheDocument();
};

export const expectElementToHaveText = (label: string, value: string) => {
  const element = screen.getByText(new RegExp(label, 'i'));
  expect(element).toBeInTheDocument();
  expect(element.textContent).toContain(value);
};

export const waitForLoadingToFinish = async () => {
  const { waitForElementToBeRemoved } = await import('@testing-library/react');
  try {
    await waitForElementToBeRemoved(() => screen.queryByText(/carregando/i), {
      timeout: 3000
    });
  } catch {
    // Loading element might not be present
  }
};

// Mock helpers para serviços
export const createMockService = (methods: Record<string, any>) => {
  const mockService: Record<string, any> = {};
  
  Object.keys(methods).forEach(method => {
    mockService[method] = vi.fn().mockResolvedValue(methods[method]);
  });
  
  return mockService;
};

// Helper para limpar mocks
export const clearAllMocks = () => {
  vi.clearAllMocks();
};

// Mock do router
export const mockNavigate = vi.fn();
export const mockUseNavigate = () => mockNavigate;

// Mock do toast
export const mockToast = vi.fn();
export const mockUseToast = () => ({ toast: mockToast });
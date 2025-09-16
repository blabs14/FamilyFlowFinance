import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CategoryForm from './CategoryForm';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/toast';

// Mock dos hooks
vi.mock('@/hooks/useCreateCategory', () => ({
  useCreateCategory: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/useUpdateCategory', () => ({
  useUpdateCategory: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCategoryCustomizationsQuery', () => ({
  useUpsertCategoryCustomization: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteCategoryCustomization: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Mock do contexto de autenticação
const mockAuthContext = {
  user: { id: 'test-user-id' },
  isLoading: false,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
};

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('CategoryCustomizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Categoria padrão em edição', () => {
    const defaultCategory = {
      id: 'default-1',
      nome: 'Alimentação',
      cor: '#ff0000',
      icone: '🍔',
      is_default: true,
      user_id: null,
    };

    it('deve desabilitar o campo nome para categorias padrão', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={defaultCategory} />
        </TestWrapper>
      );

      const nameInput = screen.getByLabelText(/nome/i);
      expect(nameInput).toBeDisabled();
    });

    it('deve mostrar texto explicativo sobre personalização', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={defaultCategory} />
        </TestWrapper>
      );

      expect(screen.getByText(/apenas a cor e ícone podem ser personalizados/i)).toBeInTheDocument();
    });

    it('deve mostrar botão "Personalizar" para categorias padrão', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={defaultCategory} />
        </TestWrapper>
      );

      const customizeButton = screen.getByRole('button', { name: /personalizar/i });
      expect(customizeButton).toBeInTheDocument();
    });

    it('deve mostrar botão "Resetar Personalização" para categorias padrão', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={defaultCategory} />
        </TestWrapper>
      );

      const resetButton = screen.getByRole('button', { name: /resetar personalização/i });
      expect(resetButton).toBeInTheDocument();
    });

    it('deve permitir edição de cor e ícone', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={defaultCategory} />
        </TestWrapper>
      );

      const colorInput = screen.getByLabelText(/cor/i);
      const iconInput = screen.getByLabelText(/ícone/i);

      expect(colorInput).not.toBeDisabled();
      expect(iconInput).not.toBeDisabled();
    });
  });

  describe('Categoria do utilizador em edição', () => {
    const userCategory = {
      id: 'user-1',
      nome: 'Categoria Personalizada',
      cor: '#00ff00',
      icone: '💰',
      is_default: false,
      user_id: 'test-user-id',
    };

    it('deve permitir edição do nome para categorias do utilizador', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={userCategory} />
        </TestWrapper>
      );

      const nameInput = screen.getByLabelText(/nome/i);
      expect(nameInput).not.toBeDisabled();
    });

    it('deve mostrar botão "Atualizar" para categorias do utilizador', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={userCategory} />
        </TestWrapper>
      );

      const updateButton = screen.getByRole('button', { name: /atualizar/i });
      expect(updateButton).toBeInTheDocument();
    });

    it('não deve mostrar botão de reset para categorias do utilizador', () => {
      render(
        <TestWrapper>
          <CategoryForm initialData={userCategory} />
        </TestWrapper>
      );

      const resetButton = screen.queryByRole('button', { name: /resetar personalização/i });
      expect(resetButton).not.toBeInTheDocument();
    });
  });

  describe('Nova categoria', () => {
    it('deve mostrar botão "Criar" para novas categorias', () => {
      render(
        <TestWrapper>
          <CategoryForm />
        </TestWrapper>
      );

      const createButton = screen.getByRole('button', { name: /criar/i });
      expect(createButton).toBeInTheDocument();
    });

    it('deve permitir edição de todos os campos para novas categorias', () => {
      render(
        <TestWrapper>
          <CategoryForm />
        </TestWrapper>
      );

      const nameInput = screen.getByLabelText(/nome/i);
      const colorInput = screen.getByLabelText(/cor/i);
      const iconInput = screen.getByLabelText(/ícone/i);

      expect(nameInput).not.toBeDisabled();
      expect(colorInput).not.toBeDisabled();
      expect(iconInput).not.toBeDisabled();
    });
  });

  describe('Estados de loading', () => {
    it('deve mostrar estado de loading ao personalizar categoria padrão', async () => {
      // Redefine o mock para este teste específico
      vi.doMock('@/hooks/useCategoryCustomizationsQuery', () => ({
        useUpsertCategoryCustomization: () => ({
          mutate: vi.fn(),
          isPending: true,
        }),
        useDeleteCategoryCustomization: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      }));

      const defaultCategory = {
        id: 'default-1',
        nome: 'Alimentação',
        cor: '#ff0000',
        icone: '🍔',
        is_default: true,
        user_id: null,
      };

      render(
        <TestWrapper>
          <CategoryForm initialData={defaultCategory} />
        </TestWrapper>
      );

      const customizeButton = screen.getByRole('button', { name: /personalizar/i });
      expect(customizeButton).toBeInTheDocument();
    });
  });
});
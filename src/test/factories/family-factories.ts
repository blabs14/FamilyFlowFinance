import { vi } from 'vitest';

// Interfaces para dados de família
export interface FamilyData {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface FamilyMemberData {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'viewer';
  name: string;
  email: string;
  joined_at: string;
  is_active: boolean;
}

export interface FamilyAccountData {
  id: string;
  family_id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment';
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

export interface FamilyTransactionData {
  id: string;
  family_id: string;
  account_id: string;
  amount: number;
  description: string;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  created_by: string;
  created_at: string;
}

export interface FamilyBudgetData {
  id: string;
  family_id: string;
  name: string;
  category: string;
  amount: number;
  period: 'monthly' | 'yearly';
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

export interface FamilyGoalData {
  id: string;
  family_id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

// Factory para criar dados de família
export const createFamilyData = (overrides: Partial<FamilyData> = {}): FamilyData => ({
  id: `family-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Família Silva',
  description: 'Família de teste para desenvolvimento',
  created_by: 'user-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  is_active: true,
  ...overrides,
});

// Factory para criar dados de membro da família
export const createFamilyMemberData = (overrides: Partial<FamilyMemberData> = {}): FamilyMemberData => ({
  id: `member-${Math.random().toString(36).substr(2, 9)}`,
  family_id: 'family-123',
  user_id: 'user-123',
  role: 'member',
  name: 'João Silva',
  email: 'joao@example.com',
  joined_at: '2024-01-01T00:00:00Z',
  is_active: true,
  ...overrides,
});

// Factory para criar lista de membros da família
export const createFamilyMembersList = (count: number = 3): FamilyMemberData[] => {
  const members = [];
  for (let i = 0; i < count; i++) {
    members.push(createFamilyMemberData({
      name: `Membro ${i + 1}`,
      email: `membro${i + 1}@example.com`,
      role: i === 0 ? 'admin' : 'member',
    }));
  }
  return members;
};

// Factory para criar dados de conta da família
export const createFamilyAccountData = (overrides: Partial<FamilyAccountData> = {}): FamilyAccountData => ({
  id: `account-${Math.random().toString(36).substr(2, 9)}`,
  family_id: 'family-123',
  name: 'Conta Principal',
  type: 'checking',
  balance: 5000.00,
  currency: 'EUR',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Factory para criar lista de contas da família
export const createFamilyAccountsList = (count: number = 3): FamilyAccountData[] => {
  const accounts = [];
  const types: FamilyAccountData['type'][] = ['checking', 'savings', 'credit', 'investment'];
  
  for (let i = 0; i < count; i++) {
    accounts.push(createFamilyAccountData({
      name: `Conta ${i + 1}`,
      type: types[i % types.length],
      balance: (i + 1) * 1000,
    }));
  }
  return accounts;
};

// Factory para criar dados de transação da família
export const createFamilyTransactionData = (overrides: Partial<FamilyTransactionData> = {}): FamilyTransactionData => ({
  id: `transaction-${Math.random().toString(36).substr(2, 9)}`,
  family_id: 'family-123',
  account_id: 'account-123',
  amount: -50.00,
  description: 'Compra no supermercado',
  category: 'Alimentação',
  type: 'expense',
  date: '2024-01-15',
  created_by: 'user-123',
  created_at: '2024-01-15T10:00:00Z',
  ...overrides,
});

// Factory para criar lista de transações da família
export const createFamilyTransactionsList = (count: number = 5): FamilyTransactionData[] => {
  const transactions = [];
  const categories = ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer'];
  const types: FamilyTransactionData['type'][] = ['expense', 'income', 'transfer'];
  
  for (let i = 0; i < count; i++) {
    const isIncome = i % 3 === 0;
    transactions.push(createFamilyTransactionData({
      amount: isIncome ? 1000 + (i * 100) : -(50 + (i * 10)),
      description: isIncome ? `Salário ${i + 1}` : `Despesa ${i + 1}`,
      category: categories[i % categories.length],
      type: isIncome ? 'income' : 'expense',
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    }));
  }
  return transactions;
};

// Factory para criar dados de orçamento da família
export const createFamilyBudgetData = (overrides: Partial<FamilyBudgetData> = {}): FamilyBudgetData => ({
  id: `budget-${Math.random().toString(36).substr(2, 9)}`,
  family_id: 'family-123',
  name: 'Orçamento Alimentação',
  category: 'Alimentação',
  amount: 500.00,
  period: 'monthly',
  start_date: '2024-01-01',
  is_active: true,
  ...overrides,
});

// Factory para criar lista de orçamentos da família
export const createFamilyBudgetsList = (count: number = 4): FamilyBudgetData[] => {
  const budgets = [];
  const categories = ['Alimentação', 'Transporte', 'Saúde', 'Lazer'];
  
  for (let i = 0; i < count; i++) {
    budgets.push(createFamilyBudgetData({
      name: `Orçamento ${categories[i]}`,
      category: categories[i],
      amount: (i + 1) * 200,
    }));
  }
  return budgets;
};

// Factory para criar dados de objetivo da família
export const createFamilyGoalData = (overrides: Partial<FamilyGoalData> = {}): FamilyGoalData => ({
  id: `goal-${Math.random().toString(36).substr(2, 9)}`,
  family_id: 'family-123',
  name: 'Férias de Verão',
  description: 'Poupança para férias em família',
  target_amount: 3000.00,
  current_amount: 1500.00,
  target_date: '2024-07-01',
  category: 'Lazer',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Factory para criar lista de objetivos da família
export const createFamilyGoalsList = (count: number = 3): FamilyGoalData[] => {
  const goals = [];
  const goalTypes = [
    { name: 'Férias de Verão', category: 'Lazer', target: 3000 },
    { name: 'Fundo de Emergência', category: 'Poupança', target: 10000 },
    { name: 'Carro Novo', category: 'Transporte', target: 25000 },
  ];
  
  for (let i = 0; i < count; i++) {
    const goalType = goalTypes[i % goalTypes.length];
    goals.push(createFamilyGoalData({
      name: goalType.name,
      category: goalType.category,
      target_amount: goalType.target,
      current_amount: goalType.target * 0.3, // 30% do objetivo
    }));
  }
  return goals;
};

// Mocks para serviços de família
export const createMockFamilyService = () => ({
  getFamilyData: vi.fn().mockResolvedValue(createFamilyData()),
  getFamilyMembers: vi.fn().mockResolvedValue(createFamilyMembersList()),
  getFamilyAccounts: vi.fn().mockResolvedValue(createFamilyAccountsList()),
  getFamilyTransactions: vi.fn().mockResolvedValue(createFamilyTransactionsList()),
  getFamilyBudgets: vi.fn().mockResolvedValue(createFamilyBudgetsList()),
  getFamilyGoals: vi.fn().mockResolvedValue(createFamilyGoalsList()),
  createFamily: vi.fn().mockResolvedValue({ success: true }),
  updateFamily: vi.fn().mockResolvedValue({ success: true }),
  deleteFamily: vi.fn().mockResolvedValue({ success: true }),
  inviteMember: vi.fn().mockResolvedValue({ success: true }),
  removeMember: vi.fn().mockResolvedValue({ success: true }),
  updateMemberRole: vi.fn().mockResolvedValue({ success: true }),
});

// Utility para resetar todos os mocks de família
export const resetFamilyMocks = () => {
  vi.clearAllMocks();
};

// Utility para criar delay em testes
export const createTestDelay = (ms: number = 100) => 
  new Promise(resolve => setTimeout(resolve, ms));
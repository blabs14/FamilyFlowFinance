import { vi } from 'vitest';

// Constantes para tipos e categorias
export const ACCOUNT_TYPES = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  CREDIT: 'credit',
  INVESTMENT: 'investment',
  CASH: 'cash',
} as const;

export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
} as const;

export const TRANSACTION_CATEGORIES = {
  FOOD: 'Alimentação',
  TRANSPORT: 'Transporte',
  HEALTH: 'Saúde',
  ENTERTAINMENT: 'Lazer',
  EDUCATION: 'Educação',
  HOUSING: 'Habitação',
  UTILITIES: 'Utilidades',
  SHOPPING: 'Compras',
  SALARY: 'Salário',
  FREELANCE: 'Freelance',
  INVESTMENT_INCOME: 'Rendimentos',
  OTHER: 'Outros',
} as const;

// Interfaces para dados pessoais
export interface PersonalAccountData {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
  balance: number;
  currency: string;
  bank_name?: string;
  account_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonalTransactionData {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  description: string;
  category: string;
  subcategory?: string;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  tags?: string[];
  receipt_url?: string;
  is_recurring: boolean;
  created_at: string;
}

export interface PersonalBudgetData {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date?: string;
  alert_threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface PersonalGoalData {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonalReminderData {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  type: 'payment' | 'goal' | 'budget' | 'general';
  due_date: string;
  is_completed: boolean;
  is_recurring: boolean;
  recurrence_pattern?: string;
  created_at: string;
}

export interface PersonalInsightData {
  period: string;
  total_income: number;
  total_expenses: number;
  net_income: number;
  top_categories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  budget_performance: Array<{
    budget_name: string;
    budgeted: number;
    spent: number;
    remaining: number;
    percentage_used: number;
  }>;
  goal_progress: Array<{
    goal_name: string;
    target: number;
    current: number;
    percentage: number;
    days_remaining: number;
  }>;
}

// Factory para criar dados de conta pessoal
export const createPersonalAccountData = (overrides: Partial<PersonalAccountData> = {}): PersonalAccountData => ({
  id: `account-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'user-123',
  name: 'Conta Corrente Principal',
  type: 'checking',
  balance: 2500.00,
  currency: 'EUR',
  bank_name: 'Banco Teste',
  account_number: '****1234',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Factory para criar lista de contas pessoais
export const createPersonalAccountsList = (count: number = 4): PersonalAccountData[] => {
  const accounts = [];
  const types: PersonalAccountData['type'][] = ['checking', 'savings', 'credit', 'investment', 'cash'];
  const banks = ['Banco Teste', 'Banco Digital', 'Caixa Económica', 'Banco Investimento'];
  
  for (let i = 0; i < count; i++) {
    accounts.push(createPersonalAccountData({
      name: `Conta ${i + 1}`,
      type: types[i % types.length],
      balance: (i + 1) * 1000 + Math.random() * 500,
      bank_name: banks[i % banks.length],
      account_number: `****${String(1234 + i).padStart(4, '0')}`,
    }));
  }
  return accounts;
};

// Factory para criar dados de transação pessoal
export const createPersonalTransactionData = (overrides: Partial<PersonalTransactionData> = {}): PersonalTransactionData => ({
  id: `transaction-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'user-123',
  account_id: 'account-123',
  amount: -75.50,
  description: 'Compra no supermercado',
  category: 'Alimentação',
  subcategory: 'Supermercado',
  type: 'expense',
  date: '2024-01-15',
  tags: ['essencial', 'casa'],
  is_recurring: false,
  created_at: '2024-01-15T10:30:00Z',
  ...overrides,
});

// Factory para criar lista de transações pessoais
export const createPersonalTransactionsList = (count: number = 10): PersonalTransactionData[] => {
  const transactions = [];
  const categories = [
    { name: 'Alimentação', subcategories: ['Supermercado', 'Restaurante', 'Takeaway'] },
    { name: 'Transporte', subcategories: ['Combustível', 'Transporte Público', 'Taxi'] },
    { name: 'Saúde', subcategories: ['Farmácia', 'Consulta', 'Exames'] },
    { name: 'Educação', subcategories: ['Livros', 'Cursos', 'Material'] },
    { name: 'Lazer', subcategories: ['Cinema', 'Desporto', 'Hobbies'] },
  ];
  
  for (let i = 0; i < count; i++) {
    const isIncome = i % 5 === 0;
    const category = categories[i % categories.length];
    const subcategory = category.subcategories[i % category.subcategories.length];
    
    transactions.push(createPersonalTransactionData({
      amount: isIncome ? 2000 + (i * 50) : -(25 + (i * 15)),
      description: isIncome ? `Salário ${i + 1}` : `${subcategory} ${i + 1}`,
      category: category.name,
      subcategory: subcategory,
      type: isIncome ? 'income' : 'expense',
      date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      tags: isIncome ? ['salário', 'regular'] : ['despesa', 'pessoal'],
    }));
  }
  return transactions;
};

// Factory para criar dados de orçamento pessoal
export const createPersonalBudgetData = (overrides: Partial<PersonalBudgetData> = {}): PersonalBudgetData => ({
  id: `budget-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'user-123',
  name: 'Orçamento Alimentação',
  category: 'Alimentação',
  amount: 400.00,
  spent: 250.00,
  period: 'monthly',
  start_date: '2024-01-01',
  alert_threshold: 80,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Factory para criar lista de orçamentos pessoais
export const createPersonalBudgetsList = (count: number = 5): PersonalBudgetData[] => {
  const budgets = [];
  const categories = ['Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação'];
  
  for (let i = 0; i < count; i++) {
    const amount = (i + 1) * 150;
    const spent = amount * (0.3 + (i * 0.15)); // Variação no gasto
    
    budgets.push(createPersonalBudgetData({
      name: `Orçamento ${categories[i]}`,
      category: categories[i],
      amount: amount,
      spent: Math.min(spent, amount),
      alert_threshold: 75 + (i * 5),
    }));
  }
  return budgets;
};

// Factory para criar dados de objetivo pessoal
export const createPersonalGoalData = (overrides: Partial<PersonalGoalData> = {}): PersonalGoalData => ({
  id: `goal-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'user-123',
  name: 'Fundo de Emergência',
  description: 'Poupança para emergências (6 meses de despesas)',
  target_amount: 12000.00,
  current_amount: 4500.00,
  target_date: '2024-12-31',
  category: 'Poupança',
  priority: 'high',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  ...overrides,
});

// Factory para criar lista de objetivos pessoais
export const createPersonalGoalsList = (count: number = 4): PersonalGoalData[] => {
  const goals = [];
  const goalTypes = [
    { name: 'Fundo de Emergência', category: 'Poupança', target: 12000, priority: 'high' as const },
    { name: 'Férias', category: 'Lazer', target: 2500, priority: 'medium' as const },
    { name: 'Novo Computador', category: 'Tecnologia', target: 1500, priority: 'low' as const },
    { name: 'Curso de Especialização', category: 'Educação', target: 800, priority: 'medium' as const },
  ];
  
  for (let i = 0; i < count; i++) {
    const goalType = goalTypes[i % goalTypes.length];
    goals.push(createPersonalGoalData({
      name: goalType.name,
      category: goalType.category,
      target_amount: goalType.target,
      current_amount: goalType.target * (0.2 + (i * 0.15)), // Progresso variável
      priority: goalType.priority,
    }));
  }
  return goals;
};

// Factory para criar dados de lembrete pessoal
export const createPersonalReminderData = (overrides: Partial<PersonalReminderData> = {}): PersonalReminderData => ({
  id: `reminder-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'user-123',
  title: 'Pagamento da Renda',
  description: 'Lembrete para pagar a renda do apartamento',
  type: 'payment',
  due_date: '2024-02-01',
  is_completed: false,
  is_recurring: true,
  recurrence_pattern: 'monthly',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Factory para criar lista de lembretes pessoais
export const createPersonalRemindersList = (count: number = 5): PersonalReminderData[] => {
  const reminders = [];
  const reminderTypes = [
    { title: 'Pagamento da Renda', type: 'payment' as const, recurring: true },
    { title: 'Revisão do Orçamento', type: 'budget' as const, recurring: true },
    { title: 'Verificar Progresso dos Objetivos', type: 'goal' as const, recurring: true },
    { title: 'Backup dos Dados', type: 'general' as const, recurring: false },
    { title: 'Renovar Seguro', type: 'payment' as const, recurring: false },
  ];
  
  for (let i = 0; i < count; i++) {
    const reminderType = reminderTypes[i % reminderTypes.length];
    reminders.push(createPersonalReminderData({
      title: reminderType.title,
      type: reminderType.type,
      is_recurring: reminderType.recurring,
      due_date: `2024-0${(i % 12) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      is_completed: i % 3 === 0, // Alguns já completados
    }));
  }
  return reminders;
};

// Factory para criar dados de insights pessoais
export const createPersonalInsightData = (overrides: Partial<PersonalInsightData> = {}): PersonalInsightData => ({
  period: '2024-01',
  total_income: 3500.00,
  total_expenses: 2800.00,
  net_income: 700.00,
  top_categories: [
    { category: 'Alimentação', amount: 450.00, percentage: 16.1 },
    { category: 'Transporte', amount: 320.00, percentage: 11.4 },
    { category: 'Saúde', amount: 280.00, percentage: 10.0 },
    { category: 'Lazer', amount: 250.00, percentage: 8.9 },
    { category: 'Educação', amount: 200.00, percentage: 7.1 },
  ],
  budget_performance: [
    { budget_name: 'Alimentação', budgeted: 400.00, spent: 450.00, remaining: -50.00, percentage_used: 112.5 },
    { budget_name: 'Transporte', budgeted: 350.00, spent: 320.00, remaining: 30.00, percentage_used: 91.4 },
    { budget_name: 'Saúde', budgeted: 300.00, spent: 280.00, remaining: 20.00, percentage_used: 93.3 },
    { budget_name: 'Lazer', budgeted: 200.00, spent: 250.00, remaining: -50.00, percentage_used: 125.0 },
  ],
  goal_progress: [
    { goal_name: 'Fundo de Emergência', target: 12000.00, current: 4500.00, percentage: 37.5, days_remaining: 335 },
    { goal_name: 'Férias', target: 2500.00, current: 800.00, percentage: 32.0, days_remaining: 150 },
    { goal_name: 'Novo Computador', target: 1500.00, current: 300.00, percentage: 20.0, days_remaining: 200 },
  ],
  ...overrides,
});

// Mocks para serviços pessoais
export const createMockPersonalService = () => ({
  getPersonalAccounts: vi.fn().mockResolvedValue(createPersonalAccountsList()),
  getPersonalTransactions: vi.fn().mockResolvedValue(createPersonalTransactionsList()),
  getPersonalBudgets: vi.fn().mockResolvedValue(createPersonalBudgetsList()),
  getPersonalGoals: vi.fn().mockResolvedValue(createPersonalGoalsList()),
  getPersonalReminders: vi.fn().mockResolvedValue(createPersonalRemindersList()),
  getPersonalInsights: vi.fn().mockResolvedValue(createPersonalInsightData()),
  createAccount: vi.fn().mockResolvedValue({ success: true }),
  updateAccount: vi.fn().mockResolvedValue({ success: true }),
  deleteAccount: vi.fn().mockResolvedValue({ success: true }),
  createTransaction: vi.fn().mockResolvedValue({ success: true }),
  updateTransaction: vi.fn().mockResolvedValue({ success: true }),
  deleteTransaction: vi.fn().mockResolvedValue({ success: true }),
  createBudget: vi.fn().mockResolvedValue({ success: true }),
  updateBudget: vi.fn().mockResolvedValue({ success: true }),
  deleteBudget: vi.fn().mockResolvedValue({ success: true }),
  createGoal: vi.fn().mockResolvedValue({ success: true }),
  updateGoal: vi.fn().mockResolvedValue({ success: true }),
  deleteGoal: vi.fn().mockResolvedValue({ success: true }),
  createReminder: vi.fn().mockResolvedValue({ success: true }),
  updateReminder: vi.fn().mockResolvedValue({ success: true }),
  deleteReminder: vi.fn().mockResolvedValue({ success: true }),
});

// Utility para resetar todos os mocks pessoais
export const resetPersonalMocks = () => {
  vi.clearAllMocks();
};

// Utility para criar dados de teste com relacionamentos
export const createPersonalTestSuite = () => {
  const accounts = createPersonalAccountsList(3);
  const transactions = createPersonalTransactionsList(15);
  const budgets = createPersonalBudgetsList(5);
  const goals = createPersonalGoalsList(4);
  const reminders = createPersonalRemindersList(6);
  const insights = createPersonalInsightData();
  
  // Relacionar transações com contas
  transactions.forEach((transaction, index) => {
    transaction.account_id = accounts[index % accounts.length].id;
  });
  
  return {
    accounts,
    transactions,
    budgets,
    goals,
    reminders,
    insights,
  };
};
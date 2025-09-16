// Tipos para dados de família
export type UnknownRecord = Record<string, unknown>;

export interface Family {
  id: string;
  nome: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  settings?: Record<string, unknown>;
}

export interface FamilyMember {
  id: string;
  user_id: string;
  family_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions?: string[];
  joined_at: string;
  profile?: {
    id: string;
    nome: string;
    foto_url?: string;
  };
}

export interface FamilyInvite {
  id: string;
  family_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  invited_by: string;
  created_at: string;
  expires_at: string;
  token: string;
  accepted_at?: string;
}

// Tipos para notificações familiares
export interface FamilyNotification {
  id: string;
  user_id: string;
  family_id?: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  category?: string;
  lida: boolean | null;
  created_at: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Tipos para KPIs familiares
export interface FamilyKPIs {
  totalBalance: number;
  creditCardDebt: number;
  topGoalProgress: number;
  monthlySavings: number;
  goalsAccountBalance: number;
  totalGoalsValue: number;
  goalsProgressPercentage: number;
  totalBudgetSpent: number;
  totalBudgetAmount: number;
  budgetSpentPercentage: number;
  totalMembers: number;
  pendingInvites: number;
  prevMonthSavings?: number;
  deltaVsPrev?: number;
  overspentBudgetsCount?: number;
}

// Tipos para estados de loading
export interface FamilyLoadingStates {
  family: boolean;
  members: boolean;
  accounts: boolean;
  goals: boolean;
  budgets: boolean;
  transactions: boolean;
  invites: boolean;
  kpis: boolean;
}

// Tipos mínimos de domínio utilizados nas listas
export type FamilyAccount = UnknownRecord & { account_id?: string; id?: string; tipo?: string | null };
export type FamilyGoal = UnknownRecord & { valor_atual?: number | null; valor_objetivo?: number | null; progresso_percentual?: number; total_alocado?: number };
export type FamilyBudget = UnknownRecord;
export type FamilyTransaction = UnknownRecord;

// Tipos para dados familiares
export interface FamilyData {
  family: Family | null;
  members: FamilyMember[];
  myRole: 'owner' | 'admin' | 'member' | 'viewer' | null;
  pendingInvites: FamilyInvite[];
  familyAccounts: FamilyAccount[];
  familyCards: FamilyAccount[];
  familyGoals: FamilyGoal[];
  familyBudgets: FamilyBudget[];
  familyTransactions: FamilyTransaction[];
  familyKPIs: FamilyKPIs;
  isLoading: FamilyLoadingStates;
}

// Tipos para métodos de gestão
export interface FamilyMethods {
  // Gestão de membros
  inviteMember: (email: string, role: 'admin' | 'member' | 'viewer') => Promise<unknown>;
  updateMemberRole: (memberId: string, role: 'admin' | 'member' | 'viewer') => Promise<unknown>;
  removeMember: (memberId: string) => Promise<unknown>;
  updateFamily: (data: UnknownRecord) => Promise<unknown>;
  
  // Gestão de convites
  cancelInvite: (inviteId: string) => Promise<unknown>;
  acceptInvite: (inviteId: string) => Promise<unknown>;
  
  // Eliminação de família
  deleteFamily: () => Promise<unknown>;
  
  // CRUD para dados familiares
  createFamilyAccount: (data: UnknownRecord) => Promise<unknown>;
  updateFamilyAccount: (id: string, data: UnknownRecord) => Promise<unknown>;
  deleteFamilyAccount: (id: string) => Promise<unknown>;
  
  // Nova mutação específica
  updateAccountReservePercentage: (accountId: string, percent: number) => Promise<unknown>;
  
  createFamilyGoal: (data: UnknownRecord) => Promise<unknown>;
  updateFamilyGoal: (id: string, data: UnknownRecord) => Promise<unknown>;
  deleteFamilyGoal: (id: string) => Promise<unknown>;
  
  createFamilyBudget: (data: UnknownRecord) => Promise<unknown>;
  updateFamilyBudget: (id: string, data: UnknownRecord) => Promise<unknown>;
  deleteFamilyBudget: (id: string) => Promise<unknown>;
  
  createFamilyTransaction: (data: UnknownRecord) => Promise<unknown>;
  updateFamilyTransaction: (id: string, data: UnknownRecord) => Promise<unknown>;
  deleteFamilyTransaction: (id: string) => Promise<unknown>;

  // Métodos específicos
  payCreditCard: (accountId: string, amount: number) => Promise<unknown>;
  allocateToGoal: (goalId: string, amount: number, accountId: string) => Promise<unknown>;
  
  // Utilitários
  refetchAll: () => void;
  canEdit: (resourceType: 'account' | 'goal' | 'budget' | 'transaction' | 'member') => boolean;
  canDelete: (resourceType: 'account' | 'goal' | 'budget' | 'transaction' | 'member') => boolean;
}

// Tipo completo do contexto
export interface FamilyContextType extends FamilyData, FamilyMethods {
  switchFamily: (familyId: string) => Promise<void>;
}
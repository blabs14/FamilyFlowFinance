import { Database } from './database.types';

// Tipos das tabelas
export type Account = Database['public']['Tables']['accounts']['Row'];
export type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
export type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export type Goal = Database['public']['Tables']['goals']['Row'];
export type GoalInsert = Database['public']['Tables']['goals']['Insert'];
export type GoalUpdate = Database['public']['Tables']['goals']['Update'];

export type GoalAllocation = Database['public']['Tables']['goal_allocations']['Row'];
export type GoalAllocationInsert = Database['public']['Tables']['goal_allocations']['Insert'];
export type GoalAllocationUpdate = Database['public']['Tables']['goal_allocations']['Update'];

export type Category = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export type CategoryCustomization = Database['public']['Tables']['category_customizations']['Row'];
export type CategoryCustomizationInsert = Database['public']['Tables']['category_customizations']['Insert'];
export type CategoryCustomizationUpdate = Database['public']['Tables']['category_customizations']['Update'];

export type Budget = Database['public']['Tables']['budgets']['Row'];
export type BudgetInsert = Database['public']['Tables']['budgets']['Insert'];
export type BudgetUpdate = Database['public']['Tables']['budgets']['Update'];

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Notification = Database['public']['Tables']['notifications']['Row'];
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update'];

export type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];
export type FixedExpenseInsert = Database['public']['Tables']['fixed_expenses']['Insert'];
export type FixedExpenseUpdate = Database['public']['Tables']['fixed_expenses']['Update'];

export type Family = Database['public']['Tables']['families']['Row'];
export type FamilyInsert = Database['public']['Tables']['families']['Insert'];
export type FamilyUpdate = Database['public']['Tables']['families']['Update'];

export type FamilyMember = Database['public']['Tables']['family_members']['Row'];
export type FamilyMemberInsert = Database['public']['Tables']['family_members']['Insert'];
export type FamilyMemberUpdate = Database['public']['Tables']['family_members']['Update'];

export type FamilyInvite = Database['public']['Tables']['family_invites']['Row'];
export type FamilyInviteInsert = Database['public']['Tables']['family_invites']['Insert'];
export type FamilyInviteUpdate = Database['public']['Tables']['family_invites']['Update'];

// Tipos das views
export type AccountBalance = Database['public']['Views']['account_balances']['Row'];
export type AccountReserved = Database['public']['Views']['account_reserved']['Row'];
export type GoalProgress = Database['public']['Views']['goal_progress']['Row'];
export type FamilyMembersWithProfile = Database['public']['Views']['family_members_with_profile']['Row'];

// Tipos das funções RPC
export type AccountBalanceRPC = Database['public']['Functions']['get_user_account_balances']['Returns'][0];
export type AccountReservedRPC = Database['public']['Functions']['get_user_account_reserved']['Returns'][0];
export type AccountWithBalancesRPC = Database['public']['Functions']['get_user_accounts_with_balances']['Returns'][0];
export type GoalProgressRPC = Database['public']['Functions']['get_user_goal_progress']['Returns'][0];

// Tipo combinado para contas com saldos (usado nos componentes)
export type AccountWithBalances = AccountWithBalancesRPC;

// Tipos estendidos para formulários
export type AccountUpdateExtended = AccountUpdate & {
  saldoAtual?: number;
  ajusteSaldo?: number;
};

// Tipos auxiliares
export type Json = Database['public']['Tables']['accounts']['Row']['created_at'] extends string ? never : Database['public']['Tables']['accounts']['Row']['created_at'];

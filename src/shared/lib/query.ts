import { QueryClient } from '@tanstack/react-query';

export const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: 1 },
  },
});

export const queryKeys = {
  transactions: ['transactions'] as const,
  transaction: (id: string) => ['transactions', id] as const,
  transactionsByUser: (userId: string) => ['transactions', 'user', userId] as const,
  transactionsByFamily: (familyId: string) => ['transactions', 'family', familyId] as const,
  accounts: ['accounts'] as const,
  account: (id: string) => ['accounts', id] as const,
  accountsByUser: (userId: string) => ['accounts', 'user', userId] as const,
  categories: ['categories'] as const,
  category: (id: string) => ['categories', id] as const,
  categoriesByUser: (userId: string) => ['categories', 'user', userId] as const,
  categoriesByFamily: (familyId: string) => ['categories', 'family', familyId] as const,
  goals: ['goals'] as const,
  goal: (id: string) => ['goals', id] as const,
  goalsByUser: (userId: string) => ['goals', 'user', userId] as const,
  goalsByFamily: (familyId: string) => ['goals', 'family', familyId] as const,
  families: ['families'] as const,
  family: (id: string) => ['families', id] as const,
  familiesByUser: (userId: string) => ['families', 'user', userId] as const,
  familyMembers: ['family-members'] as const,
  familyMembersByFamily: (familyId: string) => ['family-members', 'family', familyId] as const,
  familyInvites: ['family-invites'] as const,
  familyInvitesByFamily: (familyId: string) => ['family-invites', 'family', familyId] as const,
  profiles: ['profiles'] as const,
  profile: (id: string) => ['profiles', id] as const,
  profileByUser: (userId: string) => ['profiles', 'user', userId] as const,
  dashboard: ['dashboard'] as const,
  dashboardStats: (userId: string) => ['dashboard', 'stats', userId] as const,
  dashboardRecentTransactions: (userId: string) => ['dashboard', 'recent-transactions', userId] as const,
  dashboardTopCategories: (userId: string) => ['dashboard', 'top-categories', userId] as const,
} as const; 

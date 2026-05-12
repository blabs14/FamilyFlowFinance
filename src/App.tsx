import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingSpinner } from './components/ui/loading-states';
import { Toaster } from './components/ui/toaster';
import { Toaster as SonnerToaster } from './components/ui/sonner';
import { GlobalShortcuts } from './components/GlobalShortcuts';
import { LocaleProvider } from './contexts/LocaleProvider';
import { ScopeProvider } from './features/scope';
import { ThemeProvider } from './components/ThemeProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingGuard } from './components/OnboardingGuard';

// Lazy loading de páginas base
import { Dashboard, ProfilePage } from './components/lazy/index';

// Páginas unificadas /app/*
const AccountsPage     = lazy(() => import('./pages/app/AccountsPage'));
const TransactionsPage = lazy(() => import('./pages/app/TransactionsPage'));
const GoalsPage        = lazy(() => import('./pages/app/GoalsPage'));
const BudgetsPage      = lazy(() => import('./pages/app/BudgetsPage'));
const RecurrentsAppPage = lazy(() => import('./pages/app/RecurrentsPage'));
const InboxPage         = lazy(() => import('./pages/app/InboxPage'));
const MembersPage      = lazy(() => import('./pages/app/MembersPage'));
const SettingsPage       = lazy(() => import('./pages/app/SettingsPage'));
const OnboardingPage     = lazy(() => import('./pages/app/OnboardingPage'));

// Outras páginas
const ImportPage           = lazy(() => import('./features/importer/ImportPage'));
const ReportsPage          = lazy(() => import('./pages/reports'));
const CashflowPage         = lazy(() => import('./pages/cashflow'));
const PayrollPage          = lazy(() => import('./features/payroll/components/PayrollModule'));
const PerformanceDashboard = lazy(() => import('./components/PerformanceDashboard'));

// Páginas de autenticação (não lazy loading para melhor UX)
import Index from './pages/Index';
import Login from './pages/login';
import Register from './pages/register';
import ForgotPassword from './pages/forgot-password';
import NotFound from './pages/NotFound';

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" />
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ScopeProvider>
          <ThemeProvider>
            <LocaleProvider>
            <Router>
              <ErrorBoundary>
                <GlobalShortcuts />
                <Routes>
                  {/* Páginas públicas */}
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/cashflow" element={<Navigate to="/app/cashflow" replace />} />

                  {/* Páginas protegidas sob /app */}
                  <Route path="/app" element={<RequireAuth><MainLayout /></RequireAuth>}>
                    {/* Onboarding route — exempt from guard */}
                    <Route path="onboarding" element={
                      <Suspense fallback={<PageLoading />}><OnboardingPage /></Suspense>
                    } />

                    {/* All other routes — guarded by OnboardingGuard */}
                    <Route element={<OnboardingGuard><Outlet /></OnboardingGuard>}>
                      <Route index element={
                        <Suspense fallback={<PageLoading />}><Dashboard /></Suspense>
                      } />
                      <Route path="contas/*" element={
                        <Suspense fallback={<PageLoading />}><AccountsPage /></Suspense>
                      } />
                      <Route path="transacoes/*" element={
                        <Suspense fallback={<PageLoading />}><TransactionsPage /></Suspense>
                      } />
                      <Route path="objetivos/*" element={
                        <Suspense fallback={<PageLoading />}><GoalsPage /></Suspense>
                      } />
                      <Route path="orcamentos/*" element={
                        <Suspense fallback={<PageLoading />}><BudgetsPage /></Suspense>
                      } />
                      <Route path="recorrentes" element={
                        <Suspense fallback={<PageLoading />}><RecurrentsAppPage /></Suspense>
                      } />
                      <Route path="inbox" element={
                        <Suspense fallback={<PageLoading />}><InboxPage /></Suspense>
                      } />
                      <Route path="payroll/*" element={
                        <Suspense fallback={<PageLoading />}><PayrollPage /></Suspense>
                      } />
                      <Route path="reports" element={
                        <Suspense fallback={<PageLoading />}><ReportsPage /></Suspense>
                      } />
                      <Route path="cashflow" element={
                        <Suspense fallback={<PageLoading />}><CashflowPage /></Suspense>
                      } />
                      <Route path="membros/*" element={
                        <Suspense fallback={<PageLoading />}><MembersPage /></Suspense>
                      } />
                      <Route path="convites" element={
                        <Suspense fallback={<PageLoading />}><MembersPage /></Suspense>
                      } />
                      <Route path="definicoes-familia" element={<Navigate to="/app/settings" replace />} />
                      <Route path="import" element={
                        <Suspense fallback={<PageLoading />}><ImportPage /></Suspense>
                      } />
                      <Route path="performance" element={
                        <Suspense fallback={<PageLoading />}><PerformanceDashboard /></Suspense>
                      } />
                      <Route path="profile" element={
                        <Suspense fallback={<PageLoading />}><ProfilePage /></Suspense>
                      } />
                      <Route path="settings" element={
                        <Suspense fallback={<PageLoading />}><SettingsPage /></Suspense>
                      } />
                    </Route>
                  </Route>

                  {/* Redirects legacy /personal/* → /app/* */}
                  <Route path="/personal" element={<Navigate to="/app" replace />} />
                  <Route path="/personal/accounts" element={<Navigate to="/app/contas" replace />} />
                  <Route path="/personal/transactions" element={<Navigate to="/app/transacoes" replace />} />
                  <Route path="/personal/goals" element={<Navigate to="/app/objetivos" replace />} />
                  <Route path="/personal/budgets" element={<Navigate to="/app/orcamentos" replace />} />
                  <Route path="/personal/recorrentes" element={<Navigate to="/app/recorrentes" replace />} />
                  <Route path="/personal/payroll" element={<Navigate to="/app/payroll" replace />} />
                  <Route path="/personal/payroll/*" element={<Navigate to="/app/payroll" replace />} />
                  <Route path="/personal/importar" element={<Navigate to="/app/import" replace />} />
                  {/* /personal/insights removed — dead route (Unit 10) */}
                  <Route path="/personal/reminders" element={<Navigate to="/app" replace />} />
                  <Route path="/personal/settings" element={<Navigate to="/app/settings" replace />} />
                  <Route path="/personal/*" element={<Navigate to="/app" replace />} />

                  {/* Redirects legacy /family/* → /app/* */}
                  <Route path="/family" element={<Navigate to="/app" replace />} />
                  <Route path="/family/dashboard" element={<Navigate to="/app" replace />} />
                  <Route path="/family/accounts" element={<Navigate to="/app/contas" replace />} />
                  <Route path="/family/transactions" element={<Navigate to="/app/transacoes" replace />} />
                  <Route path="/family/goals" element={<Navigate to="/app/objetivos" replace />} />
                  <Route path="/family/budgets" element={<Navigate to="/app/orcamentos" replace />} />
                  <Route path="/family/recorrentes" element={<Navigate to="/app/recorrentes" replace />} />
                  <Route path="/family/importar" element={<Navigate to="/app/import" replace />} />
                  <Route path="/family/members" element={<Navigate to="/app/membros" replace />} />
                  <Route path="/family/settings" element={<Navigate to="/app/settings" replace />} />
                  <Route path="/family/*" element={<Navigate to="/app" replace />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </Router>
            </LocaleProvider>
          </ThemeProvider>
        </ScopeProvider>
      </AuthProvider>
      <Toaster />
      <SonnerToaster />
    </QueryClientProvider>
  );
}

export default App;

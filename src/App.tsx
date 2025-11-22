import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';
import { MainLayout } from './components/layout/MainLayout';
import { LoadingSpinner } from './components/ui/loading-states';
import { Toaster } from './components/ui/toaster';
import { Toaster as SonnerToaster } from './components/ui/sonner';
import { GlobalShortcuts } from './components/GlobalShortcuts';
import { LocaleProvider } from './contexts/LocaleProvider';
import { Navigate } from 'react-router-dom';
import './test-supabase';
import { performanceService } from './services/performanceService';
import { ErrorBoundary } from './components/ErrorBoundary';
// Testes removidos - componente RealTimeNotifications melhorado


// Lazy loading de páginas
import {
  Dashboard,
  ProfilePage,
} from './components/lazy/index';

// Páginas principais (lazy loading)
const PersonalPage = lazy(() => import('./pages/Personal'));
const FamilyPage = lazy(() => import('./pages/Family'));

// Página de Relatórios (lazy)
const ReportsPage = lazy(() => import('./pages/reports'));

// Página de Fluxo de Caixa (lazy)
const CashflowPage = lazy(() => import('./pages/cashflow'));

// Página de Payroll (lazy)
const PayrollPage = lazy(() => import('./features/payroll/components/PayrollModule'));

// Dashboard de Performance (lazy)
const PerformanceDashboard = lazy(() => import('./components/PerformanceDashboard'));



// Páginas de autenticação (não lazy loading para melhor UX)
import Index from './pages/Index';
import Login from './pages/login';
import Register from './pages/register';
import ForgotPassword from './pages/forgot-password';
import NotFound from './pages/NotFound';
import TestPage from './pages/TestPage';

// Componente de loading para Suspense
const PageLoading = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" />
  </div>
);

function App() {
  // Inicializar serviço de performance
  React.useEffect(() => {
    // O serviço é inicializado automaticamente no constructor
    // Performance monitoring initialized silently
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocaleProvider>
          <Router>
            <ErrorBoundary>
              <GlobalShortcuts />
            <Routes>
              {/* Páginas públicas */}
              <Route path="/" element={<Index />} />
              <Route path="/test" element={<TestPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              {/* Redirecionamento legacy/alias */}
              <Route path="/cashflow" element={<Navigate to="/app/cashflow" replace />} />
              
              {/* Páginas protegidas com lazy loading */}
              <Route path="/app" element={<RequireAuth><MainLayout /></RequireAuth>}>
                <Route index element={
                  <Suspense fallback={<PageLoading />}>
                    <Dashboard />
                  </Suspense>
                } />
                <Route path="reports" element={
                  <Suspense fallback={<PageLoading />}>
                    <ReportsPage />
                  </Suspense>
                } />
                <Route path="cashflow" element={
                  <Suspense fallback={<PageLoading />}>
                    <CashflowPage />
                  </Suspense>
                } />
                <Route path="payroll/*" element={
                  <Suspense fallback={<PageLoading />}>
                    <PayrollPage />
                  </Suspense>
                } />
                <Route path="performance" element={
                  <Suspense fallback={<PageLoading />}>
                    <PerformanceDashboard />
                  </Suspense>
                } />

                <Route path="profile" element={
                  <Suspense fallback={<PageLoading />}>
                    <ProfilePage />
                  </Suspense>
                } />
              </Route>
              
              {/* Área Pessoal */}
              <Route path="/personal/*" element={
                <RequireAuth>
                  <Suspense fallback={<PageLoading />}>
                    <PersonalPage />
                  </Suspense>
                </RequireAuth>
              } />
              
              {/* Finanças Partilhadas */}
              <Route path="/family/*" element={
                <RequireAuth>
                  <Suspense fallback={<PageLoading />}>
                    <FamilyPage />
                  </Suspense>
                </RequireAuth>
              } />
              
              {/* Página 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </ErrorBoundary>
            </Router>
        </LocaleProvider>
      </AuthProvider>
      <Toaster />
      <SonnerToaster />
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}

export default App;

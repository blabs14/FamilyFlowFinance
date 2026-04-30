import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalBudgets = React.lazy(() => import('../../features/personal/PersonalBudgets'));
const FamilyBudgets = React.lazy(() => import('../../features/family/FamilyBudgets'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function BudgetsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyBudgets />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalBudgets />
      </Suspense>
    </PersonalProvider>
  );
}

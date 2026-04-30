import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalTransactions = React.lazy(() => import('../../features/personal/PersonalTransactions'));
const FamilyTransactions = React.lazy(() => import('../../features/family/FamilyTransactions'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function TransactionsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyTransactions />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalTransactions />
      </Suspense>
    </PersonalProvider>
  );
}

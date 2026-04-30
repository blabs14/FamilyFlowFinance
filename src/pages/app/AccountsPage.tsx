import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalAccounts = React.lazy(() => import('../../features/personal/PersonalAccounts'));
const FamilyAccounts = React.lazy(() => import('../../features/family/FamilyAccounts'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function AccountsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyAccounts />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalAccounts />
      </Suspense>
    </PersonalProvider>
  );
}

import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalGoals = React.lazy(() => import('../../features/personal/PersonalGoals'));
const FamilyGoals = React.lazy(() => import('../../features/family/FamilyGoals'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function GoalsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyGoals />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalGoals />
      </Suspense>
    </PersonalProvider>
  );
}

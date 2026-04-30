import React, { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const FamilyMembers = React.lazy(() => import('../../features/family/FamilyMembers'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function MembersPage() {
  const { scope } = useScope();

  if (scope.kind !== 'family') {
    return <Navigate to="/app" replace />;
  }

  return (
    <FamilyProvider>
      <Suspense fallback={<PageLoading />}>
        <FamilyMembers />
      </Suspense>
    </FamilyProvider>
  );
}

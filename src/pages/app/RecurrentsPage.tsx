import React, { Suspense } from 'react';
import { LoadingSpinner } from '../../components/ui/loading-states';

const RecurrentsContent = React.lazy(() => import('../recurrents'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function RecurrentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RecurrentsContent />
    </Suspense>
  );
}

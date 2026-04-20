import { Home, Users } from 'lucide-react';

import { Badge } from '../../components/ui/badge';
import { useMyFamilies } from './useMyFamilies';
import { useScope } from './useScope';

export const ScopeBadge = () => {
  const { scope } = useScope();
  const myFamilies = useMyFamilies();

  if (scope.kind === 'personal') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Home className="h-3 w-3" />
        Pessoal
      </Badge>
    );
  }

  const familyName =
    myFamilies.data?.find((family) => family.id === scope.familyId)?.nome ?? '...';

  return (
    <Badge variant="default" className="gap-1">
      <Users className="h-3 w-3" />
      Família: {familyName}
    </Badge>
  );
};

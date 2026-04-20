import { ChevronDown, Home, Users } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useMyFamilies } from './useMyFamilies';
import { useScope } from './useScope';

export const ScopeToggle = () => {
  const { user } = useAuth();
  const { scope, setScope } = useScope();
  const myFamilies = useMyFamilies();

  if (!user) {
    return null;
  }

  const currentLabel =
    scope.kind === 'personal'
      ? 'Pessoal'
      : `Família: ${
          myFamilies.data?.find((family) => family.id === scope.familyId)?.nome ?? '...'
        }`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-cy="scope-toggle">
          {scope.kind === 'personal' ? (
            <Home className="h-4 w-4" />
          ) : (
            <Users className="h-4 w-4" />
          )}
          <span>{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem onSelect={() => setScope({ kind: 'personal' })}>
          <Home className="mr-2 h-4 w-4" />
          Pessoal
        </DropdownMenuItem>

        {(myFamilies.data ?? []).map((family) => (
          <DropdownMenuItem
            key={family.id}
            onSelect={() =>
              setScope({ kind: 'family', familyId: family.id })
            }
          >
            <Users className="mr-2 h-4 w-4" />
            {family.nome}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../../contexts/AuthContext';
import { loadScope, saveScope } from './storage';
import { toFilter, type ScopedFilter, type StoredScope } from './types';
import { useMyFamilies } from './useMyFamilies';

type ScopeContextValue = {
  scope: StoredScope;
  setScope: (next: StoredScope) => void;
  scopedFilter: ScopedFilter | null;
};

const ScopeContext = createContext<ScopeContextValue | null>(null);
ScopeContext.displayName = 'ScopeContext';

export const ScopeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const myFamilies = useMyFamilies();
  const [scope, setScopeState] = useState<StoredScope>({ kind: 'personal' });

  useEffect(() => {
    if (!user?.id) {
      setScopeState({ kind: 'personal' });
      return;
    }

    const stored = loadScope(user.id);

    if (!stored) {
      setScopeState({ kind: 'personal' });
      return;
    }

    if (stored.kind === 'family' && myFamilies.isSuccess) {
      const familyIds = (myFamilies.data ?? []).map((family) => family.id);

      if (!familyIds.includes(stored.familyId)) {
        setScopeState({ kind: 'personal' });
        return;
      }
    }

    setScopeState(stored);
  }, [myFamilies.data, myFamilies.isSuccess, user?.id]);

  const setScope = useCallback(
    (next: StoredScope) => {
      setScopeState(next);

      if (user?.id) {
        saveScope(user.id, next);
      }
    },
    [user?.id],
  );

  const value = useMemo<ScopeContextValue>(
    () => ({
      scope,
      setScope,
      scopedFilter: user?.id ? toFilter(scope, user.id) : null,
    }),
    [scope, setScope, user?.id],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
};

export const useScopeContext = () => {
  const context = useContext(ScopeContext);

  if (!context) {
    throw new Error('useScope must be used inside <ScopeProvider>');
  }

  return context;
};

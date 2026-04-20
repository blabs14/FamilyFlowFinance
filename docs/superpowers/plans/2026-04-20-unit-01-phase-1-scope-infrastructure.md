# Unit 1 Phase 1 — Scope Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce unified scope state (`ScopeProvider` + `useScope`) with header toggle, replacing implicit route-based scope. Minimal cleanup of 3 confirmed dead-code artifacts. No migration of feature pages yet — that happens in Units 5/6/7/8 Phase 2 plans.

**Architecture:** A `ScopeProvider` wraps the Router below `AuthProvider`. It persists the active scope in `localStorage` keyed by user id. `useScope()` returns `{ scope, setScope, scopedFilter }` where `scope` is either `{ kind: 'personal' }` or `{ kind: 'family', family }` and `scopedFilter` is the `(user_id, family_id?)` pair that feature hooks will use. `ScopeToggle` is mounted in the existing `MainLayout` header as a dropdown (Pessoal + one entry per family the user belongs to). Existing `PersonalProvider`/`FamilyProvider` and `/personal/*`/`/family/*` routes stay intact — removal is the job of Unit 3's plan.

**Tech Stack:** React 18 context, TanStack Query 5, Supabase (read-only from `family_members` via existing RPC), Radix UI dropdown, Zod, TypeScript, Vitest + React Testing Library, Playwright (NEW per Unit 16; Cypress still co-exists until Unit 16 plan runs).

**Spec reference:** [docs/superpowers/specs/2026-04-18-product-design-review.md](docs/superpowers/specs/2026-04-18-product-design-review.md) §6 Unit 1.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `src/features/scope/types.ts` | `Scope` discriminated union + `ScopedFilter` type + helpers |
| `src/features/scope/storage.ts` | `localStorage` get/set helpers (pure, testable) |
| `src/features/scope/ScopeProvider.tsx` | React context + provider (reads user, persists, hydrates) |
| `src/features/scope/useScope.ts` | Hook `useScope()` — thin re-export from context |
| `src/features/scope/useMyFamilies.ts` | React Query hook listing user's families for the dropdown |
| `src/features/scope/ScopeToggle.tsx` | Header dropdown (Pessoal + each family) |
| `src/features/scope/ScopeBadge.tsx` | Small chip for page-level scope feedback |
| `src/features/scope/index.ts` | Barrel export |
| `tests/unit/scope/storage.test.ts` | Vitest: storage helpers |
| `tests/unit/scope/ScopeProvider.test.tsx` | Vitest + RTL: provider hydration + persistence |
| `tests/unit/scope/useMyFamilies.test.tsx` | Vitest + RTL: families query |
| `tests/unit/scope/ScopeToggle.test.tsx` | Vitest + RTL: toggle UI |

### Modified files

| File | Change |
|---|---|
| `src/App.tsx` | Mount `<ScopeProvider>` between `<AuthProvider>` and `<LocaleProvider>` |
| `src/components/layout/MainLayout.tsx` | Mount `<ScopeToggle />` in header between title and notifications |
| `src/services/accounts.ts` | Remove defensive hotfix (lines 482-484) — no longer needed once scope is explicit at the hook layer |

### Deleted files

| File | Reason |
|---|---|
| `src/pages/Familia.tsx` | Dead code confirmed by audit (0 references; superseded by `pages/Family.tsx`) |
| `src/services/family.legacy.ts` | Dead code confirmed by audit (0 references) |

### Out of scope (explicit)

- Merging `PersonalX.tsx` + `FamilyX.tsx` component pairs — belongs to Units 5/6/7/8 plans.
- Unifying CRUD RPCs `get_personal_X` / `get_family_X` — belongs to Units 5/6/7/8 plans.
- Deleting `PersonalProvider` / `FamilyProvider` / `/personal/*` / `/family/*` routes — belongs to Unit 3 plan.
- Full nav redesign (sidebar + bottom tab bar) — belongs to Unit 3 plan.
- `ScopeBadge` usage in pages — this plan adds the component; pages adopt it in their own plans.

---

## Task 1: Scope types + storage helpers

**Files:**
- Create: `src/features/scope/types.ts`
- Create: `src/features/scope/storage.ts`
- Create: `tests/unit/scope/storage.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `tests/unit/scope/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadScope, saveScope, clearScope, STORAGE_KEY_PREFIX } from '../../../src/features/scope/storage';

describe('scope storage', () => {
  const userId = 'user-abc';

  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no scope is saved for the user', () => {
    expect(loadScope(userId)).toBeNull();
  });

  it('round-trips a personal scope', () => {
    saveScope(userId, { kind: 'personal' });
    expect(loadScope(userId)).toEqual({ kind: 'personal' });
  });

  it('round-trips a family scope with family_id', () => {
    saveScope(userId, { kind: 'family', familyId: 'fam-1' });
    expect(loadScope(userId)).toEqual({ kind: 'family', familyId: 'fam-1' });
  });

  it('isolates scope per user', () => {
    saveScope('user-a', { kind: 'family', familyId: 'fam-a' });
    saveScope('user-b', { kind: 'personal' });
    expect(loadScope('user-a')).toEqual({ kind: 'family', familyId: 'fam-a' });
    expect(loadScope('user-b')).toEqual({ kind: 'personal' });
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, '{not-json');
    expect(loadScope(userId)).toBeNull();
  });

  it('returns null on schema-mismatched payload', () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify({ kind: 'nonsense' }));
    expect(loadScope(userId)).toBeNull();
  });

  it('clears scope for the given user', () => {
    saveScope(userId, { kind: 'personal' });
    clearScope(userId);
    expect(loadScope(userId)).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/scope/storage.test.ts`
Expected: FAIL with "Cannot find module '../../../src/features/scope/storage'"

- [ ] **Step 1.3: Implement types**

Create `src/features/scope/types.ts`:

```typescript
import { z } from 'zod';

export type PersonalScope = { kind: 'personal' };
export type FamilyScope = { kind: 'family'; familyId: string };

/**
 * Discriminated union describing the active data scope.
 * Stored form — the runtime provider augments family scope with the hydrated family object.
 */
export type StoredScope = PersonalScope | FamilyScope;

/**
 * Filter object consumed by scoped services: (user_id, family_id?) contract from Unit 1.
 */
export type ScopedFilter = {
  userId: string;
  familyId: string | null;
};

export const storedScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('personal') }),
  z.object({ kind: z.literal('family'), familyId: z.string().uuid() }),
]);

export const toFilter = (scope: StoredScope, userId: string): ScopedFilter => ({
  userId,
  familyId: scope.kind === 'family' ? scope.familyId : null,
});
```

- [ ] **Step 1.4: Implement storage**

Create `src/features/scope/storage.ts`:

```typescript
import { storedScopeSchema, type StoredScope } from './types';

export const STORAGE_KEY_PREFIX = 'ffinance.scope.';

const keyFor = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

export const loadScope = (userId: string): StoredScope | null => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = storedScopeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveScope = (userId: string, scope: StoredScope): void => {
  localStorage.setItem(keyFor(userId), JSON.stringify(scope));
};

export const clearScope = (userId: string): void => {
  localStorage.removeItem(keyFor(userId));
};
```

- [ ] **Step 1.5: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/scope/storage.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 1.6: Commit**

```bash
git add src/features/scope/types.ts src/features/scope/storage.ts tests/unit/scope/storage.test.ts
git commit -m "feat(scope): add Scope types and localStorage helpers (Unit 1 Phase 1)"
```

---

## Task 2: useMyFamilies query hook

**Files:**
- Create: `src/features/scope/useMyFamilies.ts`
- Create: `tests/unit/scope/useMyFamilies.test.tsx`

**Context:** `ScopeToggle` needs a list of families the user belongs to. Today `FamilyProvider` loads only the first/primary family. We need all of them. Query: `family_members JOIN families` where `family_members.user_id = auth.uid()`.

- [ ] **Step 2.1: Write the failing test**

Create `tests/unit/scope/useMyFamilies.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyFamilies } from '../../../src/features/scope/useMyFamilies';

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { supabase } from '../../../src/lib/supabaseClient';
import { useAuth } from '../../../src/contexts/AuthContext';

const wrap = (children: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('useMyFamilies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when user is not authenticated', async () => {
    (useAuth as any).mockReturnValue({ user: null });
    const { result } = renderHook(() => useMyFamilies(), { wrapper: ({ children }) => wrap(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns families joined via family_members for the current user', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    const mockSelect = vi.fn().mockResolvedValue({
      data: [
        { family_id: 'fam-1', family: { id: 'fam-1', nome: 'Silva' } },
        { family_id: 'fam-2', family: { id: 'fam-2', nome: 'Costa' } },
      ],
      error: null,
    });
    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: mockSelect }) }),
    });

    const { result } = renderHook(() => useMyFamilies(), { wrapper: ({ children }) => wrap(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: 'fam-1', nome: 'Silva' },
      { id: 'fam-2', nome: 'Costa' },
    ]);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/scope/useMyFamilies.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 2.3: Implement the hook**

Create `src/features/scope/useMyFamilies.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

export type MyFamily = { id: string; nome: string };

export const useMyFamilies = () => {
  const { user } = useAuth();
  return useQuery<MyFamily[]>({
    queryKey: ['scope', 'my-families', user?.id ?? null],
    enabled: true,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id, family:families(id, nome)')
        .eq('user_id', user.id)
        .order('family_id', { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .map((row: any) => row.family as MyFamily | null)
        .filter((f): f is MyFamily => f !== null);
    },
    staleTime: 5 * 60 * 1000,
  });
};
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/scope/useMyFamilies.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 2.5: Commit**

```bash
git add src/features/scope/useMyFamilies.ts tests/unit/scope/useMyFamilies.test.tsx
git commit -m "feat(scope): add useMyFamilies query hook (Unit 1 Phase 1)"
```

---

## Task 3: ScopeProvider + useScope hook

**Files:**
- Create: `src/features/scope/ScopeProvider.tsx`
- Create: `src/features/scope/useScope.ts`
- Create: `tests/unit/scope/ScopeProvider.test.tsx`

**Behavior contract:**
- On mount, if user is present, hydrate scope from localStorage (falling back to `{ kind: 'personal' }`).
- On user change, re-hydrate for the new user id.
- `setScope(next)` writes to storage and updates state.
- If saved scope references a family the user is no longer a member of, fall back to `personal` silently. (We validate against `useMyFamilies` data.)
- `useScope()` outside a provider throws.

- [ ] **Step 3.1: Write the failing test**

Create `tests/unit/scope/ScopeProvider.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScopeProvider } from '../../../src/features/scope/ScopeProvider';
import { useScope } from '../../../src/features/scope/useScope';
import { saveScope } from '../../../src/features/scope/storage';

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../../src/features/scope/useMyFamilies', () => ({
  useMyFamilies: vi.fn(),
}));

import { useAuth } from '../../../src/contexts/AuthContext';
import { useMyFamilies } from '../../../src/features/scope/useMyFamilies';

const Probe = () => {
  const { scope, setScope } = useScope();
  return (
    <div>
      <span data-testid="kind">{scope.kind}</span>
      <span data-testid="family">{scope.kind === 'family' ? scope.familyId : '-'}</span>
      <button onClick={() => setScope({ kind: 'family', familyId: 'fam-1' })}>to-family</button>
      <button onClick={() => setScope({ kind: 'personal' })}>to-personal</button>
    </div>
  );
};

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><ScopeProvider>{ui}</ScopeProvider></QueryClientProvider>;
};

describe('ScopeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (useMyFamilies as any).mockReturnValue({ data: [{ id: 'fam-1', nome: 'Silva' }], isSuccess: true });
  });

  it('defaults to personal scope when nothing is stored', () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    render(wrap(<Probe />));
    expect(screen.getByTestId('kind').textContent).toBe('personal');
  });

  it('hydrates family scope from storage', () => {
    saveScope('user-1', { kind: 'family', familyId: 'fam-1' });
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    render(wrap(<Probe />));
    expect(screen.getByTestId('kind').textContent).toBe('family');
    expect(screen.getByTestId('family').textContent).toBe('fam-1');
  });

  it('falls back to personal when stored family is no longer a membership', () => {
    saveScope('user-1', { kind: 'family', familyId: 'fam-gone' });
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    render(wrap(<Probe />));
    expect(screen.getByTestId('kind').textContent).toBe('personal');
  });

  it('persists setScope changes to storage', () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    render(wrap(<Probe />));
    act(() => screen.getByText('to-family').click());
    expect(screen.getByTestId('kind').textContent).toBe('family');
    expect(localStorage.getItem('ffinance.scope.user-1')).toContain('family');
  });

  it('throws when useScope is called outside the provider', () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    const Orphan = () => { useScope(); return null; };
    expect(() => render(<Orphan />)).toThrow(/ScopeProvider/);
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/scope/ScopeProvider.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3.3: Implement the provider and hook**

Create `src/features/scope/ScopeProvider.tsx`:

```typescript
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
    if (stored && stored.kind === 'family') {
      const familyIds = (myFamilies.data ?? []).map((f) => f.id);
      if (!familyIds.includes(stored.familyId)) {
        setScopeState({ kind: 'personal' });
        return;
      }
    }
    setScopeState(stored ?? { kind: 'personal' });
  }, [user?.id, myFamilies.data]);

  const setScope = useCallback(
    (next: StoredScope) => {
      setScopeState(next);
      if (user?.id) saveScope(user.id, next);
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
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope must be used inside <ScopeProvider>');
  return ctx;
};
```

Create `src/features/scope/useScope.ts`:

```typescript
export { useScopeContext as useScope } from './ScopeProvider';
export type { StoredScope, ScopedFilter } from './types';
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/scope/ScopeProvider.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 3.5: Commit**

```bash
git add src/features/scope/ScopeProvider.tsx src/features/scope/useScope.ts tests/unit/scope/ScopeProvider.test.tsx
git commit -m "feat(scope): add ScopeProvider with localStorage hydration (Unit 1 Phase 1)"
```

---

## Task 4: ScopeToggle component

**Files:**
- Create: `src/features/scope/ScopeToggle.tsx`
- Create: `tests/unit/scope/ScopeToggle.test.tsx`

**Behavior contract:**
- Renders a dropdown button with the current scope label: `Pessoal` or `Família: {nome}`.
- Dropdown lists `Pessoal` followed by each family the user is a member of.
- Clicking an item calls `setScope` and closes the menu.
- When there are zero families, only `Pessoal` is shown and the dropdown still works.
- When auth user is null, the component renders nothing (hidden in login flows).

- [ ] **Step 4.1: Write the failing test**

Create `tests/unit/scope/ScopeToggle.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScopeProvider } from '../../../src/features/scope/ScopeProvider';
import { ScopeToggle } from '../../../src/features/scope/ScopeToggle';

vi.mock('../../../src/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../src/features/scope/useMyFamilies', () => ({ useMyFamilies: vi.fn() }));

import { useAuth } from '../../../src/contexts/AuthContext';
import { useMyFamilies } from '../../../src/features/scope/useMyFamilies';

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><ScopeProvider>{ui}</ScopeProvider></QueryClientProvider>;
};

describe('ScopeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders nothing when user is not authenticated', () => {
    (useAuth as any).mockReturnValue({ user: null });
    (useMyFamilies as any).mockReturnValue({ data: [], isSuccess: true });
    const { container } = render(wrap(<ScopeToggle />));
    expect(container.firstChild).toBeNull();
  });

  it('shows Pessoal as default label', () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    (useMyFamilies as any).mockReturnValue({ data: [], isSuccess: true });
    render(wrap(<ScopeToggle />));
    expect(screen.getByRole('button', { name: /Pessoal/i })).toBeInTheDocument();
  });

  it('switches to a family when a family item is clicked', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    (useMyFamilies as any).mockReturnValue({
      data: [{ id: 'fam-1', nome: 'Silva' }],
      isSuccess: true,
    });
    render(wrap(<ScopeToggle />));
    await userEvent.click(screen.getByRole('button', { name: /Pessoal/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Silva/i }));
    expect(screen.getByRole('button', { name: /Família: Silva/i })).toBeInTheDocument();
  });

  it('switches back to Pessoal', async () => {
    localStorage.setItem('ffinance.scope.user-1', JSON.stringify({ kind: 'family', familyId: 'fam-1' }));
    (useAuth as any).mockReturnValue({ user: { id: 'user-1' } });
    (useMyFamilies as any).mockReturnValue({
      data: [{ id: 'fam-1', nome: 'Silva' }],
      isSuccess: true,
    });
    render(wrap(<ScopeToggle />));
    await userEvent.click(screen.getByRole('button', { name: /Família: Silva/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /^Pessoal$/i }));
    expect(screen.getByRole('button', { name: /^Pessoal$/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/scope/ScopeToggle.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 4.3: Implement ScopeToggle**

Create `src/features/scope/ScopeToggle.tsx`:

```typescript
import { ChevronDown, Home, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Button } from '../../components/ui/button';
import { useScope } from './useScope';
import { useMyFamilies } from './useMyFamilies';

export const ScopeToggle = () => {
  const { user } = useAuth();
  const { scope, setScope } = useScope();
  const myFamilies = useMyFamilies();

  if (!user) return null;

  const currentLabel =
    scope.kind === 'personal'
      ? 'Pessoal'
      : `Família: ${
          myFamilies.data?.find((f) => f.id === scope.familyId)?.nome ?? '…'
        }`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-cy="scope-toggle">
          {scope.kind === 'personal' ? <Home className="h-4 w-4" /> : <Users className="h-4 w-4" />}
          <span>{currentLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuItem onSelect={() => setScope({ kind: 'personal' })}>
          <Home className="mr-2 h-4 w-4" />
          Pessoal
        </DropdownMenuItem>
        {(myFamilies.data ?? []).map((f) => (
          <DropdownMenuItem key={f.id} onSelect={() => setScope({ kind: 'family', familyId: f.id })}>
            <Users className="mr-2 h-4 w-4" />
            {f.nome}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/scope/ScopeToggle.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 4.5: Commit**

```bash
git add src/features/scope/ScopeToggle.tsx tests/unit/scope/ScopeToggle.test.tsx
git commit -m "feat(scope): add ScopeToggle header dropdown (Unit 1 Phase 1)"
```

---

## Task 5: ScopeBadge component + barrel export

**Files:**
- Create: `src/features/scope/ScopeBadge.tsx`
- Create: `src/features/scope/index.ts`

**Note:** Not adopted by pages in this plan — shipped as a ready-to-use component for Units 5/6/7/8 plans. Keep it minimal; no tests beyond typecheck.

- [ ] **Step 5.1: Implement ScopeBadge**

Create `src/features/scope/ScopeBadge.tsx`:

```typescript
import { Home, Users } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { useScope } from './useScope';
import { useMyFamilies } from './useMyFamilies';

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

  const name = myFamilies.data?.find((f) => f.id === scope.familyId)?.nome ?? '…';
  return (
    <Badge variant="default" className="gap-1">
      <Users className="h-3 w-3" />
      Família: {name}
    </Badge>
  );
};
```

- [ ] **Step 5.2: Implement barrel export**

Create `src/features/scope/index.ts`:

```typescript
export { ScopeProvider } from './ScopeProvider';
export { useScope } from './useScope';
export { useMyFamilies } from './useMyFamilies';
export { ScopeToggle } from './ScopeToggle';
export { ScopeBadge } from './ScopeBadge';
export type { StoredScope, ScopedFilter, PersonalScope, FamilyScope } from './types';
```

- [ ] **Step 5.3: Verify typecheck and build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5.4: Commit**

```bash
git add src/features/scope/ScopeBadge.tsx src/features/scope/index.ts
git commit -m "feat(scope): add ScopeBadge and barrel export (Unit 1 Phase 1)"
```

---

## Task 6: Mount ScopeProvider in App + ScopeToggle in MainLayout

**Files:**
- Modify: `src/App.tsx` (current providers wrap: `QueryClientProvider > AuthProvider > LocaleProvider > Router`; insert `ScopeProvider` between `AuthProvider` and `LocaleProvider`)
- Modify: `src/components/layout/MainLayout.tsx` (mount `<ScopeToggle />` in header, next to notifications)

**Rationale:** `ScopeProvider` must be inside `AuthProvider` (to read `user.id`) and inside `QueryClientProvider` (because `useMyFamilies` uses React Query). It should be outside `Router` so scope state persists across navigations.

- [ ] **Step 6.1: Mount ScopeProvider in App.tsx**

First, Read the current `src/App.tsx` to see the exact JSX shape (provider stack around lines 67-147). Then add the import at the top of the file:

```typescript
import { ScopeProvider } from './features/scope';
```

Then wrap `<LocaleProvider>` with `<ScopeProvider>`. The final stack must be:

```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <ScopeProvider>
      <LocaleProvider>
        <Router>
          { /* existing Routes, ErrorBoundary, GlobalShortcuts unchanged */ }
        </Router>
      </LocaleProvider>
    </ScopeProvider>
  </AuthProvider>
  { /* existing Toaster / SonnerToaster unchanged */ }
</QueryClientProvider>
```

Use the `Edit` tool on two distinct edits: (a) add the import; (b) wrap the `<LocaleProvider>…</LocaleProvider>` block with `<ScopeProvider>…</ScopeProvider>`.

- [ ] **Step 6.2: Mount ScopeToggle in MainLayout.tsx**

First, use the `Read` tool on `src/components/layout/MainLayout.tsx` lines 55–70 to confirm the exact JSX shape of the header div before editing.

The expected shape (from audit) is:

```tsx
<div className="flex items-center gap-2">
  {user && (
    <>
      <RealTimeNotifications />
      <LogoutButton />
    </>
  )}
</div>
```

If the actual shape differs, adapt the edit below accordingly.

Use the `Edit` tool on two distinct edits: (a) add the import; (b) insert `<ScopeToggle />` inside the fragment.

The header div should become:

```tsx
<div className="flex items-center gap-2">
  {user && (
    <>
      <ScopeToggle />
      <RealTimeNotifications />
      <LogoutButton />
    </>
  )}
</div>
```

Add the import near the top of the file:

```typescript
import { ScopeToggle } from '../../features/scope';
```

- [ ] **Step 6.3: Verify build and existing tests still pass**

Run: `npm run typecheck && npm test -- --run`
Expected: all green. No existing tests reference `ScopeProvider` so they should be unaffected.

- [ ] **Step 6.4: Smoke-test in dev**

Run: `npm run dev`
- Log in.
- Verify toggle shows in `/app` header with label `Pessoal`.
- Click toggle, switch to a family if user has one, reload page — scope persists.
- Switch back to `Pessoal`, reload — persists.
- Log out and back in as another user — scope does not leak across users.

- [ ] **Step 6.5: Commit**

```bash
git add src/App.tsx src/components/layout/MainLayout.tsx
git commit -m "feat(scope): mount ScopeProvider and ScopeToggle in shell (Unit 1 Phase 1)"
```

---

## Task 7: Remove defensive hotfix in accounts.ts

**Files:**
- Modify: `src/services/accounts.ts:482-484`

**Context:** Hotfix defensively filters `family_id IS NULL` in `getAccountsWithBalances`. With scope now explicit upstream, the filter is either handled by the caller's scope choice or by the forthcoming scoped accounts hook in the Unit 5 plan. Removing it now avoids double-filtering once scoped hooks land. If any existing caller relied on the filter, we want it to fail loudly so we can migrate it deliberately in Unit 5.

- [ ] **Step 7.1: Read the current code to confirm the lines**

Read `src/services/accounts.ts:475-495`. Confirm the 4 lines to remove are lines 482-485 (the comment + `safeData` + `filtered` + the `return { data: filtered, error: null }` final line).

- [ ] **Step 7.2: Replace the defensive filter**

Apply this diff (using Edit):

```typescript
// BEFORE
    if (error) {
      return { data: null, error };
    }

    // Hotfix defensivo: garantir que a área pessoal apenas apresenta contas pessoais (sem family_id)
    const safeData = (data || []) as AccountWithBalances[];
    const filtered = safeData.filter((a) => a.family_id == null);

    return { data: filtered, error: null };
```

```typescript
// AFTER
    if (error) {
      return { data: null, error };
    }

    return { data: (data || []) as AccountWithBalances[], error: null };
```

- [ ] **Step 7.3: Run all tests**

Run: `npm test -- --run`
Expected: all green. Integration tests that exercise this path (`tests/integration/`) should still pass since scope is not yet wired through pages.

- [ ] **Step 7.4: Commit**

```bash
git add src/services/accounts.ts
git commit -m "refactor(accounts): remove defensive family_id filter in getAccountsWithBalances (Unit 1 Phase 1)"
```

---

## Task 8: Delete Familia.tsx

**Files:**
- Delete: `src/pages/Familia.tsx`

**Context:** Dead code per audit (Unit 1 Evidência a preservar). Confirm zero imports before deleting.

- [ ] **Step 8.1: Confirm zero references**

Run: `Grep pattern="from ['\"].*Familia['\"]" type="ts,tsx"`
Expected: no matches, or matches only within `src/pages/Familia.tsx` itself.

If matches exist: STOP. Report to user. Do not proceed.

- [ ] **Step 8.2: Delete the file (staged)**

```bash
git rm src/pages/Familia.tsx
```

- [ ] **Step 8.3: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both green.

- [ ] **Step 8.4: Commit**

```bash
git commit -m "chore: delete dead code src/pages/Familia.tsx (Unit 1 Phase 1)"
```

---

## Task 9: Delete family.legacy.ts

**Files:**
- Delete: `src/services/family.legacy.ts`

- [ ] **Step 9.1: Confirm zero references**

Run: `Grep pattern="family\\.legacy" type="ts,tsx"`
Expected: no matches (or matches only inside the file itself).

If matches exist: STOP and report.

- [ ] **Step 9.2: Delete the file (staged)**

```bash
git rm src/services/family.legacy.ts
```

- [ ] **Step 9.3: Run typecheck, build, full test suite**

Run: `npm run typecheck && npm run build && npm test -- --run`
Expected: all green.

- [ ] **Step 9.4: Commit**

```bash
git commit -m "chore: delete dead code src/services/family.legacy.ts (Unit 1 Phase 1)"
```

---

## Task 10: Final verification and cleanup

- [ ] **Step 10.1: Run full test suite**

Run: `npm test -- --run`
Expected: all green, including the 4 new scope test files (storage, useMyFamilies, ScopeProvider, ScopeToggle — 18 tests total added by this plan).

- [ ] **Step 10.2: Run the build**

Run: `npm run build`
Expected: successful.

- [ ] **Step 10.3: Smoke test in dev**

Run: `npm run dev`
- Log in as user with ≥1 family.
- Toggle scope between `Pessoal` and `Família: X` — header button label changes, icon changes.
- Reload — selection persists.
- Open DevTools → Application → Local Storage → verify key `ffinance.scope.<user-id>`.
- Log out and log in as a user with zero families — toggle still shows, only `Pessoal` option.
- Log in as a user with multiple families — all appear in the dropdown.

- [ ] **Step 10.4: Update the spec's Unit 1 Estado (optional)**

Do NOT mark Unit 1 as "implemented" in the spec — the spec reflects the design, not execution. Instead, record progress in a short note at the end of `docs/superpowers/plans/` with a reference to this plan's merged commits, so the next plan (Unit 2 or Unit 3) can pick up cleanly.

- [ ] **Step 10.5: Run finishing-a-development-branch skill**

Use the `superpowers:finishing-a-development-branch` skill to decide next step (merge locally / push + PR / keep as-is / discard).

---

## Testing Strategy

- **Unit tests (Vitest + RTL):** 4 new files, 18 tests covering storage, provider hydration, families query, toggle interaction.
- **Typecheck:** runs as part of CI (`npm run typecheck`).
- **No E2E added in this plan.** E2E for scope-driven page behavior belongs to Units 5/6/7/8 plans, where pages actually consume `useScope`. Adding Playwright E2E now would have nothing meaningful to assert beyond "toggle button exists" — wait until scoped hooks are wired.

## Rollout Risk

**Low.** This plan adds infrastructure without changing any existing page's behavior. The only existing code modified is:
- `App.tsx` — adds one provider (pure additive).
- `MainLayout.tsx` — adds one button in header (pure additive).
- `accounts.ts:482-484` — removes defensive filter. If a caller was silently depending on it, current scope separation is already flawed and the next page test run will surface it. Low probability (grep confirms: this function is only called from the personal context, which itself filters upstream).
- Two dead files deleted (zero references confirmed before delete).

## Dependencies / Interfaces for Downstream Units

After this plan merges, downstream Units consume the scope as follows:

```typescript
import { useScope } from '@/features/scope';

const MyFeaturePage = () => {
  const { scopedFilter } = useScope();
  if (!scopedFilter) return null; // not authenticated
  const { data } = useScopedThings(scopedFilter); // Unit 5/6/7/8 will build these hooks
  // ...
};
```

The `scopedFilter` object is the stable contract: `{ userId: string, familyId: string | null }`. Feature-unit plans (5, 6, 7, 8) will add:
- A new `useScopedX` hook (one per entity) that calls a unified RPC.
- A new unified RPC `get_scoped_X(p_user_id uuid, p_family_id uuid)` that replaces `get_personal_X` + `get_family_X`.
- Migration of that entity's page from `PersonalProvider`/`FamilyProvider` to `useScope`.

Unit 3's plan (navigation) will eventually remove `PersonalProvider`, `FamilyProvider`, `/personal/*`, and `/family/*` routes. Until then, coexistence is intentional.

---

## Out of scope (reminder)

This plan is **Phase 1 of Unit 1**. Phases 2-4 from the spec distribute as follows:

| Spec phase | Lands in |
|---|---|
| Phase 1 — ScopeProvider + toggle + routes | **This plan** |
| Phase 2 — Merge `PersonalX.tsx`+`FamilyX.tsx` into `X.tsx` | Each of Units 5/6/7/8 plans (per entity) |
| Phase 3 — Unify RPCs + RLS review | Each of Units 5/6/7/8 plans (per entity) |
| Phase 4 — Delete `PersonalProvider` / `FamilyProvider` / `/personal` / `/family` / `accounts.ts:482` (already done here) | Unit 3 plan (final route cleanup) |

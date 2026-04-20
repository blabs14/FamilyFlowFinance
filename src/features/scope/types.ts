import { z } from 'zod';

export type PersonalScope = { kind: 'personal' };
export type FamilyScope = { kind: 'family'; familyId: string };

/**
 * Stored form of the current scope selection.
 * Later provider layers can enrich family scope with hydrated family data.
 */
export type StoredScope = PersonalScope | FamilyScope;

/**
 * Stable filter shape that downstream scoped hooks will consume.
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

import { storedScopeSchema, type StoredScope } from './types';

export const STORAGE_KEY_PREFIX = 'ffinance.scope.';

const keyFor = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

export const loadScope = (userId: string): StoredScope | null => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) {
      return null;
    }

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

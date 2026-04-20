import { beforeEach, describe, expect, it } from 'vitest';

import {
  STORAGE_KEY_PREFIX,
  clearScope,
  loadScope,
  saveScope,
} from '../../../src/features/scope/storage';

describe('scope storage', () => {
  const userId = 'user-abc';
  const familyId = '550e8400-e29b-41d4-a716-446655440000';

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
    saveScope(userId, { kind: 'family', familyId });
    expect(loadScope(userId)).toEqual({ kind: 'family', familyId });
  });

  it('isolates scope per user', () => {
    saveScope('user-a', {
      kind: 'family',
      familyId: '550e8400-e29b-41d4-a716-446655440001',
    });
    saveScope('user-b', { kind: 'personal' });

    expect(loadScope('user-a')).toEqual({
      kind: 'family',
      familyId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(loadScope('user-b')).toEqual({ kind: 'personal' });
  });

  it('returns null on corrupted JSON', () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, '{not-json');
    expect(loadScope(userId)).toBeNull();
  });

  it('returns null on schema-mismatched payload', () => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify({ kind: 'nonsense' }),
    );

    expect(loadScope(userId)).toBeNull();
  });

  it('clears scope for the given user', () => {
    saveScope(userId, { kind: 'personal' });
    clearScope(userId);
    expect(loadScope(userId)).toBeNull();
  });
});

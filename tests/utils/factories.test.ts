import { beforeEach, describe, expect, it } from 'vitest';

import {
  makeAccount,
  makeBudget,
  makeCategory,
  makeFamily,
  makeFamilyMember,
  makeGoal,
  makeProfile,
  makeReminder,
  makeTransaction,
  makeUser,
  resetFactoryCounter,
} from './factories';

describe('test factories', () => {
  beforeEach(() => resetFactoryCounter());

  it('produces unique ids by default', () => {
    expect(makeAccount().id).not.toBe(makeAccount().id);
    expect(makeFamily().id).not.toBe(makeFamily().id);
  });

  it('respects overrides', () => {
    expect(makeAccount({ nome: 'Custom' }).nome).toBe('Custom');
    expect(makeGoal({ valor_objetivo: 7500 }).valor_objetivo).toBe(7500);
  });

  it('each entity factory returns an object with an id', () => {
    for (const factory of [
      makeUser,
      makeProfile,
      makeFamily,
      makeFamilyMember,
      makeAccount,
      makeBudget,
      makeTransaction,
      makeCategory,
      makeGoal,
      makeReminder,
    ]) {
      expect(factory()).toHaveProperty('id');
    }
  });

  it('budget factory returns a budget-shaped object', () => {
    const budget = makeBudget();

    expect(budget).toHaveProperty('id');
    expect(budget).toHaveProperty('valor');
  });

  it('reminder factory respects overrides', () => {
    expect(makeReminder({ title: 'X' }).title).toBe('X');
  });

  it('family member factory defaults role to member', () => {
    expect(makeFamilyMember().role).toBe('member');
  });
});

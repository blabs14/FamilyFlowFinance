import { beforeEach, describe, expect, it } from 'vitest';

import {
  makeAccount,
  makeBudget,
  makeCategory,
  makeFamily,
  makeFamilyMember,
  makeGoal,
  makeProfile,
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
    ]) {
      expect(factory()).toHaveProperty('id');
    }
  });
});

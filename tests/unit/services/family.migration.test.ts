import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/features/family/services/family.service', () => ({
  familyService: {
    createFamily: vi.fn(),
    getFamilyData: vi.fn(),
    getMembers: vi.fn(),
    getPendingInvites: vi.fn(),
    getUserFamilies: vi.fn(),
  },
}));

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('../../../src/shared/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('family service migration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads family service helpers without depending on the legacy module', async () => {
    const legacyModulePath = '../../../src/services/' + ['family', 'legacy'].join('.');

    vi.doMock(legacyModulePath, () => {
      throw new Error('legacy module should not be imported by family.ts');
    });

    await expect(import('../../../src/services/family')).resolves.toMatchObject({
      updateFamilySettings: expect.any(Function),
      updateMemberRole: expect.any(Function),
      removeFamilyMember: expect.any(Function),
      inviteFamilyMember: expect.any(Function),
      cancelFamilyInvite: expect.any(Function),
      acceptFamilyInvite: expect.any(Function),
      shareGoalWithFamily: expect.any(Function),
      unshareGoalFromFamily: expect.any(Function),
      getFamilyStatistics: expect.any(Function),
      getFamilyKPIs: expect.any(Function),
      getFamilyKPIsRange: expect.any(Function),
      getFamilyCategoryBreakdown: expect.any(Function),
    });
  });
});

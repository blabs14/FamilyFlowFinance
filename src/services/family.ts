import { familyService } from "../features/family/services/family.service";
export { familyService };

export const createFamily = familyService.createFamily;
export const getFamilyData = familyService.getFamilyData;
export const getFamilyMembers = familyService.getMembers;
export const getPendingInvites = familyService.getPendingInvites;
export const getUserFamilies = familyService.getUserFamilies;

export {
  updateFamilySettings,
  updateMemberRole,
  removeFamilyMember,
  inviteFamilyMember,
  cancelFamilyInvite,
  acceptFamilyInvite,
  shareGoalWithFamily,
  unshareGoalFromFamily,
  getFamilyStatistics,
  getFamilyKPIs,
  getFamilyKPIsRange,
  getFamilyCategoryBreakdown,
} from "./family.legacy";
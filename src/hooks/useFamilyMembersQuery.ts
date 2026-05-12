import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFamilyMembers } from '../services/family_members';
import { useAuth } from '../contexts/AuthContext';
import { transferOwnership, softRemoveFamilyMember } from '@/services/family';

export const useFamilyMembers = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const { data, error } = await getFamilyMembers();
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
};

const FAMILY_MEMBERS_QUERY_KEY = 'family-members';

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      familyId,
      newOwnerUserId,
    }: { familyId: string; newOwnerUserId: string }) =>
      transferOwnership(familyId, newOwnerUserId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FAMILY_MEMBERS_QUERY_KEY] }),
  });
}

export function useSoftRemoveFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      familyId,
      userId,
      reason,
    }: { familyId: string; userId: string; reason?: string }) =>
      softRemoveFamilyMember(familyId, userId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [FAMILY_MEMBERS_QUERY_KEY] }),
  });
} 
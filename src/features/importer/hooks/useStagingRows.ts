import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchStagingRows, updateStagingRow } from '@/services/importer';

export function useStagingRows(fileId: string | null) {
  return useQuery({
    queryKey: ['staging_rows', fileId],
    queryFn: () => fetchStagingRows(fileId!).then(r => r.data ?? []),
    enabled: !!fileId,
  });
}

export function useUpdateStagingRow(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateStagingRow>[1] }) =>
      updateStagingRow(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staging_rows', fileId] }),
  });
}

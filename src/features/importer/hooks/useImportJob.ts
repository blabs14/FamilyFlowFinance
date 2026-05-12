import { useQuery } from '@tanstack/react-query';
import { fetchIngestionFile } from '@/services/importer';

export function useImportJob(fileId: string | null) {
  return useQuery({
    queryKey: ['ingestion_file', fileId],
    queryFn: () => fetchIngestionFile(fileId!).then(r => r.data),
    enabled: !!fileId,
    refetchInterval: (query) => {
      const status = (query.state.data as any)?.status;
      return status === 'ready' || status === 'error' ? false : 1000;
    },
  });
}

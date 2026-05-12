import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadStep } from './UploadStep';
import StagingTable from './StagingTable';
import { useImportJob } from './hooks/useImportJob';
import { useStagingRows } from './hooks/useStagingRows';
import { usePostStaging } from './hooks/usePostStaging';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

type Step = 'upload' | 'review';

export default function ImportPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep]               = useState<Step>('upload');
  const [fileId, setFileId]           = useState<string | null>(null);
  const [accountId, setAccountId]     = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: job }       = useImportJob(fileId);
  const { data: rows = [] } = useStagingRows(fileId);
  const postStaging = usePostStaging();

  function handleFileReady(fid: string, aid: string) {
    setFileId(fid);
    setAccountId(aid);
    setStep('review');
  }

  function initSelection(loadedRows: typeof rows) {
    setSelectedIds(new Set(
      (loadedRows as any[])
        .filter((r: any) => r.row_status !== 'duplicate' && r.row_status !== 'error')
        .map((r: any) => r.id)
    ));
  }

  const selectedRows = (rows as any[]).filter(r => selectedIds.has(r.id)).map(r => ({ ...r, account_id: accountId }));
  const jobAny = job as any;
  const progress = jobAny?.total_rows
    ? Math.round(((jobAny.ok_rows ?? 0) + (jobAny.duplicate_rows ?? 0) + (jobAny.error_rows ?? 0)) / jobAny.total_rows * 100)
    : null;

  async function handlePost() {
    try {
      await postStaging.mutateAsync({ selectedRows });
      toast({ title: `${selectedRows.length} transações importadas com sucesso.` });
      navigate('/app/transacoes');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao importar', description: e.message });
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Importar transações</h1>

      {step === 'upload' && <UploadStep onFileReady={handleFileReady} />}

      {step === 'review' && (
        <div className="space-y-4">
          {jobAny?.status !== 'ready' && progress !== null && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">A processar…</p>
              <Progress value={progress} />
            </div>
          )}

          {jobAny?.status === 'ready' && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {jobAny.total_rows} linhas · {jobAny.ok_rows} ok · {jobAny.duplicate_rows} duplicados · {jobAny.matched_recurring_rows} recorrentes
                </div>
                <Button onClick={handlePost} disabled={selectedRows.length === 0 || postStaging.isPending}>
                  {postStaging.isPending ? 'A importar…' : `Importar ${selectedRows.length} transações`}
                </Button>
              </div>

              <StagingTable
                fileId={fileId!}
                rows={rows as any}
                selectedIds={selectedIds}
                onSelect={(id, checked) => {
                  const next = new Set(selectedIds);
                  checked ? next.add(id) : next.delete(id);
                  setSelectedIds(next);
                }}
                onSelectAll={(checked) => {
                  if (checked) initSelection(rows);
                  else setSelectedIds(new Set());
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

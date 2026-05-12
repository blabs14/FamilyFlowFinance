import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { createIngestionFile, invokeIngestCSV, fetchBankTemplates } from '@/services/importer';
import { useQuery } from '@tanstack/react-query';

function sniffFile(content: string, filename: string, templates: Array<{ bank_code: string; header_signature: string[] }>): string {
  const first3 = content.split(/\r?\n/).slice(0, 3).join('\n');
  if (filename.toLowerCase().endsWith('.ofx') || first3.trimStart().startsWith('<OFX>')) return 'OFX';
  const commas = (first3.match(/,/g) || []).length;
  const semis  = (first3.match(/;/g) || []).length;
  if (commas < 2 && semis < 2) return 'Formato desconhecido — mapeamento manual';
  const headerLine = content.split(/\r?\n/)[0] ?? '';
  const headerCols = headerLine.split(/[,;]/).map(c => c.trim().toLowerCase());
  for (const t of templates) {
    if (t.header_signature.map(s => s.toLowerCase()).every(sig => headerCols.some(col => col === sig))) {
      const label = t.bank_code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `CSV — ${label} detectado`;
    }
  }
  return 'CSV — Formato desconhecido — mapeamento manual';
}

interface Props {
  onFileReady: (fileId: string, accountId: string) => void;
}

export function UploadStep({ onFileReady }: Props) {
  const { user } = useAuth();
  // accounts table uses `nome` column (not `name`)
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts_upload'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, nome');
      return data ?? [];
    },
  });
  const [accountId, setAccountId]   = useState('');
  const [sniffLabel, setSniffLabel] = useState<string | null>(null);
  const [file, setFile]             = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    const text = await f.text();
    const { data: templates = [] } = await fetchBankTemplates();
    setSniffLabel(sniffFile(text.slice(0, 1000), f.name, templates ?? []));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function handleProcess() {
    if (!file || !accountId) return;
    setProcessing(true);
    setError(null);
    try {
      const path = `imports/${user!.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('imports').upload(path, file);
      if (upErr) throw upErr;

      const { data: fileRow, error: dbErr } = await createIngestionFile({
        user_id: user!.id,
        family_id: null,
        scope: 'personal',
        storage_bucket: 'imports',
        storage_path: path,
        account_id: accountId,
      });
      if (dbErr) throw dbErr;

      await invokeIngestCSV(fileRow!.id, accountId);
      onFileReady(fileRow!.id, accountId);
    } catch (e: any) {
      setError(e.message ?? 'Erro desconhecido');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-muted/30"
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.ofx"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="space-y-1">
            <p className="font-medium">{file.name}</p>
            {sniffLabel && <Badge variant="outline">{sniffLabel}</Badge>}
          </div>
        ) : (
          <p className="text-muted-foreground">Arraste um ficheiro CSV ou OFX, ou clique para selecionar</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Conta destino</label>
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger><SelectValue placeholder="Selecionar conta…" /></SelectTrigger>
          <SelectContent>
            {(accounts as any[]).map(a => (
              <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleProcess} disabled={!file || !accountId || processing} className="w-full">
        {processing ? 'A processar…' : 'Processar'}
      </Button>
    </div>
  );
}

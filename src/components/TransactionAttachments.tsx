// src/components/TransactionAttachments.tsx
import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  listTransactionAttachments,
  uploadTransactionAttachment,
  deleteTransactionAttachment,
  getAttachmentPublicUrl,
  TransactionAttachment,
} from '../services/attachments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { Button } from './ui/button';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface TransactionAttachmentsProps {
  transactionId: string;
}

export const TransactionAttachments = ({ transactionId }: TransactionAttachmentsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments', transactionId],
    queryFn: async () => {
      const { data, error } = await listTransactionAttachments(transactionId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransactionAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', transactionId] });
      toast({ title: 'Anexo removido' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao remover anexo';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({ title: 'Ficheiro demasiado grande (máximo 10 MB)', variant: 'destructive' });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({ title: 'Tipo de ficheiro não suportado (use JPG, PNG, WebP ou PDF)', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const { error } = await uploadTransactionAttachment(transactionId, user.id, file);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['attachments', transactionId] });
      toast({ title: 'Anexo carregado com sucesso' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar anexo';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  if (isLoading) return <div className="text-sm text-gray-400">A carregar anexos...</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Recibos/Faturas</span>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'A carregar...' : '+ Anexar'}
        </Button>
      </div>

      {attachments && attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((att: TransactionAttachment) => (
            <li key={att.id} className="flex items-center gap-2 text-sm">
              <a
                href={getAttachmentPublicUrl(att.storage_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate max-w-xs"
              >
                {att.original_filename ?? att.storage_path}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 h-6 px-1"
                onClick={() => deleteMutation.mutate(att.id)}
              >
                &times;
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TransactionAttachments;

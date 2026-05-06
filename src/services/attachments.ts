// src/services/attachments.ts
// Unit 6: adicionadas funções transaction-aware usando bucket 'receipts'
import { supabase } from '../lib/supabaseClient';

const BUCKET = 'attachments';
const RECEIPTS_BUCKET = 'receipts';

export interface TransactionAttachment {
  id: string;
  transaction_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

export const uploadAttachment = async (file: File, path: string) => {
  return supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
};

export const getAttachmentUrl = (path: string) => {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

export const downloadAttachment = async (path: string) => {
  return supabase.storage.from(BUCKET).download(path);
};

export const deleteAttachment = async (path: string) => {
  return supabase.storage.from(BUCKET).remove([path]);
};

// ── Transaction-aware attachment functions (bucket: receipts) ──

export const uploadTransactionAttachment = async (
  transactionId: string,
  userId: string,
  file: File
): Promise<{ data: TransactionAttachment | null; error: unknown }> => {
  try {
    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${transactionId}/${Date.now()}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(storagePath, file, { upsert: false });

    if (storageError) return { data: null, error: storageError };

    const { data, error } = await supabase
      .from('transaction_attachments')
      .insert([{
        transaction_id: transactionId,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      }])
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const listTransactionAttachments = async (
  transactionId: string
): Promise<{ data: TransactionAttachment[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transaction_attachments')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('uploaded_at', { ascending: false });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteTransactionAttachment = async (
  attachmentId: string
): Promise<{ error: unknown }> => {
  try {
    const { data: att, error: fetchError } = await supabase
      .from('transaction_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !att) return { error: fetchError ?? new Error('Anexo não encontrado') };

    const { error: storageError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .remove([att.storage_path]);

    if (storageError) return { error: storageError };

    const { error: dbError } = await supabase
      .from('transaction_attachments')
      .delete()
      .eq('id', attachmentId);

    return { error: dbError };
  } catch (error) {
    return { error };
  }
};

export const getAttachmentPublicUrl = (storagePath: string): string => {
  return supabase.storage.from(RECEIPTS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
};
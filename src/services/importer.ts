// src/services/importer.ts
import { supabase } from '@/lib/supabaseClient';

export async function fetchBankTemplates() {
  return supabase.from('bank_templates').select('*').eq('active', true);
}

export async function createIngestionFile(payload: {
  user_id: string;
  family_id?: string | null;
  scope: 'personal' | 'family';
  storage_bucket: string;
  storage_path: string;
  account_id: string;
}) {
  return supabase.from('ingestion_files').insert(payload).select('*').single();
}

export async function fetchIngestionFile(id: string) {
  return supabase.from('ingestion_files').select('*').eq('id', id).single();
}

export async function fetchStagingRows(fileId: string) {
  return supabase
    .from('staging_transactions')
    .select('*')
    .eq('file_id', fileId)
    .order('row_index', { ascending: true });
}

export async function updateStagingRow(id: string, patch: Partial<{
  category_id: string;
  selected: boolean;
}>) {
  return supabase.from('staging_transactions').update(patch).eq('id', id);
}

export async function fetchActiveRules(userId: string, familyId?: string | null) {
  let q = supabase
    .from('import_categorization_rules')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: true });
  return q;
}

export async function createRule(payload: {
  user_id?: string;
  family_id?: string;
  scope: 'user' | 'family';
  match_field: string;
  match_type: string;
  pattern: string;
  category_id: string;
}) {
  return supabase.from('import_categorization_rules').insert(payload).select('*').single();
}

export async function invokeIngestCSV(fileId: string, accountId: string, mapping?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ingest_csv', {
    body: { file_id: fileId, account_id: accountId, mapping },
  });
  if (error) throw error;
  return data;
}

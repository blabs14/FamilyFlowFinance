-- supabase/migrations/20260422130000_unit06_transaction_attachments.sql
-- Unit 6 Task 4: transaction_attachments — recibos/faturas ligadas a transações

set local search_path = public;

CREATE TABLE public.transaction_attachments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  storage_path      text        NOT NULL,          -- path no bucket receipts
  original_filename text,
  mime_type         text,
  size_bytes        bigint      CHECK (size_bytes > 0),
  uploaded_by       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tx_attachments_transaction ON public.transaction_attachments(transaction_id);
CREATE INDEX idx_tx_attachments_uploader    ON public.transaction_attachments(uploaded_by);

-- RLS
ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

-- Leitura: ver anexo se puder ver a transação
CREATE POLICY sel_tx_attachments ON public.transaction_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_attachments.transaction_id
        AND (
          t.user_id = auth.uid()
          OR (
            t.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = t.family_id
                AND fm.user_id = auth.uid()
                
            )
          )
        )
    )
  );

-- Insert: uploader deve ser o próprio auth.uid()
CREATE POLICY ins_tx_attachments ON public.transaction_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- Delete: apenas quem fez upload
CREATE POLICY del_tx_attachments ON public.transaction_attachments
  FOR DELETE USING (uploaded_by = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.transaction_attachments TO authenticated;

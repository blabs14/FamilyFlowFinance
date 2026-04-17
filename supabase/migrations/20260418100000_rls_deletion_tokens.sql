ALTER TABLE public.deletion_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deletion_tokens_owner_select"
  ON public.deletion_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "deletion_tokens_owner_insert"
  ON public.deletion_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deletion_tokens_owner_delete"
  ON public.deletion_tokens FOR DELETE
  USING (auth.uid() = user_id);

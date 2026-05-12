-- supabase/migrations/20260512100000_unit14a_bank_templates.sql
BEGIN;

CREATE TABLE IF NOT EXISTS bank_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code        text        NOT NULL UNIQUE,
  format           text        NOT NULL CHECK (format IN ('csv','ofx')),
  header_signature text[]      NOT NULL,
  mapping          jsonb       NOT NULL,
  locale           text        NOT NULL DEFAULT 'pt-PT',
  active           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON bank_templates
  FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO bank_templates (bank_code, format, header_signature, mapping) VALUES
('MILLENNIUM_BCP', 'csv',
 ARRAY['Data movimento','Descrição','Débito','Crédito'],
 '{"date_col":"Data movimento","amount_col_debit":"Débito","amount_col_credit":"Crédito","description_col":"Descrição","debit_sign":-1,"decimal_separator":",","date_format":"DD-MM-YYYY","encoding":"utf-8"}'::jsonb
),
('SANTANDER_TOTTA', 'csv',
 ARRAY['Data','Descrição','Valor','Saldo'],
 '{"date_col":"Data","amount_col":"Valor","description_col":"Descrição","debit_sign":1,"decimal_separator":",","date_format":"DD-MM-YYYY","encoding":"utf-8"}'::jsonb
),
('CGD', 'csv',
 ARRAY['Data Valor','Descrição','Valor','Saldo Contabilístico'],
 '{"date_col":"Data Valor","amount_col":"Valor","description_col":"Descrição","debit_sign":1,"decimal_separator":",","date_format":"YYYY-MM-DD","encoding":"utf-8"}'::jsonb
),
('NOVO_BANCO', 'csv',
 ARRAY['DATA','DESCRIÇÃO','VALOR','SALDO'],
 '{"date_col":"DATA","amount_col":"VALOR","description_col":"DESCRIÇÃO","debit_sign":1,"decimal_separator":",","date_format":"DD/MM/YYYY","encoding":"iso-8859-1"}'::jsonb
),
('ACTIVOBANK', 'csv',
 ARRAY['Data','Movimento','Montante','Saldo'],
 '{"date_col":"Data","amount_col":"Montante","description_col":"Movimento","debit_sign":1,"decimal_separator":",","date_format":"DD-MM-YYYY","encoding":"utf-8"}'::jsonb
),
('MONTEPIO', 'csv',
 ARRAY['Data Op.','Descrição','Montante','Saldo'],
 '{"date_col":"Data Op.","amount_col":"Montante","description_col":"Descrição","debit_sign":1,"decimal_separator":",","date_format":"DD-MM-YYYY","encoding":"utf-8"}'::jsonb
),
('BPI', 'csv',
 ARRAY['Data','Descrição do Movimento','Valor'],
 '{"date_col":"Data","amount_col":"Valor","description_col":"Descrição do Movimento","debit_sign":1,"decimal_separator":",","date_format":"DD-MM-YYYY","encoding":"utf-8"}'::jsonb
);

COMMIT;

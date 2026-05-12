# Unit 14a — Importer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 40%-functional importer with a production-ready pipeline — 7 PT bank templates, auto-detection, fuzzy dedup against transactions + recurring_instances, rules engine with 30 PT seeds, and a redesigned `/app/import` UI.

**Architecture:** The Edge Function `ingest_csv` is fully rewritten as a modular pipeline (detect → parse → dedup → rules → upsert). DB gains two new tables (`bank_templates`, `import_categorization_rules`) and additive columns on `staging_transactions`/`ingestion_files`. The UI is restructured under `src/features/importer/` with a 3-step flow (Upload → Review → Post). Legacy routes become redirects. OCR dead code (`ingest_receipt` EF + `ReceiptPreview.tsx`) is deleted.

**Tech Stack:** TypeScript, Deno (Edge Functions), Vitest (EF unit tests), Playwright (E2E), React, React Query, shadcn/ui, papaparse, ofx-js, Supabase (PostgreSQL + RLS + pg_trgm)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260512100000_unit14a_bank_templates.sql` | Create | `bank_templates` table + 7-bank seed + RLS |
| `supabase/migrations/20260512110000_unit14a_rules.sql` | Create | `import_categorization_rules` table + ~30 system_seed rows + RLS |
| `supabase/migrations/20260512120000_unit14a_staging_columns.sql` | Create | ALTER `staging_transactions` (row_status, error_detail, matched_recurring_instance_id, category_id, applied_rule_id) |
| `supabase/migrations/20260512130000_unit14a_ingestion_files_columns.sql` | Create | ALTER `ingestion_files` (account_id, detected_format, detected_bank, total_rows, ok_rows, error_rows, duplicate_rows, matched_recurring_rows, soft_deleted_at) |
| `supabase/migrations/20260512140000_unit14a_bulk_dedup_rpc.sql` | Create | `bulk_fuzzy_dedup` RPC (JSON array input → per-row status output via pg_trgm) |
| `supabase/functions/ingest_csv/index.ts` | Rewrite | Pipeline orchestrator |
| `supabase/functions/ingest_csv/parsers/detect-format.ts` | Create | `'csv' \| 'ofx' \| 'unknown'` + delimiter/encoding sniff |
| `supabase/functions/ingest_csv/parsers/detect-bank.ts` | Create | header_signature match → bank_code \| null |
| `supabase/functions/ingest_csv/parsers/csv-bank-template.ts` | Create | Parse CSV using `bank_templates.mapping` → NormalizedRow[] |
| `supabase/functions/ingest_csv/parsers/csv-generic.ts` | Create | Refactored generic parser (manual mapping fallback) → NormalizedRow[] |
| `supabase/functions/ingest_csv/parsers/ofx.ts` | Create | ofx-js parser → NormalizedRow[] |
| `supabase/functions/ingest_csv/dedup/fuzzy-dedup.ts` | Create | Two-pass dedup via `bulk_fuzzy_dedup` RPC → row_status per row |
| `supabase/functions/ingest_csv/rules/apply-rules.ts` | Create | Priority-ordered rules → category_id + applied_rule_id per row |
| `supabase/functions/ingest_csv/__tests__/detect-format.test.ts` | Create | Vitest: CSV variants, OFX, unknown |
| `supabase/functions/ingest_csv/__tests__/detect-bank.test.ts` | Create | Vitest: all 7 banks, no-match |
| `supabase/functions/ingest_csv/__tests__/csv-bank-template.test.ts` | Create | Vitest: per-bank fixture, date formats, decimal sep |
| `supabase/functions/ingest_csv/__tests__/csv-generic.test.ts` | Create | Vitest: manual mapping, semicolons, encoding |
| `supabase/functions/ingest_csv/__tests__/ofx.test.ts` | Create | Vitest: OFX fixture, sign, date norm |
| `supabase/functions/ingest_csv/__tests__/fuzzy-dedup.test.ts` | Create | Vitest: exact dup, probable dup, recurring match, false-pos guard |
| `supabase/functions/ingest_csv/__tests__/apply-rules.test.ts` | Create | Vitest: priority, user overrides seed, regex, amount_range |
| `supabase/functions/ingest_csv/__tests__/fixtures/` | Create | Anonymised CSV per bank (7) + 1 OFX |
| `supabase/functions/ingest_receipt/` | Delete | Remove OCR stub entirely |
| `src/features/importer/ImportPage.tsx` | Create | Top-level stepper (Upload → Review → Post) |
| `src/features/importer/UploadStep.tsx` | Create | Drag/drop, account selector, client-side sniff badge, Processar button |
| `src/features/importer/StagingTable.tsx` | Rewrite | New row_status badges, category inline, selection logic |
| `src/features/importer/MappingForm.tsx` | Keep | Unchanged — fallback for unrecognised CSV |
| `src/features/importer/components/RowStatusBadge.tsx` | Create | Badge variants for all 6 row_status values |
| `src/features/importer/components/CategoryCell.tsx` | Create | Inline dropdown + ⚡ rule indicator + "Criar regra" link |
| `src/features/importer/components/RecurringMatchExpander.tsx` | Create | Expand row to show matched recurring_instance detail |
| `src/features/importer/components/CreateRuleModal.tsx` | Create | Form to create import_categorization_rules from a staged row |
| `src/features/importer/hooks/useImportJob.ts` | Create | React Query poll on `ingestion_files` (1s interval while processing) |
| `src/features/importer/hooks/useStagingRows.ts` | Create | React Query fetch of `staging_transactions` for a file |
| `src/features/importer/hooks/usePostStaging.ts` | Create | Post action: insert transactions + confirm recurring instances |
| `src/services/importer.ts` | Refactor | Remove `ingestion_jobs` refs; add `bank_templates` + `import_categorization_rules` + `ingestion_files` queries |
| `src/pages/importer.tsx` | Delete | Replaced by `src/features/importer/ImportPage.tsx` |
| `src/features/importer/ReceiptPreview.tsx` | Delete | OCR dead code |
| `src/App.tsx` | Modify | Add `/app/import` lazy route; replace `/personal/importar` + `/family/importar` with redirects |
| `e2e/importer.spec.ts` | Create | Playwright: 4 E2E scenarios |

---

## Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/20260512100000_unit14a_bank_templates.sql`
- Create: `supabase/migrations/20260512110000_unit14a_rules.sql`
- Create: `supabase/migrations/20260512120000_unit14a_staging_columns.sql`
- Create: `supabase/migrations/20260512130000_unit14a_ingestion_files_columns.sql`
- Create: `supabase/migrations/20260512140000_unit14a_bulk_dedup_rpc.sql`

- [ ] **Step 1: Migration 1 — `bank_templates` + seed**

```sql
-- supabase/migrations/20260512100000_unit14a_bank_templates.sql
BEGIN;

CREATE TABLE bank_templates (
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
```

- [ ] **Step 2: Migration 2 — `import_categorization_rules` + ~30 system seeds**

```sql
-- supabase/migrations/20260512110000_unit14a_rules.sql
BEGIN;

CREATE TABLE import_categorization_rules (
  id          uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid      REFERENCES auth.users,
  family_id   uuid      REFERENCES families,
  scope       text      NOT NULL CHECK (scope IN ('user','family','system_seed')),
  priority    smallint  NOT NULL DEFAULT 100,
  match_field text      NOT NULL CHECK (match_field IN ('description','counterparty','amount_range')),
  match_type  text      NOT NULL CHECK (match_type IN ('contains','regex','equals','starts_with','range')),
  pattern     text      NOT NULL,
  category_id uuid      NOT NULL REFERENCES categories,
  active      boolean   NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE import_categorization_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own or system" ON import_categorization_rules
  FOR SELECT USING (
    scope = 'system_seed'
    OR user_id = auth.uid()
    OR family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "insert own" ON import_categorization_rules
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "update own" ON import_categorization_rules
  FOR UPDATE USING (
    user_id = auth.uid() OR
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

CREATE POLICY "delete own" ON import_categorization_rules
  FOR DELETE USING (
    user_id = auth.uid() OR
    family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid())
  );

-- system_seed rules (priority=1000; user rules default 100 → user wins)
-- category_id values must match actual seeded categories — replace UUIDs via lookup in seed script.
-- Pattern: (match_field, match_type, pattern, category_name_for_lookup)
DO $$
DECLARE
  cat_id uuid;
  seeds text[][] := ARRAY[
    ARRAY['LIDL',           'Supermercado'],
    ARRAY['PINGO DOCE',     'Supermercado'],
    ARRAY['CONTINENTE',     'Supermercado'],
    ARRAY['AUCHAN',         'Supermercado'],
    ARRAY['JUMBO',          'Supermercado'],
    ARRAY['INTERMARCHE',    'Supermercado'],
    ARRAY['GALP',           'Combustível'],
    ARRAY['BP ',            'Combustível'],
    ARRAY['REPSOL',         'Combustível'],
    ARRAY['CEPSA',          'Combustível'],
    ARRAY['NOS ',           'Telecomunicações'],
    ARRAY['MEO ',           'Telecomunicações'],
    ARRAY['VODAFONE',       'Telecomunicações'],
    ARRAY['NOWO',           'Telecomunicações'],
    ARRAY['EDP',            'Energia'],
    ARRAY['GALP GAS',       'Energia'],
    ARRAY['GOLD ENERGY',    'Energia'],
    ARRAY['FARMACI',        'Saúde'],
    ARRAY['MB WAY',         'Transferência'],
    ARRAY['LEVANTAMENTO',   'Levantamento'],
    ARRAY['CAIXA AUTOMATIC','Levantamento'],
    ARRAY['COMISSAO',       'Despesas Bancárias'],
    ARRAY['TAXA BANCARIA',  'Despesas Bancárias'],
    ARRAY['IUC',            'Impostos'],
    ARRAY['IMI',            'Impostos'],
    ARRAY['SEG SOCIAL',     'Impostos'],
    ARRAY['CTT',            'Serviços Postais'],
    ARRAY['UBER',           'Transportes'],
    ARRAY['BOLT',           'Transportes'],
    ARRAY['NETFLIX',        'Subscrições'],
    ARRAY['SPOTIFY',        'Subscrições'],
    ARRAY['HBO',            'Subscrições'],
    ARRAY['DISNEY',         'Subscrições'],
    ARRAY['RESTAURANTE',    'Restauração'],
    ARRAY['PASTELARIA',     'Restauração'],
    ARRAY['CAFE',           'Restauração'],
    ARRAY['ZARA',           'Vestuário'],
    ARRAY['H&M',            'Vestuário'],
    ARRAY['PRIMARK',        'Vestuário'],
    ARRAY['AMAZON',         'Compras Online'],
    ARRAY['FNAC',           'Compras Online'],
    ARRAY['WORTEN',         'Compras Online']
  ];
  seed text[];
BEGIN
  FOREACH seed SLICE 1 IN ARRAY seeds LOOP
    SELECT id INTO cat_id FROM categories WHERE name ILIKE seed[2] LIMIT 1;
    IF cat_id IS NOT NULL THEN
      INSERT INTO import_categorization_rules
        (scope, priority, match_field, match_type, pattern, category_id)
      VALUES ('system_seed', 1000, 'description', 'contains', seed[1], cat_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

COMMIT;
```

- [ ] **Step 3: Migration 3 — ALTER `staging_transactions`**

```sql
-- supabase/migrations/20260512120000_unit14a_staging_columns.sql
BEGIN;

ALTER TABLE staging_transactions
  ADD COLUMN IF NOT EXISTS row_status text
    NOT NULL DEFAULT 'ok'
    CHECK (row_status IN ('ok','warning','error','duplicate','probable_duplicate','matches_recurring')),
  ADD COLUMN IF NOT EXISTS error_detail text,
  ADD COLUMN IF NOT EXISTS matched_recurring_instance_id uuid REFERENCES recurring_instances(id),
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS applied_rule_id uuid REFERENCES import_categorization_rules(id);

COMMIT;
```

- [ ] **Step 4: Migration 4 — ALTER `ingestion_files`**

```sql
-- supabase/migrations/20260512130000_unit14a_ingestion_files_columns.sql
BEGIN;

ALTER TABLE ingestion_files
  ADD COLUMN IF NOT EXISTS account_id           uuid REFERENCES accounts(id),
  ADD COLUMN IF NOT EXISTS detected_format      text CHECK (detected_format IN ('csv','ofx','unknown')),
  ADD COLUMN IF NOT EXISTS detected_bank        text,
  ADD COLUMN IF NOT EXISTS total_rows           integer,
  ADD COLUMN IF NOT EXISTS ok_rows              integer,
  ADD COLUMN IF NOT EXISTS error_rows           integer,
  ADD COLUMN IF NOT EXISTS duplicate_rows       integer,
  ADD COLUMN IF NOT EXISTS matched_recurring_rows integer,
  ADD COLUMN IF NOT EXISTS soft_deleted_at      timestamptz;

COMMIT;
```

- [ ] **Step 5: Migration 5 — `bulk_fuzzy_dedup` RPC**

```sql
-- supabase/migrations/20260512140000_unit14a_bulk_dedup_rpc.sql
BEGIN;

-- Enable pg_trgm if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Input: JSON array of {row_index, date, amount_cents, description}
-- Output: table of {row_index, row_status, matched_transaction_id, matched_recurring_instance_id}
CREATE OR REPLACE FUNCTION bulk_fuzzy_dedup(
  p_account_id  uuid,
  p_rows        jsonb
)
RETURNS TABLE (
  row_index                     integer,
  row_status                    text,
  matched_transaction_id        uuid,
  matched_recurring_instance_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r jsonb;
  v_date        date;
  v_amount      integer;
  v_description text;
  v_idx         integer;
  v_txn_id      uuid;
  v_rec_id      uuid;
  v_status      text;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx         := (r->>'row_index')::integer;
    v_date        := (r->>'date')::date;
    v_amount      := (r->>'amount_cents')::integer;
    v_description := r->>'description';
    v_txn_id      := NULL;
    v_rec_id      := NULL;
    v_status      := 'ok';

    -- Pass 1: exact duplicate against transactions
    SELECT id INTO v_txn_id
    FROM transactions
    WHERE account_id = p_account_id
      AND ABS(date - v_date) <= 2
      AND ABS(amount_cents - v_amount) <= 2
    LIMIT 1;

    IF v_txn_id IS NOT NULL THEN
      v_status := 'duplicate';
    ELSE
      -- Pass 1b: probable duplicate (same amount, similar description, ±5d)
      SELECT id INTO v_txn_id
      FROM transactions
      WHERE account_id = p_account_id
        AND ABS(date - v_date) <= 5
        AND amount_cents = v_amount
        AND similarity(description, v_description) >= 0.7
      LIMIT 1;

      IF v_txn_id IS NOT NULL THEN
        v_status := 'probable_duplicate';
      END IF;
    END IF;

    -- Pass 2: recurring instances (only if not already a hard duplicate)
    IF v_status <> 'duplicate' THEN
      SELECT id INTO v_rec_id
      FROM recurring_instances
      WHERE account_id = p_account_id
        AND status IN ('pending','confirmed')
        AND ABS(due_date - v_date) <= 2
        AND ABS(amount_cents - v_amount) <= 2
      LIMIT 1;

      IF v_rec_id IS NOT NULL THEN
        v_status := 'matches_recurring';
      END IF;
    END IF;

    row_index                     := v_idx;
    row_status                    := v_status;
    matched_transaction_id        := v_txn_id;
    matched_recurring_instance_id := v_rec_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_fuzzy_dedup(uuid, jsonb) TO authenticated;

COMMIT;
```

- [ ] **Step 6: Apply migrations**

```bash
npx supabase db push
```

Expected: 5 migrations applied, no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(importer): Unit 14a DB migrations — bank_templates, rules, staging columns, dedup RPC"
```

---

## Task 2: Delete OCR Dead Code

**Files:**
- Delete: `supabase/functions/ingest_receipt/` (entire directory)
- Delete: `src/features/importer/ReceiptPreview.tsx`
- Delete: `src/pages/importer.tsx`
- Modify: `.env`, `.env.example`, `supabase/config.toml` (remove `GCV_KEY`, `GCV_ENDPOINT`)
- Modify: `src/services/importer.ts` (remove `edgeIngestReceipt`, `ingestion_jobs` refs)

- [ ] **Step 1: Delete EF and UI dead code**

```bash
rm -rf supabase/functions/ingest_receipt
rm src/features/importer/ReceiptPreview.tsx
rm src/pages/importer.tsx
```

- [ ] **Step 2: Remove GCV env vars from config files**

Search for `GCV_KEY` and `GCV_ENDPOINT` in: `.env`, `.env.example`, `.env.local`, `supabase/config.toml`, `README.md`. Remove those lines.

- [ ] **Step 3: Strip `ingestion_jobs` refs from `src/services/importer.ts`**

Replace the entire file content with a clean slate (only keep what 14a needs — further expanded in Task 8):

```typescript
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
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors (fix any import that referenced deleted files).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(importer): remove OCR dead code (ingest_receipt EF, ReceiptPreview, GCV env vars)"
```

---

## Task 3: EF — Shared Type + `detect-format.ts`

**Files:**
- Create: `supabase/functions/ingest_csv/types.ts`
- Create: `supabase/functions/ingest_csv/parsers/detect-format.ts`
- Create: `supabase/functions/ingest_csv/__tests__/detect-format.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/ingest_csv/__tests__/detect-format.test.ts
import { describe, it, expect } from 'vitest';
import { detectFormat } from '../parsers/detect-format.ts';

describe('detectFormat', () => {
  it('returns ofx for .ofx extension hint', () => {
    expect(detectFormat('<OFX>\nsome content', 'file.ofx')).toEqual({ format: 'ofx' });
  });

  it('returns ofx when content starts with <OFX>', () => {
    expect(detectFormat('<OFX>\nSTMTTRN', 'file.csv')).toEqual({ format: 'ofx' });
  });

  it('returns csv with comma delimiter', () => {
    const r = detectFormat('Data,Descricao,Valor\n01-01-2025,Lidl,-20.00', 'file.csv');
    expect(r.format).toBe('csv');
    expect(r.delimiter).toBe(',');
  });

  it('returns csv with semicolon delimiter', () => {
    const r = detectFormat('Data;Descricao;Valor\n01-01-2025;Lidl;-20,00', 'file.csv');
    expect(r.format).toBe('csv');
    expect(r.delimiter).toBe(';');
  });

  it('returns unknown for unrecognised content', () => {
    expect(detectFormat('not a csv or ofx', 'file.txt')).toEqual({ format: 'unknown' });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/detect-format.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create shared type + `detect-format.ts`**

```typescript
// supabase/functions/ingest_csv/types.ts
export interface NormalizedRow {
  date: string;           // ISO YYYY-MM-DD
  amount_cents: number;   // positive = credit, negative = debit
  description: string;
  counterparty?: string;
  raw_json: Record<string, unknown>;
}
```

```typescript
// supabase/functions/ingest_csv/parsers/detect-format.ts
export interface FormatResult {
  format: 'csv' | 'ofx' | 'unknown';
  delimiter?: string;
  encoding?: string;
}

export function detectFormat(content: string, filename?: string): FormatResult {
  if (filename?.toLowerCase().endsWith('.ofx') || content.trimStart().startsWith('<OFX>')) {
    return { format: 'ofx' };
  }
  const first3 = content.split(/\r?\n/).slice(0, 3).join('\n');
  const commas = (first3.match(/,/g) || []).length;
  const semis  = (first3.match(/;/g) || []).length;
  if (commas >= 2) return { format: 'csv', delimiter: ',' };
  if (semis  >= 2) return { format: 'csv', delimiter: ';' };
  return { format: 'unknown' };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/detect-format.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ingest_csv/
git commit -m "feat(importer): EF detect-format module + tests"
```

---

## Task 4: EF — `detect-bank.ts`

**Files:**
- Create: `supabase/functions/ingest_csv/parsers/detect-bank.ts`
- Create: `supabase/functions/ingest_csv/__tests__/detect-bank.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// supabase/functions/ingest_csv/__tests__/detect-bank.test.ts
import { describe, it, expect } from 'vitest';
import { detectBank } from '../parsers/detect-bank.ts';

const templates = [
  { bank_code: 'MILLENNIUM_BCP', header_signature: ['Data movimento','Descrição','Débito','Crédito'] },
  { bank_code: 'SANTANDER_TOTTA', header_signature: ['Data','Descrição','Valor','Saldo'] },
  { bank_code: 'CGD', header_signature: ['Data Valor','Descrição','Valor','Saldo Contabilístico'] },
  { bank_code: 'NOVO_BANCO', header_signature: ['DATA','DESCRIÇÃO','VALOR','SALDO'] },
  { bank_code: 'ACTIVOBANK', header_signature: ['Data','Movimento','Montante','Saldo'] },
  { bank_code: 'MONTEPIO', header_signature: ['Data Op.','Descrição','Montante','Saldo'] },
  { bank_code: 'BPI', header_signature: ['Data','Descrição do Movimento','Valor'] },
];

describe('detectBank', () => {
  it('detects MILLENNIUM_BCP', () => {
    expect(detectBank('Data movimento,Descrição,Débito,Crédito', templates)).toBe('MILLENNIUM_BCP');
  });

  it('detects SANTANDER_TOTTA', () => {
    expect(detectBank('Data,Descrição,Valor,Saldo', templates)).toBe('SANTANDER_TOTTA');
  });

  it('detects CGD', () => {
    expect(detectBank('Data Valor,Descrição,Valor,Saldo Contabilístico', templates)).toBe('CGD');
  });

  it('detects NOVO_BANCO (case-insensitive)', () => {
    expect(detectBank('DATA,DESCRIÇÃO,VALOR,SALDO', templates)).toBe('NOVO_BANCO');
  });

  it('detects ACTIVOBANK', () => {
    expect(detectBank('Data,Movimento,Montante,Saldo', templates)).toBe('ACTIVOBANK');
  });

  it('detects MONTEPIO', () => {
    expect(detectBank('Data Op.,Descrição,Montante,Saldo', templates)).toBe('MONTEPIO');
  });

  it('detects BPI', () => {
    expect(detectBank('Data,Descrição do Movimento,Valor', templates)).toBe('BPI');
  });

  it('returns null for unrecognised header', () => {
    expect(detectBank('Date,Amount,Description', templates)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/detect-bank.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `detect-bank.ts`**

```typescript
// supabase/functions/ingest_csv/parsers/detect-bank.ts
interface BankTemplate {
  bank_code: string;
  header_signature: string[];
}

export function detectBank(headerLine: string, templates: BankTemplate[]): string | null {
  const headerCols = headerLine.split(/[,;]/).map(c => c.trim().toLowerCase());
  for (const t of templates) {
    const sigLower = t.header_signature.map(s => s.toLowerCase());
    if (sigLower.every(sig => headerCols.some(col => col === sig))) {
      return t.bank_code;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/detect-bank.test.ts
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ingest_csv/
git commit -m "feat(importer): EF detect-bank module + tests"
```

---

## Task 5: EF — `csv-bank-template.ts` + `csv-generic.ts`

**Files:**
- Create: `supabase/functions/ingest_csv/parsers/csv-bank-template.ts`
- Create: `supabase/functions/ingest_csv/parsers/csv-generic.ts`
- Create: `supabase/functions/ingest_csv/__tests__/csv-bank-template.test.ts`
- Create: `supabase/functions/ingest_csv/__tests__/csv-generic.test.ts`
- Create: `supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv` (and other fixture files)

- [ ] **Step 1: Create anonymised fixture CSVs**

Create one minimal CSV per bank in `supabase/functions/ingest_csv/__tests__/fixtures/`. Each file needs ≥3 data rows with realistic but anonymised data. Example for Millennium BCP:

```
# supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv
Data movimento,Descrição,Débito,Crédito
01-01-2025,LIDL LISBOA,-25,50,
02-01-2025,SALARIO,,1500,00
03-01-2025,GALP COMBUSTIVEL,-40,00,
```

Create similar files: `santander_totta.csv`, `cgd.csv`, `novo_banco.csv`, `activobank.csv`, `montepio.csv`, `bpi.csv`.

- [ ] **Step 2: Write failing tests for `csv-bank-template.ts`**

```typescript
// supabase/functions/ingest_csv/__tests__/csv-bank-template.test.ts
import { describe, it, expect } from 'vitest';
import { parseCsvWithTemplate } from '../parsers/csv-bank-template.ts';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

const bcpMapping = {
  date_col: 'Data movimento',
  amount_col_debit: 'Débito',
  amount_col_credit: 'Crédito',
  description_col: 'Descrição',
  decimal_separator: ',',
  date_format: 'DD-MM-YYYY',
};

describe('parseCsvWithTemplate', () => {
  it('parses Millennium BCP fixture', () => {
    const rows = parseCsvWithTemplate(fixture('millennium_bcp.csv'), bcpMapping);
    expect(rows.length).toBe(3);
    expect(rows[0].date).toBe('2025-01-01');
    expect(rows[0].amount_cents).toBe(-2550);
    expect(rows[0].description).toBe('LIDL LISBOA');
    expect(rows[1].amount_cents).toBe(150000); // credit
  });

  it('normalises DD/MM/YYYY date format', () => {
    const csv = 'Data,Valor,Desc\n03/01/2025,-10,50,Test';
    const rows = parseCsvWithTemplate(csv, {
      date_col: 'Data', amount_col: 'Valor', description_col: 'Desc',
      decimal_separator: ',', date_format: 'DD/MM/YYYY',
    });
    expect(rows[0].date).toBe('2025-01-03');
  });

  it('normalises YYYYMMDD date format', () => {
    const csv = 'Data,Valor,Desc\n20250103,-1000,Test';
    const rows = parseCsvWithTemplate(csv, {
      date_col: 'Data', amount_col: 'Valor', description_col: 'Desc',
      decimal_separator: '.', date_format: 'YYYYMMDD',
    });
    expect(rows[0].date).toBe('2025-01-03');
    expect(rows[0].amount_cents).toBe(-100000);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/csv-bank-template.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement `csv-bank-template.ts`**

```typescript
// supabase/functions/ingest_csv/parsers/csv-bank-template.ts
import type { NormalizedRow } from '../types.ts';

interface TemplateMapping {
  date_col: string;
  amount_col?: string;
  amount_col_debit?: string;
  amount_col_credit?: string;
  description_col: string;
  counterparty_col?: string;
  decimal_separator?: string;
  date_format?: string;
}

function normalizeDate(raw: string, fmt?: string): string {
  const s = raw.trim();
  if (fmt === 'YYYYMMDD' || /^\d{8}$/.test(s)) {
    return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  }
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(s)) {
    const sep = s[2];
    const [d, m, y] = s.split(sep);
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(s)) {
    return s.replace(/\//g, '-');
  }
  return new Date(s).toISOString().slice(0, 10);
}

function parseCents(raw: string, decSep = ','): number {
  const cleaned = raw.trim().replace(/\s/g, '')
    .replace(decSep === ',' ? /\./g : /,/g, '')  // remove thousands sep
    .replace(decSep, '.');
  return Math.round(parseFloat(cleaned || '0') * 100);
}

function parseCsvLines(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const cols = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']));
  });
  return { headers, rows };
}

export function parseCsvWithTemplate(content: string, mapping: TemplateMapping): NormalizedRow[] {
  const { headers, rows } = parseCsvLines(content);
  const decSep = mapping.decimal_separator ?? ',';

  return rows
    .filter(r => Object.values(r).some(v => v.trim()))
    .map(r => {
      let amount_cents: number;
      if (mapping.amount_col_debit && mapping.amount_col_credit) {
        const debit  = parseCents(r[mapping.amount_col_debit]  ?? '0', decSep);
        const credit = parseCents(r[mapping.amount_col_credit] ?? '0', decSep);
        amount_cents = credit > 0 ? credit : -Math.abs(debit);
      } else {
        amount_cents = parseCents(r[mapping.amount_col!] ?? '0', decSep);
      }
      return {
        date: normalizeDate(r[mapping.date_col] ?? '', mapping.date_format),
        amount_cents,
        description: (r[mapping.description_col] ?? '').trim(),
        counterparty: mapping.counterparty_col ? r[mapping.counterparty_col] : undefined,
        raw_json: r,
      };
    });
}
```

- [ ] **Step 5: Write and implement `csv-generic.ts` (refactor of old parser)**

```typescript
// supabase/functions/ingest_csv/parsers/csv-generic.ts
import type { NormalizedRow } from '../types.ts';
import { parseCsvWithTemplate } from './csv-bank-template.ts';

interface ManualMapping {
  date: string;
  amount: string;
  description: string;
  decimal?: string;
  date_fmt?: string;
  debit_sign?: number;
}

export function parseCsvGeneric(content: string, mapping: ManualMapping): NormalizedRow[] {
  return parseCsvWithTemplate(content, {
    date_col: mapping.date,
    amount_col: mapping.amount,
    description_col: mapping.description,
    decimal_separator: mapping.decimal ?? ',',
    date_format: mapping.date_fmt,
  }).map(row => ({
    ...row,
    amount_cents: mapping.debit_sign
      ? row.amount_cents * mapping.debit_sign
      : row.amount_cents,
  }));
}
```

Write `csv-generic.test.ts`:

```typescript
// supabase/functions/ingest_csv/__tests__/csv-generic.test.ts
import { describe, it, expect } from 'vitest';
import { parseCsvGeneric } from '../parsers/csv-generic.ts';

describe('parseCsvGeneric', () => {
  it('parses semicolon-delimited CSV with manual mapping', () => {
    const csv = 'Data;Valor;Desc\n01-01-2025;-25,50;LIDL';
    const rows = parseCsvGeneric(csv, { date: 'Data', amount: 'Valor', description: 'Desc', decimal: ',' });
    expect(rows[0].date).toBe('2025-01-01');
    expect(rows[0].amount_cents).toBe(-2550);
  });

  it('applies debit_sign inversion', () => {
    const csv = 'Data,Valor,Desc\n01-01-2025,25.50,GALP';
    const rows = parseCsvGeneric(csv, { date: 'Data', amount: 'Valor', description: 'Desc', decimal: '.', debit_sign: -1 });
    expect(rows[0].amount_cents).toBe(-2550);
  });
});
```

- [ ] **Step 6: Run all parser tests**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/csv-bank-template.test.ts supabase/functions/ingest_csv/__tests__/csv-generic.test.ts
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ingest_csv/
git commit -m "feat(importer): EF CSV parsers (bank-template + generic) + fixtures"
```

---

## Task 6: EF — `ofx.ts`

**Files:**
- Create: `supabase/functions/ingest_csv/parsers/ofx.ts`
- Create: `supabase/functions/ingest_csv/__tests__/ofx.test.ts`
- Create: `supabase/functions/ingest_csv/__tests__/fixtures/sample.ofx`

- [ ] **Step 1: Create anonymised OFX fixture**

```
# supabase/functions/ingest_csv/__tests__/fixtures/sample.ofx
<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20250103
<TRNAMT>-25.50
<NAME>LIDL LISBOA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20250105
<TRNAMT>1500.00
<NAME>SALARIO
</STMTTRN>
</OFX>
```

- [ ] **Step 2: Write failing test**

```typescript
// supabase/functions/ingest_csv/__tests__/ofx.test.ts
import { describe, it, expect } from 'vitest';
import { parseOfx } from '../parsers/ofx.ts';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixture = readFileSync(join(__dirname, 'fixtures', 'sample.ofx'), 'utf-8');

describe('parseOfx', () => {
  it('parses OFX fixture into NormalizedRow[]', () => {
    const rows = parseOfx(fixture);
    expect(rows.length).toBe(2);
    expect(rows[0].date).toBe('2025-01-03');
    expect(rows[0].amount_cents).toBe(-2550);
    expect(rows[0].description).toBe('LIDL LISBOA');
    expect(rows[1].amount_cents).toBe(150000);
  });

  it('normalises YYYYMMDD dates', () => {
    const rows = parseOfx(fixture);
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/ofx.test.ts
```

- [ ] **Step 4: Implement `ofx.ts`**

Note: `ofx-js` may not be available in Deno natively — use a lightweight regex-based parser for the simple OFX format (SGML, not XML) used by PT banks. This avoids the npm dependency issue in Deno:

```typescript
// supabase/functions/ingest_csv/parsers/ofx.ts
import type { NormalizedRow } from '../types.ts';

function extractTagValue(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}>([^<\n\r]+)`, 'i'));
  return m ? m[1].trim() : '';
}

function ofxDateToIso(raw: string): string {
  const s = raw.slice(0, 8);
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

export function parseOfx(content: string): NormalizedRow[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1);
  return blocks.map(block => {
    const rawDate = extractTagValue(block, 'DTPOSTED');
    const rawAmt  = extractTagValue(block, 'TRNAMT');
    const name    = extractTagValue(block, 'NAME') || extractTagValue(block, 'MEMO');
    const amount  = parseFloat(rawAmt || '0');
    return {
      date: ofxDateToIso(rawDate),
      amount_cents: Math.round(amount * 100),
      description: name,
      raw_json: { DTPOSTED: rawDate, TRNAMT: rawAmt, NAME: name },
    };
  }).filter(r => r.date.length === 10);
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/ofx.test.ts
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ingest_csv/
git commit -m "feat(importer): EF OFX parser + fixture"
```

---

## Task 7: EF — `fuzzy-dedup.ts`

**Files:**
- Create: `supabase/functions/ingest_csv/dedup/fuzzy-dedup.ts`
- Create: `supabase/functions/ingest_csv/__tests__/fuzzy-dedup.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// supabase/functions/ingest_csv/__tests__/fuzzy-dedup.test.ts
import { describe, it, expect, vi } from 'vitest';
import { runFuzzyDedup } from '../dedup/fuzzy-dedup.ts';
import type { NormalizedRow } from '../types.ts';

const rows: NormalizedRow[] = [
  { date: '2025-01-01', amount_cents: -2550, description: 'LIDL LISBOA', raw_json: {} },
  { date: '2025-01-05', amount_cents: 150000, description: 'SALARIO', raw_json: {} },
  { date: '2025-01-02', amount_cents: -2550, description: 'LIDL LX', raw_json: {} },
];

describe('runFuzzyDedup', () => {
  it('marks exact duplicate', async () => {
    const mockRpc = vi.fn().mockResolvedValue([
      { row_index: 0, row_status: 'duplicate', matched_transaction_id: 'txn-1', matched_recurring_instance_id: null },
      { row_index: 1, row_status: 'ok', matched_transaction_id: null, matched_recurring_instance_id: null },
      { row_index: 2, row_status: 'probable_duplicate', matched_transaction_id: 'txn-2', matched_recurring_instance_id: null },
    ]);
    const result = await runFuzzyDedup(rows, 'account-1', mockRpc);
    expect(result[0].row_status).toBe('duplicate');
    expect(result[1].row_status).toBe('ok');
    expect(result[2].row_status).toBe('probable_duplicate');
  });

  it('marks matches_recurring', async () => {
    const mockRpc = vi.fn().mockResolvedValue([
      { row_index: 0, row_status: 'matches_recurring', matched_transaction_id: null, matched_recurring_instance_id: 'ri-1' },
    ]);
    const result = await runFuzzyDedup([rows[0]], 'account-1', mockRpc);
    expect(result[0].row_status).toBe('matches_recurring');
    expect(result[0].matched_recurring_instance_id).toBe('ri-1');
  });

  it('passes all rows as bulk JSON to RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue(
      rows.map((_, i) => ({ row_index: i, row_status: 'ok', matched_transaction_id: null, matched_recurring_instance_id: null }))
    );
    await runFuzzyDedup(rows, 'account-1', mockRpc);
    expect(mockRpc).toHaveBeenCalledOnce();
    const call = mockRpc.mock.calls[0][0];
    expect(call.p_rows).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/fuzzy-dedup.test.ts
```

- [ ] **Step 3: Implement `fuzzy-dedup.ts`**

```typescript
// supabase/functions/ingest_csv/dedup/fuzzy-dedup.ts
import type { NormalizedRow } from '../types.ts';

export interface DedupResult extends NormalizedRow {
  row_status: 'ok' | 'duplicate' | 'probable_duplicate' | 'matches_recurring';
  matched_transaction_id?: string | null;
  matched_recurring_instance_id?: string | null;
}

type RpcFn = (params: { p_account_id: string; p_rows: unknown[] }) => Promise<Array<{
  row_index: number;
  row_status: string;
  matched_transaction_id: string | null;
  matched_recurring_instance_id: string | null;
}>>;

export async function runFuzzyDedup(
  rows: NormalizedRow[],
  accountId: string,
  rpc: RpcFn
): Promise<DedupResult[]> {
  const payload = rows.map((r, i) => ({
    row_index: i,
    date: r.date,
    amount_cents: r.amount_cents,
    description: r.description,
  }));

  const results = await rpc({ p_account_id: accountId, p_rows: payload });
  const byIndex = new Map(results.map(r => [r.row_index, r]));

  return rows.map((row, i) => {
    const res = byIndex.get(i);
    return {
      ...row,
      row_status: (res?.row_status ?? 'ok') as DedupResult['row_status'],
      matched_transaction_id: res?.matched_transaction_id ?? null,
      matched_recurring_instance_id: res?.matched_recurring_instance_id ?? null,
    };
  });
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/fuzzy-dedup.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ingest_csv/
git commit -m "feat(importer): EF fuzzy-dedup module + tests"
```

---

## Task 8: EF — `apply-rules.ts`

**Files:**
- Create: `supabase/functions/ingest_csv/rules/apply-rules.ts`
- Create: `supabase/functions/ingest_csv/__tests__/apply-rules.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// supabase/functions/ingest_csv/__tests__/apply-rules.test.ts
import { describe, it, expect } from 'vitest';
import { applyRules } from '../rules/apply-rules.ts';
import type { NormalizedRow } from '../types.ts';

const rows: NormalizedRow[] = [
  { date: '2025-01-01', amount_cents: -2550, description: 'LIDL LISBOA', raw_json: {} },
  { date: '2025-01-02', amount_cents: -4000, description: 'GALP COMBUSTIVEL', raw_json: {} },
  { date: '2025-01-03', amount_cents: -9999, description: 'SOME UNKNOWN MERCHANT', raw_json: {} },
];

const rules = [
  { id: 'u-1', priority: 100, match_field: 'description', match_type: 'contains', pattern: 'LIDL', category_id: 'cat-super', scope: 'user' },
  { id: 's-1', priority: 1000, match_field: 'description', match_type: 'contains', pattern: 'LIDL', category_id: 'cat-super-seed', scope: 'system_seed' },
  { id: 's-2', priority: 1000, match_field: 'description', match_type: 'contains', pattern: 'GALP', category_id: 'cat-fuel', scope: 'system_seed' },
];

describe('applyRules', () => {
  it('applies first matching rule (priority order, user before seed)', () => {
    const result = applyRules(rows, rules as any);
    expect(result[0].category_id).toBe('cat-super'); // user rule wins
    expect(result[0].applied_rule_id).toBe('u-1');
  });

  it('applies system_seed rule when no user rule matches', () => {
    const result = applyRules(rows, rules as any);
    expect(result[1].category_id).toBe('cat-fuel');
    expect(result[1].applied_rule_id).toBe('s-2');
  });

  it('leaves unmatched rows without category', () => {
    const result = applyRules(rows, rules as any);
    expect(result[2].category_id).toBeUndefined();
    expect(result[2].applied_rule_id).toBeUndefined();
  });

  it('matches regex rules', () => {
    const regexRule = [{
      id: 'r-1', priority: 50, match_field: 'description',
      match_type: 'regex', pattern: '^GALP', category_id: 'cat-fuel-r', scope: 'user'
    }];
    const result = applyRules([rows[1]], regexRule as any);
    expect(result[0].category_id).toBe('cat-fuel-r');
  });

  it('matches amount_range rules', () => {
    const rangeRule = [{
      id: 'rng-1', priority: 50, match_field: 'amount_range',
      match_type: 'range', pattern: '-5000,-2000', category_id: 'cat-range', scope: 'user'
    }];
    const result = applyRules([rows[0]], rangeRule as any);
    expect(result[0].category_id).toBe('cat-range');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/apply-rules.test.ts
```

- [ ] **Step 3: Implement `apply-rules.ts`**

```typescript
// supabase/functions/ingest_csv/rules/apply-rules.ts
import type { NormalizedRow } from '../types.ts';

interface Rule {
  id: string;
  priority: number;
  match_field: 'description' | 'counterparty' | 'amount_range';
  match_type: 'contains' | 'starts_with' | 'equals' | 'regex' | 'range';
  pattern: string;
  category_id: string;
}

export interface RuledRow extends NormalizedRow {
  category_id?: string;
  applied_rule_id?: string;
}

function matches(row: NormalizedRow, rule: Rule): boolean {
  const field = rule.match_field === 'amount_range'
    ? String(row.amount_cents)
    : (rule.match_field === 'counterparty' ? row.counterparty ?? '' : row.description);

  switch (rule.match_type) {
    case 'contains':
      return field.toLowerCase().includes(rule.pattern.toLowerCase());
    case 'starts_with':
      return field.toLowerCase().startsWith(rule.pattern.toLowerCase());
    case 'equals':
      return field.toLowerCase() === rule.pattern.toLowerCase();
    case 'regex':
      return new RegExp(rule.pattern, 'i').test(field);
    case 'range': {
      const [min, max] = rule.pattern.split(',').map(Number);
      const cents = row.amount_cents;
      return cents >= min && cents <= max;
    }
    default:
      return false;
  }
}

export function applyRules(rows: NormalizedRow[], rules: Rule[]): RuledRow[] {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  return rows.map(row => {
    for (const rule of sorted) {
      if (matches(row, rule)) {
        return { ...row, category_id: rule.category_id, applied_rule_id: rule.id };
      }
    }
    return { ...row };
  });
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/apply-rules.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Check overall EF test coverage**

```bash
npx vitest run supabase/functions/ingest_csv/__tests__/ --coverage
```

Expected: ≥80% on parsers, dedup, rules modules.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/ingest_csv/
git commit -m "feat(importer): EF apply-rules module + tests (≥80% coverage)"
```

---

## Task 9: EF — `index.ts` Pipeline Orchestrator (Rewrite)

**Files:**
- Modify: `supabase/functions/ingest_csv/index.ts` (full rewrite)

- [ ] **Step 1: Rewrite `index.ts`**

```typescript
// supabase/functions/ingest_csv/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { detectFormat }        from './parsers/detect-format.ts';
import { detectBank }          from './parsers/detect-bank.ts';
import { parseCsvWithTemplate } from './parsers/csv-bank-template.ts';
import { parseCsvGeneric }     from './parsers/csv-generic.ts';
import { parseOfx }            from './parsers/ofx.ts';
import { runFuzzyDedup }       from './dedup/fuzzy-dedup.ts';
import { applyRules }          from './rules/apply-rules.ts';

declare const Deno: any;

const MAX_ROWS = 5000;

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader  = req.headers.get('Authorization') || '';
  const restHeaders = { apikey: anonKey, Authorization: authHeader, 'Content-Type': 'application/json' };

  const body       = await req.json().catch(() => ({})) as Record<string, unknown>;
  const fileId     = body.file_id as string;
  const accountId  = body.account_id as string;
  const manualMap  = body.mapping as Record<string, string> | undefined;

  if (!fileId || !accountId) return json({ error: 'missing file_id or account_id' }, 400, req);

  try {
    // 1. Fetch file record
    const fileRes  = await fetch(`${supabaseUrl}/rest/v1/ingestion_files?id=eq.${fileId}&select=storage_bucket,storage_path`, { headers: restHeaders });
    const [fileRow] = await fileRes.json();
    if (!fileRow) return json({ error: 'file not found' }, 404, req);

    // 2. Download content from Storage
    const storagePath = fileRow.storage_path.startsWith('imports/')
      ? fileRow.storage_path
      : `imports/${fileRow.storage_path}`;
    const objUrl  = `${supabaseUrl}/storage/v1/object/${fileRow.storage_bucket}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
    const objRes  = await fetch(objUrl, { headers: { apikey: anonKey, Authorization: authHeader } });
    if (!objRes.ok) return json({ error: 'failed to download file' }, 500, req);
    const content = await objRes.text();

    const filename = fileRow.storage_path.split('/').pop() ?? '';

    // 3. Detect format
    const fmt = detectFormat(content, filename);
    if (fmt.format === 'unknown' && !manualMap) return json({ error: 'unknown format — provide manual mapping' }, 400, req);

    // 4. Parse
    let rawRows;
    let detectedBank: string | null = null;

    if (fmt.format === 'ofx') {
      rawRows = parseOfx(content);
    } else {
      // Fetch bank templates
      const tplRes  = await fetch(`${supabaseUrl}/rest/v1/bank_templates?active=eq.true&select=*`, { headers: restHeaders });
      const templates = await tplRes.json();

      const headerLine = content.split(/\r?\n/)[0] ?? '';
      detectedBank = detectBank(headerLine, templates);

      if (detectedBank) {
        const tpl = templates.find((t: any) => t.bank_code === detectedBank);
        rawRows = parseCsvWithTemplate(content, tpl.mapping);
      } else if (manualMap) {
        rawRows = parseCsvGeneric(content, manualMap as any);
      } else {
        return json({ error: 'unrecognised bank — provide manual mapping', detected_format: 'csv' }, 400, req);
      }
    }

    // 5. Line cap
    if (rawRows.length > MAX_ROWS) {
      return json({ error: `Ficheiro demasiado grande (máx. ${MAX_ROWS} linhas). Suporte para ficheiros maiores em breve.` }, 422, req);
    }

    // 6. Fuzzy dedup (bulk RPC)
    const rpcFn = async (params: { p_account_id: string; p_rows: unknown[] }) => {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/bulk_fuzzy_dedup`, {
        method: 'POST', headers: restHeaders,
        body: JSON.stringify(params),
      });
      return r.json();
    };
    const dedupedRows = await runFuzzyDedup(rawRows, accountId, rpcFn);

    // 7. Apply categorisation rules (only ok + probable_duplicate rows)
    const rulesRes  = await fetch(`${supabaseUrl}/rest/v1/import_categorization_rules?active=eq.true&order=priority.asc`, { headers: restHeaders });
    const rules     = await rulesRes.json();
    const ruledRows = applyRules(dedupedRows, rules);

    // 8. Upsert staging_transactions in batches of 100
    const BATCH = 100;
    let ok = 0, errors = 0, dups = 0, recurring = 0;

    for (let i = 0; i < ruledRows.length; i += BATCH) {
      const batch = ruledRows.slice(i, i + BATCH).map((r: any, j: number) => ({
        file_id: fileId,
        account_id: accountId,
        row_index: i + j + 1,
        date: r.date,
        amount_cents: r.amount_cents,
        description: r.description,
        raw_json: r.raw_json,
        row_status: r.row_status ?? 'ok',
        category_id: r.category_id ?? null,
        applied_rule_id: r.applied_rule_id ?? null,
        matched_recurring_instance_id: r.matched_recurring_instance_id ?? null,
      }));

      const ins = await fetch(`${supabaseUrl}/rest/v1/staging_transactions`, {
        method: 'POST',
        headers: { ...restHeaders, Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify(batch),
      });
      if (!ins.ok) {
        const msg = await ins.text();
        return json({ error: 'staging upsert failed', detail: msg }, 500, req);
      }

      for (const r of batch) {
        if (r.row_status === 'duplicate') dups++;
        else if (r.row_status === 'matches_recurring') recurring++;
        else if (r.row_status === 'error') errors++;
        else ok++;
      }
    }

    // 9. Update ingestion_files with stats + detected info
    await fetch(`${supabaseUrl}/rest/v1/ingestion_files?id=eq.${fileId}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify({
        detected_format: fmt.format,
        detected_bank: detectedBank,
        total_rows: ruledRows.length,
        ok_rows: ok,
        error_rows: errors,
        duplicate_rows: dups,
        matched_recurring_rows: recurring,
        status: 'ready',
      }),
    });

    return json({ ok: true, total: ruledRows.length, ok_rows: ok, duplicate_rows: dups, matched_recurring_rows: recurring, detected_bank: detectedBank }, 200, req);
  } catch (e) {
    return json({ error: String(e) }, 500, req);
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles (Deno check)**

```bash
deno check supabase/functions/ingest_csv/index.ts
```

Expected: no errors (or acceptable Deno-specific type warnings only).

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ingest_csv/index.ts
git commit -m "feat(importer): EF ingest_csv pipeline orchestrator (rewrite)"
```

---

## Task 10: UI — `RowStatusBadge.tsx` + `useImportJob.ts` + `useStagingRows.ts`

**Files:**
- Create: `src/features/importer/components/RowStatusBadge.tsx`
- Create: `src/features/importer/hooks/useImportJob.ts`
- Create: `src/features/importer/hooks/useStagingRows.ts`

- [ ] **Step 1: Create `RowStatusBadge.tsx`**

```tsx
// src/features/importer/components/RowStatusBadge.tsx
import { Badge } from '@/components/ui/badge';

type RowStatus = 'ok' | 'warning' | 'error' | 'duplicate' | 'probable_duplicate' | 'matches_recurring';

const config: Record<RowStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' | 'purple'; className: string }> = {
  ok:                 { label: 'ok',                 variant: 'default',     className: 'bg-green-500 text-white' },
  warning:            { label: 'aviso',              variant: 'outline',     className: 'border-yellow-400 text-yellow-700' },
  error:              { label: 'erro',               variant: 'destructive', className: '' },
  duplicate:          { label: 'duplicado',          variant: 'secondary',   className: 'bg-gray-300 text-gray-700' },
  probable_duplicate: { label: 'provável duplicado', variant: 'outline',     className: 'border-yellow-500 text-yellow-700' },
  matches_recurring:  { label: 'corresponde recorrente', variant: 'secondary', className: 'bg-purple-100 text-purple-800' },
};

export function RowStatusBadge({ status, appliedRuleId }: { status: RowStatus; appliedRuleId?: string | null }) {
  const c = config[status] ?? config.ok;
  const isAuto = status === 'ok' && !!appliedRuleId;

  if (isAuto) {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-300">
        auto ⚡
      </Badge>
    );
  }
  return <Badge className={c.className}>{c.label}</Badge>;
}
```

- [ ] **Step 2: Create `useImportJob.ts`**

```typescript
// src/features/importer/hooks/useImportJob.ts
import { useQuery } from '@tanstack/react-query';
import { fetchIngestionFile } from '@/services/importer';

export function useImportJob(fileId: string | null) {
  return useQuery({
    queryKey: ['ingestion_file', fileId],
    queryFn: () => fetchIngestionFile(fileId!).then(r => r.data),
    enabled: !!fileId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'ready' || status === 'error' ? false : 1000;
    },
  });
}
```

- [ ] **Step 3: Create `useStagingRows.ts`**

```typescript
// src/features/importer/hooks/useStagingRows.ts
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
```

- [ ] **Step 4: Commit**

```bash
git add src/features/importer/
git commit -m "feat(importer): RowStatusBadge + useImportJob + useStagingRows hooks"
```

---

## Task 11: UI — `CategoryCell.tsx` + `CreateRuleModal.tsx`

**Files:**
- Create: `src/features/importer/components/CategoryCell.tsx`
- Create: `src/features/importer/components/CreateRuleModal.tsx`

- [ ] **Step 1: Create `CategoryCell.tsx`**

```tsx
// src/features/importer/components/CategoryCell.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';

interface Category { id: string; name: string; }
interface Rule { id: string; pattern: string; }

interface Props {
  categoryId?: string | null;
  appliedRule?: Rule | null;
  categories: Category[];
  onChange: (categoryId: string) => void;
  onCreateRule: () => void;
}

export function CategoryCell({ categoryId, appliedRule, categories, onChange, onCreateRule }: Props) {
  return (
    <div className="flex items-center gap-1">
      <Select value={categoryId ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-7 text-xs w-36">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {categories.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {appliedRule && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Zap className="h-3 w-3 text-blue-500 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>Regra: {appliedRule.pattern}</TooltipContent>
        </Tooltip>
      )}
      <Button variant="ghost" size="xs" className="text-xs text-muted-foreground" onClick={onCreateRule}>
        + Regra
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `CreateRuleModal.tsx`**

```tsx
// src/features/importer/components/CreateRuleModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { createRule } from '@/services/importer';
import { useAuth } from '@/contexts/AuthContext';
import { useScope } from '@/features/scope';

interface Category { id: string; name: string; }
interface Props {
  open: boolean;
  onClose: () => void;
  prefillPattern?: string;
  prefillCategoryId?: string;
  categories: Category[];
}

export function CreateRuleModal({ open, onClose, prefillPattern, prefillCategoryId, categories }: Props) {
  const { user } = useAuth();
  const { scope, familyId } = useScope();
  const [pattern, setPattern]     = useState(prefillPattern ?? '');
  const [categoryId, setCategoryId] = useState(prefillCategoryId ?? '');
  const [saving, setSaving]       = useState(false);

  async function handleSave() {
    if (!pattern || !categoryId) return;
    setSaving(true);
    await createRule({
      user_id: scope === 'personal' ? user!.id : undefined,
      family_id: scope === 'family' ? familyId ?? undefined : undefined,
      scope: scope === 'family' ? 'family' : 'user',
      match_field: 'description',
      match_type: 'contains',
      pattern,
      category_id: categoryId,
    });
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar regra de categorização</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Padrão (contém)</Label>
            <Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="ex: LIDL" />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving || !pattern || !categoryId}>
            {saving ? 'A guardar…' : 'Guardar regra'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/importer/components/
git commit -m "feat(importer): CategoryCell + CreateRuleModal components"
```

---

## Task 12: UI — `RecurringMatchExpander.tsx` + `StagingTable.tsx` (rewrite)

**Files:**
- Create: `src/features/importer/components/RecurringMatchExpander.tsx`
- Modify: `src/features/importer/StagingTable.tsx` (full rewrite)

- [ ] **Step 1: Create `RecurringMatchExpander.tsx`**

```tsx
// src/features/importer/components/RecurringMatchExpander.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { formatCurrency } from '@/lib/formatters';

export function RecurringMatchExpander({ instanceId }: { instanceId: string }) {
  const { data } = useQuery({
    queryKey: ['recurring_instance', instanceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recurring_instances')
        .select('*, recurring_transactions(description, amount_cents)')
        .eq('id', instanceId)
        .single();
      return data;
    },
  });

  if (!data) return null;
  const desc = data.recurring_transactions?.description ?? '—';
  const amt  = data.recurring_transactions?.amount_cents ?? 0;

  return (
    <div className="px-4 py-2 bg-purple-50 text-xs text-purple-800 rounded">
      Corresponde a recorrente: <strong>{desc}</strong> ({formatCurrency(amt / 100)}) — será confirmada ao importar.
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `StagingTable.tsx`**

```tsx
// src/features/importer/StagingTable.tsx
import React, { useState } from 'react';
import { RowStatusBadge } from './components/RowStatusBadge';
import { CategoryCell } from './components/CategoryCell';
import { RecurringMatchExpander } from './components/RecurringMatchExpander';
import { CreateRuleModal } from './components/CreateRuleModal';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategoriesDomain } from '@/hooks/useCategoriesQuery';
import { useUpdateStagingRow } from './hooks/useStagingRows';
import { formatCurrency } from '@/lib/formatters';

type Row = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  row_status: string;
  category_id?: string | null;
  applied_rule_id?: string | null;
  matched_recurring_instance_id?: string | null;
};

interface Props {
  fileId: string;
  rows: Row[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}

export default function StagingTable({ fileId, rows, selectedIds, onSelect, onSelectAll }: Props) {
  const { data: categories = [] } = useCategoriesDomain();
  const updateRow = useUpdateStagingRow(fileId);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [ruleModalRow, setRuleModalRow] = useState<Row | null>(null);

  const defaultSelected = (row: Row) =>
    row.row_status !== 'duplicate' && row.row_status !== 'error';

  return (
    <>
      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left">
              <th className="p-2 w-8">
                <Checkbox
                  checked={rows.filter(defaultSelected).every(r => selectedIds.has(r.id))}
                  onCheckedChange={(c) => onSelectAll(!!c)}
                />
              </th>
              <th className="p-2">Data</th>
              <th className="p-2">Descrição</th>
              <th className="p-2 text-right">Montante</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <React.Fragment key={row.id}>
                <tr
                  className={`border-t hover:bg-muted/50 ${row.row_status === 'duplicate' ? 'opacity-50' : ''}`}
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                >
                  <td className="p-2" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      disabled={row.row_status === 'duplicate' || row.row_status === 'error'}
                      onCheckedChange={(c) => onSelect(row.id, !!c)}
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap">{row.date}</td>
                  <td className="p-2 max-w-xs truncate">{row.description}</td>
                  <td className={`p-2 text-right tabular-nums ${row.amount_cents < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(row.amount_cents / 100)}
                  </td>
                  <td className="p-2" onClick={e => e.stopPropagation()}>
                    <CategoryCell
                      categoryId={row.category_id}
                      appliedRule={row.applied_rule_id ? { id: row.applied_rule_id, pattern: '' } : null}
                      categories={categories}
                      onChange={(catId) => updateRow.mutate({ id: row.id, patch: { category_id: catId } })}
                      onCreateRule={() => setRuleModalRow(row)}
                    />
                  </td>
                  <td className="p-2">
                    <RowStatusBadge status={row.row_status as any} appliedRuleId={row.applied_rule_id} />
                  </td>
                </tr>
                {expandedId === row.id && row.matched_recurring_instance_id && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <RecurringMatchExpander instanceId={row.matched_recurring_instance_id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {ruleModalRow && (
        <CreateRuleModal
          open
          onClose={() => setRuleModalRow(null)}
          prefillPattern={ruleModalRow.description.split(' ')[0]}
          prefillCategoryId={ruleModalRow.category_id ?? undefined}
          categories={categories}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/importer/
git commit -m "feat(importer): StagingTable rewrite + RecurringMatchExpander"
```

---

## Task 13: UI — `usePostStaging.ts` + `UploadStep.tsx` + `ImportPage.tsx`

**Files:**
- Create: `src/features/importer/hooks/usePostStaging.ts`
- Create: `src/features/importer/UploadStep.tsx`
- Create: `src/features/importer/ImportPage.tsx`

- [ ] **Step 1: Create `usePostStaging.ts`**

```typescript
// src/features/importer/hooks/usePostStaging.ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

interface PostParams {
  selectedRows: Array<{
    id: string;
    date: string;
    amount_cents: number;
    description: string;
    category_id?: string | null;
    matched_recurring_instance_id?: string | null;
    account_id: string;
  }>;
}

export function usePostStaging() {
  return useMutation({
    mutationFn: async ({ selectedRows }: PostParams) => {
      const created: string[] = [];

      for (const row of selectedRows) {
        if (row.matched_recurring_instance_id) {
          // Confirm recurring instance — returns { transaction_id }
          const { data, error } = await supabase.rpc('confirm_recurring_instance', {
            p_instance_id: row.matched_recurring_instance_id,
          });
          if (error) throw error;
          created.push(data.transaction_id);
        } else {
          // Insert new transaction
          const { data, error } = await supabase
            .from('transactions')
            .insert({
              date: row.date,
              amount_cents: row.amount_cents,
              description: row.description,
              category_id: row.category_id ?? null,
              account_id: row.account_id,
              source: 'import',
            })
            .select('id')
            .single();
          if (error) throw error;
          created.push(data.id);
        }
      }
      return created;
    },
  });
}
```

- [ ] **Step 2: Create `UploadStep.tsx`**

```tsx
// src/features/importer/UploadStep.tsx
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAccountsDomain } from '@/hooks/useAccountsQuery';
import { useScope } from '@/features/scope';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { createIngestionFile, invokeIngestCSV, fetchBankTemplates } from '@/services/importer';

// Client-side sniff (first 3 lines) — mirrors EF detect-format logic
// Returns e.g. "CSV — Millennium BCP detectado" / "OFX" / "Formato desconhecido — mapeamento manual"
function sniffFile(content: string, filename: string, templates: Array<{ bank_code: string; header_signature: string[] }>): string {
  const first3 = content.split(/\r?\n/).slice(0, 3).join('\n');
  if (filename.toLowerCase().endsWith('.ofx') || first3.trimStart().startsWith('<OFX>')) return 'OFX';
  // Sniff CSV
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
  const { scope, familyId } = useScope();
  const { data: accounts = [] } = useAccountsDomain();
  const [accountId, setAccountId] = useState('');
  const [sniffLabel, setSniffLabel] = useState<string | null>(null);
  const [file, setFile]           = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

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
      // Upload to Storage
      const path = `imports/${user!.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('imports').upload(path, file);
      if (upErr) throw upErr;

      // Create ingestion_file record
      const { data: fileRow, error: dbErr } = await createIngestionFile({
        user_id: user!.id,
        family_id: scope === 'family' ? familyId ?? null : null,
        scope,
        storage_bucket: 'imports',
        storage_path: path,
        account_id: accountId,
      });
      if (dbErr) throw dbErr;

      // Trigger EF
      await invokeIngestCSV(fileRow.id, accountId);
      onFileReady(fileRow.id, accountId);
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
            {accounts.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
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
```


- [ ] **Step 3: Create `ImportPage.tsx`**

```tsx
// src/features/importer/ImportPage.tsx
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

type Step = 'upload' | 'review' | 'done';

export default function ImportPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep]           = useState<Step>('upload');
  const [fileId, setFileId]       = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: job } = useImportJob(fileId);
  const { data: rows = [] } = useStagingRows(fileId);
  const postStaging = usePostStaging();

  function handleFileReady(fid: string, aid: string) {
    setFileId(fid);
    setAccountId(aid);
    setStep('review');
    // Pre-select all selectable rows
    setSelectedIds(new Set(
      rows
        .filter(r => r.row_status !== 'duplicate' && r.row_status !== 'error')
        .map(r => r.id)
    ));
  }

  // Re-sync selection when rows load
  function initSelection(loadedRows: typeof rows) {
    setSelectedIds(new Set(
      loadedRows
        .filter(r => r.row_status !== 'duplicate' && r.row_status !== 'error')
        .map(r => r.id)
    ));
  }

  const selectedRows = rows.filter(r => selectedIds.has(r.id)).map(r => ({ ...r, account_id: accountId }));
  const progress = job?.total_rows ? Math.round(((job.ok_rows ?? 0) + (job.duplicate_rows ?? 0) + (job.error_rows ?? 0)) / job.total_rows * 100) : null;

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

      {step === 'upload' && (
        <UploadStep onFileReady={handleFileReady} />
      )}

      {step === 'review' && (
        <div className="space-y-4">
          {job?.status !== 'ready' && progress !== null && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">A processar…</p>
              <Progress value={progress} />
            </div>
          )}

          {job?.status === 'ready' && (
            <>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {job.total_rows} linhas · {job.ok_rows} ok · {job.duplicate_rows} duplicados · {job.matched_recurring_rows} recorrentes
                </div>
                <Button onClick={handlePost} disabled={selectedRows.length === 0 || postStaging.isPending}>
                  {postStaging.isPending ? 'A importar…' : `Importar ${selectedRows.length} transações`}
                </Button>
              </div>

              <StagingTable
                fileId={fileId!}
                rows={rows}
                selectedIds={selectedIds}
                onSelect={(id, checked) => {
                  const next = new Set(selectedIds);
                  checked ? next.add(id) : next.delete(id);
                  setSelectedIds(next);
                }}
                onSelectAll={(checked) => {
                  if (checked) {
                    initSelection(rows);
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/importer/
git commit -m "feat(importer): ImportPage + UploadStep + usePostStaging"
```

---

## Task 14: Route Wiring + Legacy Redirects

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `/app/import` route + legacy redirects in `src/App.tsx`**

Add near the top with other lazy imports:

```typescript
const ImportPage = lazy(() => import('./features/importer/ImportPage'));
```

Inside the `<Routes>` block under the authenticated `/app` section, add:

```tsx
<Route path="import" element={<ImportPage />} />
```

Replace (or add alongside) the legacy routes:

```tsx
<Route path="/personal/importar" element={<Navigate to="/app/import" replace />} />
<Route path="/family/importar"   element={<Navigate to="/app/import" replace />} />
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(importer): add /app/import route + redirect legacy /personal/importar and /family/importar"
```

---

## Task 15: Playwright E2E Tests

**Files:**
- Create: `e2e/importer.spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
// e2e/importer.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Importer', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes test user is pre-authenticated via storage state
    await page.goto('/app/import');
  });

  test('Upload Millennium BCP CSV → bank detected → auto-categories → post → transaction in /app/transacoes', async ({ page }) => {
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv');
    await page.setInputFiles('#file-input', filePath);
    await expect(page.getByText('CSV')).toBeVisible();

    // Select account
    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/a processar/i)).toBeVisible();
    await expect(page.getByText(/ok/i)).toBeVisible({ timeout: 15000 });

    // At least one auto ⚡ badge
    await expect(page.getByText('auto ⚡').first()).toBeVisible();

    // Import
    await page.getByRole('button', { name: /importar/i }).click();
    await page.waitForURL('/app/transacoes');
    await expect(page.getByText('LIDL LISBOA')).toBeVisible();
  });

  test('Upload OFX → staging ready → post OK', async ({ page }) => {
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/sample.ofx');
    await page.setInputFiles('#file-input', filePath);
    await expect(page.getByText('OFX')).toBeVisible();

    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/ok/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /importar/i }).click();
    await page.waitForURL('/app/transacoes');
  });

  test('File with duplicates → duplicate rows deselected + counts correct', async ({ page }) => {
    // Use a CSV that matches existing transactions — relies on test DB seeded data
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv');
    await page.setInputFiles('#file-input', filePath);
    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/duplicados/i)).toBeVisible({ timeout: 15000 });

    // Duplicate row checkboxes should be disabled
    const dupRows = page.locator('tr').filter({ hasText: 'duplicado' });
    await expect(dupRows.locator('input[type=checkbox]').first()).toBeDisabled();
  });

  test('File with recurring match → recurring instance confirmed (not duplicated)', async ({ page }) => {
    // Requires test DB to have a pending recurring_instance matching the fixture row
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv');
    await page.setInputFiles('#file-input', filePath);
    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/recorrente/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /importar/i }).click();
    await page.waitForURL('/app/transacoes');
    // Only one transaction for the recurring row (not a duplicate)
    const matches = await page.getByText('LIDL LISBOA').count();
    expect(matches).toBe(1);
  });
});
```

- [ ] **Step 2: Run E2E suite**

```bash
npx playwright test e2e/importer.spec.ts
```

Expected: 4 passing (adjust fixture/seed data as needed for duplicate + recurring tests).

- [ ] **Step 3: Commit**

```bash
git add e2e/importer.spec.ts
git commit -m "test(importer): Playwright E2E — 4 import scenarios"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Full Vitest suite**

```bash
npx vitest run
```

Expected: all passing, ≥80% coverage on EF modules.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm run dev`

1. Navigate to `/app/import`
2. Upload a Millennium BCP CSV → verify badge `CSV — MILLENNIUM_BCP detectado`
3. Select an account → click Processar → verify progress bar → staging table appears
4. Verify `auto ⚡` badges on LIDL/GALP rows
5. Click "Importar N transações" → verify redirect to `/app/transacoes` with transactions
6. Navigate to `/personal/importar` → verify redirect to `/app/import`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(importer): Unit 14a — production importer (7 banks, auto-detect, dedup, rules, /app/import)"
```

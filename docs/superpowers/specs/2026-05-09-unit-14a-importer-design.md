# Unit 14a — Importer Design Spec

**Date:** 2026-05-09
**Status:** Approved
**Depends on:** Units 1, 2, 5, 6, 9, 13 (all merged)
**Deferred to 14b/15:** Background jobs (>5000 lines), import history page, retention cron 180d

---

## 1. Goal

Replace the existing 40%-functional importer with a production-ready import pipeline for FamilyFlowFinance. Covers:
- Pre-configured templates for 7 PT banks (Millennium BCP, Santander Totta, CGD, Novo Banco, ActivoBank, Montepio, BPI) in CSV + OFX support
- Auto-detection of format and bank
- Fuzzy dedup against `transactions` AND `recurring_instances` (closes Unit 9 integration)
- Rules engine with ~30 PT system seeds (auto-categorisation)
- Redesigned staging table with per-row status badges
- Unified `/app/import` route (scope-aware, removes `/personal/importar` + `/family/importar`)
- Removal of OCR stub (`ingest_receipt` EF + `GCV_KEY`/`GCV_ENDPOINT`)

**Not in scope (14b/15):** background jobs for files >5000 lines, import history page, retention policy UI.

---

## 2. Architecture

### Flow

```
Upload (client) → bucket imports/ → ingest_csv EF (rewrite)
  1. detect-format  → 'csv' | 'ofx' | 'unknown'
  2. detect-bank    → bank_code | null  (CSV only)
  3. parse          → NormalizedRow[]
       csv + bank_code  → csv-bank-template  (applies bank_templates.mapping)
       csv no template  → csv-generic        (manual mapping fallback)
       ofx              → ofx parser         (ofx-js)
  4. fuzzy-dedup    → row_status per row
  5. apply-rules    → category_id + applied_rule_id per row
  6. upsert staging_transactions (batches of 100)
  7. UPDATE ingestion_files (counts, detected_format, detected_bank)
→ client polls ingestion_files → staging table review
→ user posts → transactions (+ marks recurring_instances posted)
```

**Cap for 14a:** 5000 lines. Above this limit the EF returns a clear error: `"Ficheiro demasiado grande (máx. 5000 linhas). Suporte para ficheiros maiores em breve."`.

### Processing location

- **Client-side only:** file upload to bucket, format/bank sniff for instant badge feedback (first 3 lines), staging table review UI, post action
- **Edge Function `ingest_csv` (rewrite):** full parse + dedup + rules + upsert to staging
- Manual mapping (`MappingForm.tsx`) remains as fallback for unrecognised CSV formats

---

## 3. Data Model

### New table: `bank_templates`

```sql
CREATE TABLE bank_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_code       text NOT NULL UNIQUE,  -- 'MILLENNIUM_BCP' | 'SANTANDER_TOTTA' | 'CGD' | 'NOVO_BANCO' | 'ACTIVOBANK' | 'MONTEPIO' | 'BPI'
  format          text NOT NULL CHECK (format IN ('csv', 'ofx')),
  header_signature text[] NOT NULL,      -- canonical strings to match against CSV header row
  mapping         jsonb NOT NULL,        -- { date_col, amount_col, description_col, debit_sign, decimal_separator, date_format, encoding }
  locale          text NOT NULL DEFAULT 'pt-PT',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

Seed: 7 rows (Millennium BCP, Santander Totta, CGD, Novo Banco, ActivoBank, Montepio, BPI).

RLS: authenticated SELECT only. No user-facing INSERT/UPDATE (managed via migrations).

### New table: `import_categorization_rules`

```sql
CREATE TABLE import_categorization_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users,
  family_id    uuid REFERENCES families,
  scope        text NOT NULL CHECK (scope IN ('user', 'family', 'system_seed')),
  priority     smallint NOT NULL DEFAULT 100,
  match_field  text NOT NULL CHECK (match_field IN ('description', 'counterparty', 'amount_range')),
  match_type   text NOT NULL CHECK (match_type IN ('contains', 'regex', 'equals', 'starts_with', 'range')),
  pattern      text NOT NULL,
  category_id  uuid NOT NULL REFERENCES categories,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

Seed: ~30 `system_seed` rules (priority=1000, user_id=NULL, family_id=NULL):

| Pattern (contains, case-insensitive) | Category |
|---|---|
| LIDL, PINGO DOCE, CONTINENTE, AUCHAN, JUMBO, INTERMARCHE | Supermercado |
| GALP, BP, REPSOL, CEPSA | Combustível |
| NOS , MEO , VODAFONE, NOWO | Telecomunicações |
| EDP, GALP GAS, GOLD ENERGY | Energia |
| FARMACIA, FARMÁCIA | Saúde |
| MB WAY | Transferência |
| LEVANTAMENTO, CAIXA AUTOMATICA | Levantamento |
| COMISSAO, TAXA BANCARIA | Despesas Bancárias |
| IUC, IMI, IRS, SEG SOCIAL | Impostos |
| CTT | Serviços Postais |
| UBER, BOLT | Transportes |
| NETFLIX, SPOTIFY, HBO, DISNEY | Subscrições |
| RESTAURANTE, PASTELARIA, CAFE, SNACK | Restauração |
| ZARA, H&M, PRIMARK, PULL AND BEAR | Vestuário |
| AMAZON, FNAC, WORTEN | Compras Online |

RLS: SELECT for authenticated (sees system_seed + own user/family). INSERT/UPDATE/DELETE scoped to own `user_id` or `family_id`.

### Additive changes: `staging_transactions`

```sql
ALTER TABLE staging_transactions
  ADD COLUMN IF NOT EXISTS row_status text
    NOT NULL DEFAULT 'ok'
    CHECK (row_status IN ('ok','warning','error','duplicate','probable_duplicate','matches_recurring')),
  ADD COLUMN IF NOT EXISTS error_detail text,
  ADD COLUMN IF NOT EXISTS matched_recurring_instance_id uuid REFERENCES recurring_instances(id),
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories,
  ADD COLUMN IF NOT EXISTS applied_rule_id uuid REFERENCES import_categorization_rules(id);
```

### Additive changes: `ingestion_files`

```sql
ALTER TABLE ingestion_files
  ADD COLUMN IF NOT EXISTS account_id      uuid REFERENCES accounts(id),  -- target account, set at upload time
  ADD COLUMN IF NOT EXISTS detected_format text CHECK (detected_format IN ('csv','ofx','unknown')),
  ADD COLUMN IF NOT EXISTS detected_bank   text,
  ADD COLUMN IF NOT EXISTS total_rows      integer,
  ADD COLUMN IF NOT EXISTS ok_rows         integer,
  ADD COLUMN IF NOT EXISTS error_rows      integer,
  ADD COLUMN IF NOT EXISTS duplicate_rows  integer,
  ADD COLUMN IF NOT EXISTS matched_recurring_rows integer,
  ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz;
```

`account_id` is collected from the account selector in the Upload step (Step 1) and saved to `ingestion_files` before triggering the EF. The EF receives it as a parameter and uses it as the dedup scope for both `transactions` and `recurring_instances`.

### Removed

- `supabase/functions/ingest_receipt/` (entire directory)
- Env vars `GCV_KEY`, `GCV_ENDPOINT` from all config files
- `src/features/importer/ReceiptPreview.tsx`
- Hardcoded 1000-line cap in `supabase/functions/ingest_csv/index.ts`

---

## 4. Edge Function: `ingest_csv` (rewrite)

### Module structure

```
supabase/functions/ingest_csv/
  index.ts                 ← pipeline orchestrator
  parsers/
    detect-format.ts       ← 'csv' | 'ofx' | 'unknown'
    detect-bank.ts         ← bank_code | null
    csv-bank-template.ts   ← NormalizedRow[] via bank_templates.mapping
    csv-generic.ts         ← NormalizedRow[] via manual mapping (refactored existing)
    ofx.ts                 ← NormalizedRow[] via ofx-js
  dedup/
    fuzzy-dedup.ts         ← row_status per row
  rules/
    apply-rules.ts         ← category_id + applied_rule_id per row
```

### Shared type

```typescript
interface NormalizedRow {
  date: string;           // ISO YYYY-MM-DD
  amount_cents: number;   // positive = credit, negative = debit
  description: string;
  counterparty?: string;
  raw_json: Record<string, unknown>;
}
```

### `detect-format.ts`

- Extension `.ofx` OR content starts with `<OFX>` → `'ofx'`
- Otherwise: sniff first 3 lines with `,` and `;` delimiters → `'csv'`
- Returns `{ format: 'csv' | 'ofx' | 'unknown', delimiter?: string, encoding?: string }`

### `detect-bank.ts`

- Loads `bank_templates` from DB (in-memory during EF execution)
- Compares CSV header row against each template's `header_signature[]` (subset match, case-insensitive)
- Returns first matching `bank_code`, or `null`

### `csv-bank-template.ts`

- Accepts `mapping jsonb` from matched template
- Parses CSV with `papaparse` (Deno-compatible)
- Normalises: dates → ISO (handles `DD-MM-YYYY`, `YYYY/MM/DD`, `YYYYMMDD`), amounts → integer cents (handles `,` decimal separator), descriptions → trim
- Returns `NormalizedRow[]`

### `csv-generic.ts`

- Refactored from existing parser
- Accepts manual column mapping from client
- Same `NormalizedRow[]` output

### `ofx.ts`

- `import { parse } from 'ofx-js'`
- Extracts `STMTTRN` entries
- Normalises OFX dates (`YYYYMMDD`) → ISO, amounts → cents
- Returns `NormalizedRow[]`

### `fuzzy-dedup.ts`

Two passes per row against the same `account_id`:

**Pass 1 — against `transactions`:**
```
exact duplicate:      |date_diff| ≤ 2d  AND  |amount_diff| ≤ 2 cents
                      → row_status = 'duplicate'

probable_duplicate:   |date_diff| ≤ 5d  AND  exact amount  AND  pg_trgm similarity ≥ 0.7
                      → row_status = 'probable_duplicate'
```

**Pass 2 — against `recurring_instances`:**
```
matches_recurring:    status IN ('pending','confirmed')
                      AND same account_id
                      AND |date_diff| ≤ 2d
                      AND |amount_diff| ≤ 2 cents
                      → row_status = 'matches_recurring'
                      → matched_recurring_instance_id = instance.id
```

Description similarity via `rpc('string_similarity', { a, b })` wrapper over `pg_trgm similarity()` — avoids reimplementing in Deno, uses existing PG index.

**Performance note:** To avoid N individual RPC round-trips for the `probable_duplicate` pass, implement dedup as a single bulk SQL query (e.g. pass all candidate rows as a JSON array to a single RPC `bulk_fuzzy_dedup`) rather than one call per row. This matters for files near the 5000-line cap.

Rows with no match → `row_status = 'ok'`.

### `apply-rules.ts`

Applied only to rows with `row_status IN ('ok', 'probable_duplicate')`:

```typescript
// Priority ordering: lower number = evaluated first = wins.
// User rules default priority=100, family=100, system_seed=1000.
// ORDER BY priority ASC → user/family rules (100) are evaluated before system seeds (1000).
// First match wins → user rules override system seeds.
const rules = await fetchActiveRules(userId, familyId); // ORDER BY priority ASC

for (const row of rows) {
  for (const rule of rules) {
    if (matches(row, rule)) {
      row.category_id = rule.category_id;
      row.applied_rule_id = rule.id;
      break; // first match wins
    }
  }
}
```

`matches()` evaluation:

| match_field | match_type | logic |
|---|---|---|
| `description` | `contains` | `description.toLowerCase().includes(pattern.toLowerCase())` |
| `description` | `starts_with` | `description.toLowerCase().startsWith(pattern.toLowerCase())` |
| `description` | `regex` | `new RegExp(pattern, 'i').test(description)` |
| `counterparty` | `equals` | normalised exact match |
| `amount_range` | `range` | `pattern = "min_cents,max_cents"` → integer cents within range (e.g. `"0,5000"` = €0–€50) |

---

## 5. UI

### Route

`/app/import` (scope-aware via `useScope()`). Legacy routes `/personal/importar` and `/family/importar` become redirects.

### File structure

```
src/features/importer/
  ImportPage.tsx                ← rewrite (replaces src/pages/importer.tsx)
  UploadStep.tsx                ← new
  StagingTable.tsx              ← refactor (add badges, category inline)
  MappingForm.tsx               ← keep (fallback for unrecognised CSV)
  components/
    RowStatusBadge.tsx          ← new
    CategoryCell.tsx            ← new (inline dropdown + rule indicator)
    RecurringMatchExpander.tsx  ← new (shows matched recurring_instance)
    CreateRuleModal.tsx         ← new
  hooks/
    useImportJob.ts             ← new (polls ingestion_files)
    useStagingRows.ts           ← new
    usePostStaging.ts           ← new
```

### Step 1 — Upload

- Drag & drop or file picker (`.csv`, `.ofx`)
- Client-side sniff of first 3 lines for instant badge: `"CSV — Millennium BCP detectado"` / `"OFX — Santander Totta"` / `"Formato desconhecido — mapeamento manual"`
- Account selector (scope-aware)
- "Processar" button → triggers EF + 1s polling on `ingestion_files`
- Progress bar: `(processed_rows / total_rows)` updated via polling

### Step 2 — Staging table

Columns: Data | Descrição | Montante | Categoria | Estado

**Status badges:**

| Badge | Colour | Default behaviour |
|---|---|---|
| `ok` | green | selected for import |
| `auto ⚡` | blue | UI-derived state: `row_status='ok' AND applied_rule_id IS NOT NULL`; not a separate DB enum value; category pre-filled, editable |
| `provável duplicado` | yellow | deselected by default; expand shows existing transaction |
| `corresponde recorrente` | purple | selected; expand shows Unit 9 recurring instance |
| `duplicado` | grey | deselected, not selectable |
| `erro` | red | tooltip with reason; not importable |

**Category column:** inline dropdown; if `applied_rule_id` present → `⚡` icon with tooltip `"Regra: LIDL → Supermercado"`; `"+ Criar regra"` link opens `CreateRuleModal`.

### Step 3 — Post

- `"Importar X transações"` button (counts only selected rows where `row_status NOT IN ('duplicate','error')`)
- Rows with `matches_recurring`: calls `rpc('confirm_recurring_instance', { p_instance_id: instance_id })` (single-argument, matches existing Unit 9 RPC signature); the RPC marks the instance `status='confirmed'` and returns `{ transaction_id }` — the importer uses the returned `transaction_id` as the posted transaction (no duplicate transaction created)
- Success toast + redirect to `/app/transacoes`

---

## 6. Testing

**Coverage target: ≥ 80% on parsers, dedup, and rules engine.**

### Vitest unit tests (EF modules)

- `detect-format.test.ts` — CSV variants, OFX detection, unknown fallback
- `detect-bank.test.ts` — header matching for all 7 banks, no-match case
- Fixtures location: `supabase/functions/ingest_csv/__tests__/fixtures/` (one anonymised CSV per bank + one OFX file)
- `csv-bank-template.test.ts` — fixture CSV per bank (anonymised real extracts), date formats, decimal separators
- `csv-generic.test.ts` — manual mapping, semicolon delimiter, encoding edge cases
- `ofx.test.ts` — OFX fixture (anonymised), amount sign, date normalisation
- `fuzzy-dedup.test.ts` — exact duplicate, probable duplicate, matches_recurring, false positive guard
- `apply-rules.test.ts` — priority order, user overrides system_seed, regex rules, amount_range

### Playwright E2E

- Upload Millennium BCP CSV → bank detected → staging with auto-categories → post → transaction created in `/app/transacoes`
- Upload OFX → post OK
- Upload file with known duplicates → duplicate rows deselected by default, counts correct
- Upload file with recurring match → recurring instance confirmed (not duplicated)

---

## 7. What changes vs current codebase

| Item | Action |
|---|---|
| `src/pages/importer.tsx` | Delete (replaced by `src/features/importer/ImportPage.tsx`) |
| `src/features/importer/ReceiptPreview.tsx` | Delete |
| `src/services/importer.ts` | Refactor (remove `ingestion_jobs` refs, add `bank_templates` + `import_categorization_rules` queries) |
| `supabase/functions/ingest_receipt/` | Delete entire directory |
| `supabase/functions/ingest_csv/index.ts` | Rewrite (pipeline orchestrator) |
| `supabase/functions/ingest_csv/parsers/` | New directory with 5 modules |
| `supabase/functions/ingest_csv/dedup/` | New directory |
| `supabase/functions/ingest_csv/rules/` | New directory |
| Routes `/personal/importar`, `/family/importar` | Redirect to `/app/import` |
| `GCV_KEY`, `GCV_ENDPOINT` env vars | Remove from all config |
| `src/App.tsx` / router | Add `/app/import` route |

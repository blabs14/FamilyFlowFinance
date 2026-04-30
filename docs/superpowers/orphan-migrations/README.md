# Supabase Migration Version Rule

- `supabase/migrations/` may contain exactly one file per timestamp version.
- Historical duplicate SQL files must live under `docs/superpowers/orphan-migrations/archive/`.
- Remote tracking is keyed by `version`; do not rely on `name` to distinguish files.

## What Broke

The repository accumulated multiple local SQL files sharing the same timestamp prefix, while
`supabase_migrations.schema_migrations` tracks only one row per `version`. This left the
Supabase CLI unable to reconcile local files with remote tracking and blocked both
`supabase migration list` and `supabase db push --dry-run`.

## How It Was Repaired

- Inventoried every duplicate-version group and identified the orphan rows they caused.
- Kept exactly one canonical file per `version` in `supabase/migrations/`.
- Archived the remaining duplicate SQL files under `docs/superpowers/orphan-migrations/archive/`.
- Inserted the minimal missing remote tracking row for `20250115000100`.
- Verified the fix with:
  - `npx supabase migration list`
  - `npx supabase db push --dry-run`

## How To Avoid Recurrence

- Never create two active migration files with the same timestamp prefix.
- If historical SQL needs to be preserved outside the CLI flow, store it in the archive directory.
- Before committing new migrations, verify uniqueness with a quick duplicate-version scan.
- If Supabase CLI reports orphan rows again, inspect duplicate local versions before attempting `repair` or `--include-all`.

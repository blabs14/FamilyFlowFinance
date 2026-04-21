# Duplicate Version Inventory

## Summary
- Total duplicate version groups: 11
- Total orphan file candidates: 14

## Canonical Selection Rule
- Keep exactly one active migration file per `version` prefix in `supabase/migrations/`.
- When remote tracking only stores `version` and not a usable `name`, choose the canonical file deterministically by lexicographic filename order.
- Archive the remaining files under `docs/superpowers/orphan-migrations/archive/` so the SQL history is preserved outside the Supabase CLI active path.

## Groups
| Version | Files | Remote row present? | Current name in remote | Recommended canonical file |
| --- | --- | --- | --- | --- |
| 20250115000100 | `20250115000100_helpers_update_updated_at.sql` ; `20250115000100_payroll_module.sql` | No | Missing row | `20250115000100_helpers_update_updated_at.sql` |
| 20250116000000 | `20250116000000_create_payroll_meal_allowance_configs.sql` ; `20250116000000_fix_categories_default_access.sql` ; `20250116000000_fix_family_invite_logout.sql` | Yes | `null` | `20250116000000_create_payroll_meal_allowance_configs.sql` |
| 20250118000000 | `20250118000000_create_payroll_deduction_configs.sql` ; `20250118000000_make_payroll_family_id_optional.sql` | Yes | `null` | `20250118000000_create_payroll_deduction_configs.sql` |
| 20250122000002 | `20250122000002_add_absence_fields_to_time_entries.sql` ; `20250122000002_add_contract_id_to_meal_allowance_configs.sql` | Yes | `null` | `20250122000002_add_absence_fields_to_time_entries.sql` |
| 20250125000000 | `20250125000000_create_payroll_leaves.sql` ; `20250125000000_ensure_goals_account.sql` | Yes | `null` | `20250125000000_create_payroll_leaves.sql` |
| 20250126000000 | `20250126000000_add_holiday_type_column.sql` ; `20250126000000_fix_family_goals_filter.sql` ; `20250126000000_update_goals_account_names.sql` | Yes | `null` | `20250126000000_add_holiday_type_column.sql` |
| 20250126000001 | `20250126000001_fix_goal_progress_id_consistency.sql` ; `20250126000001_update_search_logic_for_new_goal_account_names.sql` | Yes | `null` | `20250126000001_fix_goal_progress_id_consistency.sql` |
| 20250126000003 | `20250126000003_fix_category_duplicate_key_error.sql` ; `20250126000003_rename_existing_objetivos_categories.sql` | Yes | `null` | `20250126000003_fix_category_duplicate_key_error.sql` |
| 20250127000001 | `20250127000001_fix_deallocate_logic_no_money_return.sql` ; `20250127000001_seed_legal_tables.sql` | Yes | `null` | `20250127000001_fix_deallocate_logic_no_money_return.sql` |
| 20250202000014 | `20250202000014_fix_deallocate_logic_correct.sql` ; `20250202000014_update_goal_progress_view.sql` | Yes | `null` | `20250202000014_fix_deallocate_logic_correct.sql` |
| 20250202000015 | `20250202000015_fix_deallocate_rls_user_id.sql` ; `20250202000015_fix_goal_deletion_logic.sql` | Yes | `null` | `20250202000015_fix_deallocate_rls_user_id.sql` |

## Verification Notes
- Every left-only orphan row in `npx supabase migration list` is explained by one of the duplicate-version groups above.
- The special case is `20250115000100`, where no remote row exists at all, which explains two visible orphan rows instead of one.
- All other duplicate groups already have a single remote row keyed only by `version`, which explains why the extra local files surface as orphans.

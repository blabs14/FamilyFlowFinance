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
  it('applies first matching rule (user before system_seed — lower priority number wins)', () => {
    const result = applyRules(rows, rules as any);
    expect(result[0].category_id).toBe('cat-super'); // user rule (priority=100) wins over seed (priority=1000)
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
    const regexRule = [{ id: 'r-1', priority: 50, match_field: 'description', match_type: 'regex', pattern: '^GALP', category_id: 'cat-fuel-r', scope: 'user' }];
    const result = applyRules([rows[1]], regexRule as any);
    expect(result[0].category_id).toBe('cat-fuel-r');
  });

  it('matches amount_range rules', () => {
    const rangeRule = [{ id: 'rng-1', priority: 50, match_field: 'amount_range', match_type: 'range', pattern: '-5000,-2000', category_id: 'cat-range', scope: 'user' }];
    const result = applyRules([rows[0]], rangeRule as any);
    expect(result[0].category_id).toBe('cat-range');
  });
});

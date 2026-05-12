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

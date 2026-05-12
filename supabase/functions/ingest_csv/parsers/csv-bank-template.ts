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

function parseCents(raw: string, decSep = '.'): number {
  if (!raw || !raw.trim()) return 0;
  const cleaned = raw.trim()
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
  const { rows } = parseCsvLines(content);
  const decSep = mapping.decimal_separator ?? '.';

  return rows
    .filter(r => Object.values(r).some(v => v.trim()))
    .map(r => {
      let amount_cents: number;
      if (mapping.amount_col_debit && mapping.amount_col_credit) {
        const debit  = parseCents(r[mapping.amount_col_debit]  ?? '', decSep);
        const credit = parseCents(r[mapping.amount_col_credit] ?? '', decSep);
        amount_cents = credit > 0 ? credit : -Math.abs(debit);
      } else {
        amount_cents = parseCents(r[mapping.amount_col!] ?? '', decSep);
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

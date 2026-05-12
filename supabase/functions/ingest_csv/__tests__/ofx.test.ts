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

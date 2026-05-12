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

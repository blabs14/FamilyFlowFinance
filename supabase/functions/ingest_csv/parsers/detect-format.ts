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

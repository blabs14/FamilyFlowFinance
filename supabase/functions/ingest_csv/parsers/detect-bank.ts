interface BankTemplate {
  bank_code: string;
  header_signature: string[];
}

export function detectBank(headerLine: string, templates: BankTemplate[]): string | null {
  const headerCols = headerLine.split(/[,;]/).map(c => c.trim());

  // Sort templates by specificity: more signature columns = higher priority
  const sorted = [...templates].sort((a, b) => b.header_signature.length - a.header_signature.length);

  // Pass 1: exact (case-sensitive) match
  for (const t of sorted) {
    if (t.header_signature.every(sig => headerCols.some(col => col === sig))) {
      return t.bank_code;
    }
  }

  // Pass 2: case-insensitive match
  const headerColsLower = headerCols.map(c => c.toLowerCase());
  for (const t of sorted) {
    const sigLower = t.header_signature.map(s => s.toLowerCase());
    if (sigLower.every(sig => headerColsLower.some(col => col === sig))) {
      return t.bank_code;
    }
  }

  return null;
}

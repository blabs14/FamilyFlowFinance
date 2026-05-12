import { describe, it, expect } from 'vitest';
import { detectBank } from '../parsers/detect-bank.ts';

const templates = [
  { bank_code: 'MILLENNIUM_BCP', header_signature: ['Data movimento','Descrição','Débito','Crédito'] },
  { bank_code: 'SANTANDER_TOTTA', header_signature: ['Data','Descrição','Valor','Saldo'] },
  { bank_code: 'CGD', header_signature: ['Data Valor','Descrição','Valor','Saldo Contabilístico'] },
  { bank_code: 'NOVO_BANCO', header_signature: ['DATA','DESCRIÇÃO','VALOR','SALDO'] },
  { bank_code: 'ACTIVOBANK', header_signature: ['Data','Movimento','Montante','Saldo'] },
  { bank_code: 'MONTEPIO', header_signature: ['Data Op.','Descrição','Montante','Saldo'] },
  { bank_code: 'BPI', header_signature: ['Data','Descrição do Movimento','Valor'] },
];

describe('detectBank', () => {
  it('detects MILLENNIUM_BCP', () => {
    expect(detectBank('Data movimento,Descrição,Débito,Crédito', templates)).toBe('MILLENNIUM_BCP');
  });

  it('detects SANTANDER_TOTTA', () => {
    expect(detectBank('Data,Descrição,Valor,Saldo', templates)).toBe('SANTANDER_TOTTA');
  });

  it('detects CGD', () => {
    expect(detectBank('Data Valor,Descrição,Valor,Saldo Contabilístico', templates)).toBe('CGD');
  });

  it('detects NOVO_BANCO (case-insensitive)', () => {
    expect(detectBank('DATA,DESCRIÇÃO,VALOR,SALDO', templates)).toBe('NOVO_BANCO');
  });

  it('detects ACTIVOBANK', () => {
    expect(detectBank('Data,Movimento,Montante,Saldo', templates)).toBe('ACTIVOBANK');
  });

  it('detects MONTEPIO', () => {
    expect(detectBank('Data Op.,Descrição,Montante,Saldo', templates)).toBe('MONTEPIO');
  });

  it('detects BPI', () => {
    expect(detectBank('Data,Descrição do Movimento,Valor', templates)).toBe('BPI');
  });

  it('returns null for unrecognised header', () => {
    expect(detectBank('Date,Amount,Description', templates)).toBeNull();
  });
});

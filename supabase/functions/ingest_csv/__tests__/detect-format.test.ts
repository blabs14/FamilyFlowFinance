import { describe, it, expect } from 'vitest';
import { detectFormat } from '../parsers/detect-format.ts';

describe('detectFormat', () => {
  it('returns ofx for .ofx extension hint', () => {
    expect(detectFormat('<OFX>\nsome content', 'file.ofx')).toEqual({ format: 'ofx' });
  });

  it('returns ofx when content starts with <OFX>', () => {
    expect(detectFormat('<OFX>\nSTMTTRN', 'file.csv')).toEqual({ format: 'ofx' });
  });

  it('returns csv with comma delimiter', () => {
    const r = detectFormat('Data,Descricao,Valor\n01-01-2025,Lidl,-20.00', 'file.csv');
    expect(r.format).toBe('csv');
    expect(r.delimiter).toBe(',');
  });

  it('returns csv with semicolon delimiter', () => {
    const r = detectFormat('Data;Descricao;Valor\n01-01-2025;Lidl;-20,00', 'file.csv');
    expect(r.format).toBe('csv');
    expect(r.delimiter).toBe(';');
  });

  it('returns unknown for unrecognised content', () => {
    expect(detectFormat('not a csv or ofx', 'file.txt')).toEqual({ format: 'unknown' });
  });
});

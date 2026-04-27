export const euroToCents = (euro: number): number => Math.round(euro * 100);

export const centsToEuro = (cents: number): number => cents / 100;

export const formatMoney = (cents: number, currency = 'EUR', locale = 'pt-PT'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

export const parseMoney = (input: string): number | null => {
  const cleaned = input.replace(/[€$£\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

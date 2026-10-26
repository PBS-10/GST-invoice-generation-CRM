import { describe, expect, it } from 'vitest';
import { formatInvoiceNumber, getFinancialYear } from '../src/invoice';

describe('getFinancialYear', () => {
  it('uses April–March boundaries', () => {
    expect(getFinancialYear(new Date('2026-03-31T10:00:00.000Z'))).toBe('25-26');
    expect(getFinancialYear(new Date('2026-04-01T00:00:00+05:30'))).toBe('26-27');
  });
});

describe('formatInvoiceNumber', () => {
  it('pads the legacy sequence to 6 digits', () => {
    expect(formatInvoiceNumber('ABC', '26-27', 123)).toBe('ABC/26-27/000123');
  });

  it('formats series numbers within 16 characters', () => {
    expect(formatInvoiceNumber('INV', 'A', '25-26', 1)).toBe('INVA/25-26/00001');
  });

  it('rejects numbers longer than 16 characters', () => {
    expect(() => formatInvoiceNumber('ABCD', 'A', '25-26', 1)).toThrow(/16/);
  });
});

describe('parseInvoiceSequence', () => {
  it('reads the sequence for a device series', async () => {
    const { parseInvoiceSequence } = await import('../src/invoice');
    expect(parseInvoiceSequence('INVA/25-26/00042', 'INV', 'A')).toBe(42);
    expect(parseInvoiceSequence('INVB/25-26/00042', 'INV', 'A')).toBeNull();
  });
});

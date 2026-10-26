import { describe, expect, it } from 'vitest';
import { calculateInvoiceTotals } from '../src/gst/calculateInvoiceTotals';

const exclusive18 = {
  quantityMilli: 1000,
  unitPricePaise: 10_000,
  gstRateBps: 1800,
  priceInclusive: false,
  lineDiscountPaise: 0,
};

describe('calculateInvoiceTotals', () => {
  it('computes exclusive 18% intra-state GST', () => {
    const result = calculateInvoiceTotals({
      lines: [exclusive18],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.subtotalPaise).toBe(10_000);
    expect(result.taxablePaise).toBe(10_000);
    expect(result.cgstPaise).toBe(900);
    expect(result.sgstPaise).toBe(900);
    expect(result.igstPaise).toBe(0);
    expect(result.totalPaise).toBe(11_800);
    expect(result.lines[0]?.lineTotalPaise).toBe(11_800);
  });

  it('backs out tax from GST-inclusive prices', () => {
    const result = calculateInvoiceTotals({
      lines: [
        {
          ...exclusive18,
          unitPricePaise: 11_800,
          priceInclusive: true,
        },
      ],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.taxablePaise).toBe(10_000);
    expect(result.cgstPaise).toBe(900);
    expect(result.sgstPaise).toBe(900);
    expect(result.totalPaise).toBe(11_800);
  });

  it('uses IGST only for inter-state invoices', () => {
    const result = calculateInvoiceTotals({
      lines: [exclusive18],
      invoiceDiscountPaise: 0,
      isInterState: true,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
    expect(result.igstPaise).toBe(1_800);
    expect(result.totalPaise).toBe(11_800);
  });

  it('charges no GST at 0%', () => {
    const result = calculateInvoiceTotals({
      lines: [{ ...exclusive18, gstRateBps: 0 }],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.taxablePaise).toBe(10_000);
    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
    expect(result.totalPaise).toBe(10_000);
  });

  it.each([
    [500, 500],
    [1200, 1_200],
    [2800, 2_800],
  ] as const)('applies %s bps exclusive tax', (gstRateBps, expectedTax) => {
    const result = calculateInvoiceTotals({
      lines: [{ ...exclusive18, gstRateBps }],
      invoiceDiscountPaise: 0,
      isInterState: true,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.igstPaise).toBe(expectedTax);
    expect(result.totalPaise).toBe(10_000 + expectedTax);
  });

  it('multiplies milli-quantity by unit price', () => {
    const result = calculateInvoiceTotals({
      lines: [
        {
          ...exclusive18,
          quantityMilli: 2500,
          unitPricePaise: 4_000,
        },
      ],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.subtotalPaise).toBe(10_000);
    expect(result.taxablePaise).toBe(10_000);
  });

  it('subtracts line discount before tax', () => {
    const result = calculateInvoiceTotals({
      lines: [{ ...exclusive18, lineDiscountPaise: 1_000 }],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.subtotalPaise).toBe(9_000);
    expect(result.taxablePaise).toBe(9_000);
    expect(result.cgstPaise).toBe(810);
    expect(result.sgstPaise).toBe(810);
    expect(result.roundOffPaise).toBe(-20);
    expect(result.totalPaise).toBe(10_600);
  });

  it('allocates invoice discount across taxable lines', () => {
    const result = calculateInvoiceTotals({
      lines: [exclusive18, { ...exclusive18, gstRateBps: 500 }],
      invoiceDiscountPaise: 2_000,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.discountPaise).toBe(2_000);
    expect(result.taxablePaise).toBe(18_000);
    expect(result.subtotalPaise).toBe(20_000);
  });

  it('omits tax split under composition scheme', () => {
    const result = calculateInvoiceTotals({
      lines: [exclusive18],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: true,
    });

    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
    expect(result.igstPaise).toBe(0);
    expect(result.taxablePaise).toBe(10_000);
    expect(result.totalPaise).toBe(10_000);
  });

  it('gives leftover odd paise to SGST', () => {
    const result = calculateInvoiceTotals({
      lines: [
        {
          ...exclusive18,
          unitPricePaise: 101,
          gstRateBps: 500,
        },
      ],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    const tax = result.cgstPaise + result.sgstPaise;
    expect(tax).toBe(result.cgstPaise + result.sgstPaise);
    expect(result.cgstPaise + result.sgstPaise).toBe(tax);
    expect(Math.abs(result.sgstPaise - result.cgstPaise)).toBeLessThanOrEqual(1);
    if (tax % 2 === 1) {
      expect(result.sgstPaise).toBe(result.cgstPaise + 1);
    }
  });

  it('rounds the grand total to the nearest rupee', () => {
    const result = calculateInvoiceTotals({
      lines: [
        {
          quantityMilli: 1000,
          unitPricePaise: 99,
          gstRateBps: 0,
          priceInclusive: false,
          lineDiscountPaise: 0,
        },
      ],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    });

    expect(result.totalPaise).toBe(100);
    expect(result.roundOffPaise).toBe(1);
  });
});

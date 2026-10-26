import { describe, expect, it } from 'vitest';
import { gstMismatchCode, recomputeInvoiceTotals } from './assertGstMatch';

const input = {
  lines: [
    {
      quantityMilli: 2000,
      unitPricePaise: 5000,
      gstRateBps: 500,
      priceInclusive: false,
      lineDiscountPaise: 0,
    },
  ],
  invoiceDiscountPaise: 0,
  isInterState: false,
  roundingMode: 'nearest' as const,
  compositionScheme: false,
};

describe('gstMismatchCode', () => {
  it('accepts client totals that match the shared GST engine', () => {
    const computed = recomputeInvoiceTotals(input);
    expect(
      gstMismatchCode(
        {
          taxablePaise: computed.taxablePaise,
          cgstPaise: computed.cgstPaise,
          sgstPaise: computed.sgstPaise,
          igstPaise: computed.igstPaise,
          totalPaise: computed.totalPaise,
        },
        computed,
      ),
    ).toBeNull();
  });

  it('rejects a total that is more than one paise off', () => {
    const computed = recomputeInvoiceTotals(input);
    expect(
      gstMismatchCode(
        {
          taxablePaise: computed.taxablePaise,
          cgstPaise: computed.cgstPaise,
          sgstPaise: computed.sgstPaise,
          igstPaise: computed.igstPaise,
          totalPaise: computed.totalPaise + 2,
        },
        computed,
      ),
    ).toBe('GST_MISMATCH');
  });
});

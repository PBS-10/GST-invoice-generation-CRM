import { describe, expect, it } from 'vitest';
import { parseInvoiceSequence } from '@invoice-gst/shared';
import { choosePostLoginAction } from './postLogin';

/** Mirrors restore sequence rebuild: take the max sequence per FY for this series. */
function rebuildNextNumbers(
  invoices: Array<{ invoiceNumber: string; financialYear: string }>,
  prefix: string,
  seriesCode: string,
): Map<string, number> {
  const byFy = new Map<string, number>();
  for (const invoice of invoices) {
    const sequence = parseInvoiceSequence(invoice.invoiceNumber, prefix, seriesCode);
    if (sequence == null) {
      continue;
    }
    const prior = byFy.get(invoice.financialYear) ?? 0;
    if (sequence > prior) {
      byFy.set(invoice.financialYear, sequence);
    }
  }
  const next = new Map<string, number>();
  for (const [fy, max] of byFy) {
    next.set(fy, max + 1);
  }
  return next;
}

describe('restore sequence rebuild', () => {
  it('continues from the highest pulled number in this device series', () => {
    const next = rebuildNextNumbers(
      [
        { invoiceNumber: 'INVA/25-26/00001', financialYear: '25-26' },
        { invoiceNumber: 'INVA/25-26/00007', financialYear: '25-26' },
        { invoiceNumber: 'INVB/25-26/00099', financialYear: '25-26' },
        { invoiceNumber: 'INVA/26-27/00002', financialYear: '26-27' },
      ],
      'INV',
      'A',
    );
    expect(next.get('25-26')).toBe(8);
    expect(next.get('26-27')).toBe(3);
  });
});

describe('choosePostLoginAction', () => {
  it('resumes when this phone already belongs to the cloud shop', () => {
    expect(
      choosePostLoginAction({
        localVendorId: 'vendor-1',
        cloudVendorId: 'vendor-1',
        hasLocalBusinessOrUnsyncedData: true,
        userConfirmedReplace: false,
      }),
    ).toBe('resume');
  });

  it('does not wipe when same shop even with pending products', () => {
    expect(
      choosePostLoginAction({
        localVendorId: 'vendor-1',
        cloudVendorId: 'vendor-1',
        hasLocalBusinessOrUnsyncedData: true,
        userConfirmedReplace: true,
      }),
    ).toBe('resume');
  });

  it('asks to replace when signing into a different shop with local data', () => {
    expect(
      choosePostLoginAction({
        localVendorId: 'seed-vendor',
        cloudVendorId: 'cloud-vendor',
        hasLocalBusinessOrUnsyncedData: true,
        userConfirmedReplace: false,
      }),
    ).toBe('confirm_replace');
  });

  it('restores after the user confirms replace on a different shop', () => {
    expect(
      choosePostLoginAction({
        localVendorId: 'seed-vendor',
        cloudVendorId: 'cloud-vendor',
        hasLocalBusinessOrUnsyncedData: true,
        userConfirmedReplace: true,
      }),
    ).toBe('restore');
  });

  it('restores immediately when the other shop phone has no local business data', () => {
    expect(
      choosePostLoginAction({
        localVendorId: 'seed-vendor',
        cloudVendorId: 'cloud-vendor',
        hasLocalBusinessOrUnsyncedData: false,
        userConfirmedReplace: false,
      }),
    ).toBe('restore');
  });
});

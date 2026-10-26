import { describe, expect, it } from 'vitest';
import type { InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';
import { clampInvoiceDiscountPaise, paymentStatusForDraft } from './draftTotals';

const baseDraft: InvoiceDraftState = {
  activeCartId: null,
  customerId: null,
  customerSnapshot: { name: 'Walk-in', phone: null, gstin: null, stateCode: null },
  invoiceDiscountPaise: 0,
  notes: '',
  paymentMethod: 'cash',
  collectPayment: true,
  lines: [],
};

describe('paymentStatusForDraft', () => {
  it('marks unpaid when payment is not collected', () => {
    expect(
      paymentStatusForDraft({ ...baseDraft, collectPayment: false }, 10_500),
    ).toBe('unpaid');
  });

  it('marks paid in full when collecting without an amount override', () => {
    expect(paymentStatusForDraft(baseDraft, 10_500)).toBe('paid');
  });

  it('marks partial when amount received is below the total', () => {
    expect(paymentStatusForDraft(baseDraft, 10_500, 5_000)).toBe('partial');
  });

  it('marks paid when amount received meets or exceeds the total', () => {
    expect(paymentStatusForDraft(baseDraft, 10_500, 10_500)).toBe('paid');
    expect(paymentStatusForDraft(baseDraft, 10_500, 12_000)).toBe('paid');
  });
});

describe('clampInvoiceDiscountPaise', () => {
  it('clamps to zero for empty or invalid discounts', () => {
    expect(clampInvoiceDiscountPaise(0, 10_000)).toBe(0);
    expect(clampInvoiceDiscountPaise(-100, 10_000)).toBe(0);
    expect(clampInvoiceDiscountPaise(Number.NaN, 10_000)).toBe(0);
  });

  it('never exceeds the subtotal', () => {
    expect(clampInvoiceDiscountPaise(15_000, 10_000)).toBe(10_000);
    expect(clampInvoiceDiscountPaise(2_500, 10_000)).toBe(2_500);
  });
});

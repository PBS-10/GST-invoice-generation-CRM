import { describe, expect, it } from 'vitest';
import {
  clampClientUpdatedAt,
  invoiceCancelDecision,
  invoiceCreateDecision,
  masterDataDecision,
} from './policy';

describe('sync policy', () => {
  it('lets a newer client update win and flags an older client as a conflict', () => {
    expect(
      masterDataDecision({
        exists: true,
        serverUpdatedAt: '2026-04-01T00:00:00.000Z',
        clientUpdatedAt: '2026-04-02T00:00:00.000Z',
      }),
    ).toBe('apply');
    expect(
      masterDataDecision({
        exists: true,
        serverUpdatedAt: '2026-04-02T00:00:00.000Z',
        clientUpdatedAt: '2026-04-01T00:00:00.000Z',
      }),
    ).toBe('conflict');
  });

  it('rejects a second invoice create when the payload differs', () => {
    expect(invoiceCreateDecision({ exists: true, samePayload: false, gstOk: true })).toEqual({
      status: 'rejected',
      code: 'INVOICE_IMMUTABLE',
    });
    expect(invoiceCreateDecision({ exists: false, samePayload: false, gstOk: false })).toEqual({
      status: 'rejected',
      code: 'GST_MISMATCH',
    });
  });

  it('allows replacing an unpaid finalized invoice in place', () => {
    expect(
      invoiceCreateDecision({
        exists: true,
        samePayload: false,
        gstOk: true,
        allowUnpaidReplace: true,
        status: 'finalized',
        paymentStatus: 'unpaid',
      }),
    ).toEqual({ status: 'applied', code: 'UNPAID_REPLACE' });
    expect(
      invoiceCreateDecision({
        exists: true,
        samePayload: false,
        gstOk: true,
        allowUnpaidReplace: true,
        status: 'finalized',
        paymentStatus: 'paid',
      }),
    ).toEqual({ status: 'rejected', code: 'INVOICE_IMMUTABLE' });
  });

  it('treats a second cancel as a duplicate', () => {
    expect(invoiceCancelDecision({ exists: true, status: 'cancelled' })).toEqual({
      status: 'duplicate',
    });
    expect(invoiceCancelDecision({ exists: true, status: 'finalized' })).toEqual({
      status: 'applied',
    });
  });

  it('clamps client timestamps more than 5 minutes in the future', () => {
    const now = new Date('2026-04-01T12:00:00.000Z');
    const farFuture = '2026-04-01T13:00:00.000Z';
    expect(clampClientUpdatedAt(farFuture, now).toISOString()).toBe(now.toISOString());
    const nearFuture = '2026-04-01T12:04:00.000Z';
    expect(clampClientUpdatedAt(nearFuture, now).toISOString()).toBe(nearFuture);
  });
});

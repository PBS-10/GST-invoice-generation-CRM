import {
  calculateInvoiceTotals,
  paymentStatusFromAmounts,
  resolvePlaceOfSupply,
  type InvoiceTotals,
} from '@invoice-gst/shared';
import type { GstConfiguration, Vendor } from '@invoice-gst/types';
import type { InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';

export function totalsFromDraft(
  draft: InvoiceDraftState,
  vendor: Vendor,
  config: GstConfiguration | null,
): InvoiceTotals {
  const { isInterState } = resolvePlaceOfSupply(
    vendor.stateCode,
    draft.customerSnapshot.stateCode,
  );

  return calculateInvoiceTotals({
    lines: draft.lines.map((line) => ({
      quantityMilli: line.quantityMilli,
      unitPricePaise: line.unitPricePaise,
      gstRateBps: line.gstRateBps,
      priceInclusive: line.priceInclusive,
      lineDiscountPaise: line.lineDiscountPaise,
    })),
    invoiceDiscountPaise: draft.invoiceDiscountPaise,
    isInterState,
    roundingMode: config?.roundingMode ?? 'nearest',
    compositionScheme:
      config?.compositionScheme ?? vendor.gstRegistrationType === 'composition',
  });
}

/**
 * Resolve payment status from the draft toggle and optional amount received.
 * When collecting and `paidPaise` is omitted, treat as paid in full.
 */
export function paymentStatusForDraft(
  draft: InvoiceDraftState,
  totalPaise: number,
  paidPaise?: number,
) {
  if (!draft.collectPayment) {
    return paymentStatusFromAmounts(totalPaise, 0);
  }
  const paid = paidPaise == null ? totalPaise : Math.max(0, paidPaise);
  return paymentStatusFromAmounts(totalPaise, paid);
}

/** Clamp invoice-level discount so it never exceeds the pre-discount subtotal. */
export function clampInvoiceDiscountPaise(discountPaise: number, subtotalPaise: number): number {
  if (!Number.isFinite(discountPaise) || discountPaise <= 0) {
    return 0;
  }
  return Math.min(Math.floor(discountPaise), Math.max(0, subtotalPaise));
}

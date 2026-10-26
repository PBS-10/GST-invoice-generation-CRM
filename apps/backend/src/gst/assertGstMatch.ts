import { calculateInvoiceTotals } from '@invoice-gst/shared';
import type { InvoiceCalcInput, InvoiceTotals } from '@invoice-gst/shared';

export const GST_TOLERANCE_PAISE = 1;

export type ClientInvoiceTotals = {
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

export function recomputeInvoiceTotals(input: InvoiceCalcInput): InvoiceTotals {
  return calculateInvoiceTotals(input);
}

export function gstMismatchCode(
  client: ClientInvoiceTotals,
  computed: InvoiceTotals,
): 'GST_MISMATCH' | null {
  const pairs: Array<[number, number]> = [
    [client.taxablePaise, computed.taxablePaise],
    [client.cgstPaise, computed.cgstPaise],
    [client.sgstPaise, computed.sgstPaise],
    [client.igstPaise, computed.igstPaise],
    [client.totalPaise, computed.totalPaise],
  ];
  for (const [claimed, actual] of pairs) {
    if (Math.abs(claimed - actual) > GST_TOLERANCE_PAISE) {
      return 'GST_MISMATCH';
    }
  }
  return null;
}

import type { InvoiceWithItems, Vendor } from '@invoice-gst/types';

/**
 * Thermal printer boundary. Real ESC/POS adapters land behind this once the
 * shop printer model and transport (Classic BT / BLE / USB / LAN) are known.
 * Until then, use {@link unsupportedPrinterPort}.
 */
export type PrinterPort = {
  connect(): Promise<void>;
  printInvoice(input: { vendor: Vendor; invoice: InvoiceWithItems }): Promise<void>;
  disconnect(): Promise<void>;
};

export class UnsupportedPrinterError extends Error {
  constructor(message = 'No shop printer is configured on this build yet.') {
    super(message);
    this.name = 'UnsupportedPrinterError';
  }
}

/** Stub used until a hardware SKU unlocks Phase 7. */
export const unsupportedPrinterPort: PrinterPort = {
  async connect() {
    throw new UnsupportedPrinterError();
  },
  async printInvoice() {
    throw new UnsupportedPrinterError(
      'Printing needs a counter printer model. Share PDF until then.',
    );
  },
  async disconnect() {
    // no-op
  },
};

export function isPrinterConfigured(): boolean {
  return false;
}

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InvoiceWithItems, Vendor } from '@invoice-gst/types';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { generateInvoicePDF } from './generateInvoicePDF';

const fontBytes = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../assets/fonts/NotoSansMalayalam-Regular.ttf'),
);

const vendor: Vendor = {
  id: 'vendor-1',
  businessName: 'My Shop',
  tradeName: 'എന്റെ കട',
  gstin: '32ABCDE1234F1Z5',
  phone: '9999999999',
  email: 'shop@example.com',
  addressLine1: 'Market Road',
  addressLine2: null,
  city: 'Kochi',
  stateCode: '32',
  pincode: '682001',
  gstRegistrationType: 'regular',
  invoicePrefix: 'INV',
  logoUri: null,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  deletedAt: null,
  syncStatus: 'pending',
};

function invoice(overrides: Partial<InvoiceWithItems> = {}): InvoiceWithItems {
  return {
    id: 'invoice-1',
    invoiceNumber: 'INV/26-27/000001',
    financialYear: '26-27',
    customerId: null,
    customerSnapshot: {
      name: 'Walk-in',
      phone: null,
      gstin: null,
      stateCode: null,
    },
    placeOfSupplyStateCode: '32',
    isInterState: false,
    status: 'finalized',
    subtotalPaise: 10000,
    discountPaise: 0,
    taxablePaise: 10000,
    cgstPaise: 250,
    sgstPaise: 250,
    igstPaise: 0,
    roundOffPaise: 0,
    totalPaise: 10500,
    paymentStatus: 'paid',
    notes: null,
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedAt: '2026-04-02T10:00:00.000Z',
    finalizedAt: '2026-04-02T10:00:00.000Z',
    syncStatus: 'pending',
    items: [
      {
        id: 'item-1',
        invoiceId: 'invoice-1',
        productId: 'product-1',
        productNameSnapshot: 'Rice',
        localNameSnapshot: 'അരി',
        hsnSnapshot: '1006',
        unitSnapshot: 'kg',
        quantityMilli: 2000,
        unitPricePaise: 5000,
        gstRateBps: 500,
        priceInclusive: false,
        taxablePaise: 10000,
        cgstPaise: 250,
        sgstPaise: 250,
        igstPaise: 0,
        lineTotalPaise: 10500,
      },
    ],
    payments: [
      {
        id: 'pay-1',
        invoiceId: 'invoice-1',
        method: 'cash',
        amountPaise: 10500,
        paidAt: '2026-04-02T10:00:00.000Z',
        reference: null,
        createdAt: '2026-04-02T10:00:00.000Z',
        updatedAt: '2026-04-02T10:00:00.000Z',
        syncStatus: 'pending',
      },
    ],
    ...overrides,
  };
}

function embeddedFontNames(doc: PDFDocument): string[] {
  const names: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) {
      continue;
    }
    const baseFont = object.get(PDFName.of('BaseFont'));
    if (baseFont) {
      names.push(baseFont.toString());
    }
  }
  return names;
}

describe('generateInvoicePDF', () => {
  it('embeds the Indic font and keeps the invoice number', async () => {
    const bytes = await generateInvoicePDF({ vendor, invoice: invoice() }, fontBytes);
    expect(Buffer.from(bytes.subarray(0, 5)).toString('utf8')).toBe('%PDF-');

    const doc = await PDFDocument.load(bytes);
    expect(embeddedFontNames(doc).some((name) => name.includes('Malayalam'))).toBe(true);
    expect(doc.getTitle()).toBe('INV/26-27/000001');
    expect(doc.getPageCount()).toBe(1);
  });

  it('still renders a composition bill and a cancelled invoice', async () => {
    const bytes = await generateInvoicePDF(
      {
        vendor: { ...vendor, gstRegistrationType: 'composition' },
        invoice: invoice({
          status: 'cancelled',
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          totalPaise: 10000,
        }),
      },
      fontBytes,
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(embeddedFontNames(doc).some((name) => name.includes('Malayalam'))).toBe(true);
  });

  it('adds another page when the line list is long', async () => {
    const line = invoice().items[0];
    if (!line) {
      throw new Error('fixture line missing');
    }
    const bytes = await generateInvoicePDF(
      {
        vendor,
        invoice: invoice({
          items: Array.from({ length: 40 }, (_, index) => ({
            ...line,
            id: `item-${index}`,
            productNameSnapshot: `Product ${index}`,
          })),
        }),
      },
      fontBytes,
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

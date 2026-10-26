import 'regenerator-runtime/runtime';
import { paiseToRupeeLabel, quantityMilliToText } from '@invoice-gst/shared';
import type { InvoiceItem, InvoiceWithItems, Vendor } from '@invoice-gst/types';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { stateLabel } from '../../constants/states';
import { invoiceStatusLabel, paidByLabel } from '../../utils/format';

export type InvoicePdfInput = {
  vendor: Vendor;
  invoice: InvoiceWithItems;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.102, 0.165, 0.133);
const MUTED = rgb(0.416, 0.455, 0.424);
const RULE = rgb(0.851, 0.824, 0.765);
const GREEN = rgb(0.122, 0.302, 0.227);
const GREEN_SOFT = rgb(0.804, 0.898, 0.839);
const ON_GREEN = rgb(0.969, 0.953, 0.918);
const DANGER = rgb(0.608, 0.173, 0.173);
const WHITE = rgb(1, 1, 1);

/** Columns: # · Item · Qty · Rate · Amount (no Tax). Qty/Rate/Amount are centered. */
const COL = {
  index: MARGIN + 8,
  item: MARGIN + 28,
  qtyCenter: 330,
  rateCenter: 410,
  amountCenter: 510,
  amountRight: PAGE_WIDTH - MARGIN - 8,
} as const;

type Color = ReturnType<typeof rgb>;
type Cursor = { page: PDFPage; y: number };
type Drawer = {
  text: (value: string) => string;
  money: (paise: number) => string;
};

export async function generateInvoicePDF(
  input: InvoicePdfInput,
  fontBytes: Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const draw = createDrawer(font);
  const { vendor, invoice } = input;

  doc.setTitle(invoice.invoiceNumber);
  doc.setAuthor(vendor.businessName);
  doc.setCreator('GST Invoice');

  let cursor = addPage(doc);
  cursor = drawReceipt(cursor, doc, font, draw, vendor, invoice);

  if (invoice.payments.length > 0) {
    cursor = gap(cursor, 16);
    cursor = writeLine(cursor, doc, font, 'Payments', 11, GREEN, 15);
    for (const payment of invoice.payments) {
      cursor = writeLine(
        cursor,
        doc,
        font,
        `${draw.text(payment.method)}  ${draw.money(payment.amountPaise)}  ${formatInvoiceDateTime(payment.paidAt)}`,
        10,
        INK,
        13,
      );
    }
  }

  cursor = gap(cursor, 18);
  cursor = writeLine(
    cursor,
    doc,
    font,
    'Generated on this device. This is not an e-invoice.',
    8,
    MUTED,
    11,
  );

  if (invoice.status === 'cancelled') {
    for (const page of doc.getPages()) {
      page.drawText('CANCELLED', {
        x: 150,
        y: 400,
        size: 42,
        font,
        color: DANGER,
        opacity: 0.18,
      });
    }
  }

  return doc.save();
}

/**
 * Same structure as the on-screen receipt: shop + INVOICE meta, Bill To /
 * Place of supply, item table without Tax, totals, mint total band, thank-you.
 */
function drawReceipt(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  draw: Drawer,
  vendor: Vendor,
  invoice: InvoiceWithItems,
): Cursor {
  const shopName = draw.text(vendor.tradeName || vendor.businessName);
  const gstLabel = vendor.gstin ? `GSTIN ${draw.text(vendor.gstin)}` : 'Unregistered';
  const address = draw.text(formatVendorAddress(vendor));
  const issuedAt = formatInvoiceDateTime(invoice.finalizedAt ?? invoice.createdAt);
  const place = draw.text(stateLabel(invoice.placeOfSupplyStateCode));
  const supply = invoice.isInterState ? 'Inter-State · IGST' : 'Intra-State · CGST + SGST';
  const uniformRate = uniformGstRateBps(invoice.items);
  const halfRate = uniformRate != null ? `${trimRate(uniformRate / 200)}%` : null;

  let next = room(cursor, doc, 80);

  next.page.drawRectangle({
    x: MARGIN,
    y: next.y - 26,
    width: 22,
    height: 22,
    color: GREEN,
  });
  next.page.drawText('S', {
    x: MARGIN + 6.5,
    y: next.y - 20,
    size: 12,
    font,
    color: ON_GREEN,
  });

  next.page.drawText(shopName, {
    x: MARGIN + 30,
    y: next.y - 12,
    size: 13,
    font,
    color: GREEN,
  });
  next.page.drawText(gstLabel, {
    x: MARGIN + 30,
    y: next.y - 24,
    size: 8,
    font,
    color: MUTED,
  });

  let addressBottom = next.y - 24;
  if (address) {
    const addressLines = wrap(font, address, 8, 250);
    addressLines.slice(0, 3).forEach((line, index) => {
      next.page.drawText(line, {
        x: MARGIN + 30,
        y: next.y - 36 - index * 10,
        size: 8,
        font,
        color: MUTED,
      });
      addressBottom = next.y - 36 - index * 10;
    });
  }

  const metaLabel =
    invoice.status === 'cancelled'
      ? invoiceStatusLabel.cancelled
      : invoice.paymentStatus === 'paid'
        ? (paidByLabel(invoice.payments) ?? 'Paid')
        : null;

  drawRight(next.page, font, 'INVOICE', 10, PAGE_WIDTH - MARGIN, next.y - 12, GREEN);
  drawRight(
    next.page,
    font,
    draw.text(invoice.invoiceNumber),
    9,
    PAGE_WIDTH - MARGIN,
    next.y - 24,
    INK,
  );
  drawRight(next.page, font, issuedAt, 8, PAGE_WIDTH - MARGIN, next.y - 36, MUTED);
  let metaBottom = next.y - 36;
  if (metaLabel) {
    drawRight(
      next.page,
      font,
      draw.text(metaLabel),
      9,
      PAGE_WIDTH - MARGIN,
      next.y - 48,
      invoice.status === 'cancelled' ? MUTED : GREEN,
    );
    metaBottom = next.y - 48;
  }

  next = { page: next.page, y: Math.min(addressBottom, metaBottom) - 14 };
  next = hairline(next);
  next = gap(next, 14);

  next.page.drawText('Bill To', { x: MARGIN, y: next.y - 9, size: 8, font, color: MUTED });
  next.page.drawText(draw.text(invoice.customerSnapshot.name), {
    x: MARGIN,
    y: next.y - 23,
    size: 11,
    font,
    color: INK,
  });
  drawRight(next.page, font, 'Place of supply', 8, PAGE_WIDTH - MARGIN, next.y - 9, MUTED);
  drawRight(next.page, font, place, 10, PAGE_WIDTH - MARGIN, next.y - 23, INK);
  drawRight(next.page, font, supply, 8, PAGE_WIDTH - MARGIN, next.y - 35, MUTED);
  next = gap(next, 46);

  // Table header
  next = room(next, doc, 24);
  next.page.drawRectangle({
    x: MARGIN,
    y: next.y - 18,
    width: CONTENT_WIDTH,
    height: 18,
    color: GREEN,
  });
  next.page.drawText('#', { x: COL.index, y: next.y - 13, size: 8, font, color: ON_GREEN });
  next.page.drawText('Item', { x: COL.item, y: next.y - 13, size: 8, font, color: ON_GREEN });
  drawCentered(next.page, font, 'Qty', 8, COL.qtyCenter, next.y - 13, ON_GREEN);
  drawCentered(next.page, font, 'Rate', 8, COL.rateCenter, next.y - 13, ON_GREEN);
  drawCentered(next.page, font, 'Amount', 8, COL.amountCenter, next.y - 13, ON_GREEN);
  next = gap(next, 22);

  invoice.items.forEach((item, index) => {
    next = tableRow(next, doc, font, draw, item, index + 1);
  });

  next = gap(next, 8);
  next = hairline(next);
  next = gap(next, 12);

  const summary: Array<[string, string]> = [];
  if (invoice.discountPaise !== 0) {
    summary.push(['Discount', draw.money(-Math.abs(invoice.discountPaise))]);
  }
  summary.push(['Taxable value', draw.money(invoice.taxablePaise)]);
  if (invoice.isInterState || invoice.igstPaise !== 0) {
    summary.push([
      uniformRate != null ? `IGST (${trimRate(uniformRate / 100)}%)` : 'IGST',
      draw.money(invoice.igstPaise),
    ]);
  } else if (vendor.gstRegistrationType !== 'composition') {
    summary.push(
      [halfRate ? `CGST (${halfRate})` : 'CGST', draw.money(invoice.cgstPaise)],
      [halfRate ? `SGST (${halfRate})` : 'SGST', draw.money(invoice.sgstPaise)],
    );
  }
  if (invoice.roundOffPaise !== 0) {
    summary.push(['Round off', draw.money(invoice.roundOffPaise)]);
  }

  for (const [label, value] of summary) {
    next = summaryRow(next, doc, font, label, value);
  }

  next = room(next, doc, 34);
  next.page.drawRectangle({
    x: MARGIN,
    y: next.y - 28,
    width: CONTENT_WIDTH,
    height: 28,
    color: GREEN_SOFT,
  });
  next.page.drawText('Total Amount', {
    x: MARGIN + 10,
    y: next.y - 18,
    size: 11,
    font,
    color: GREEN,
  });
  drawRight(next.page, font, draw.money(invoice.totalPaise), 13, COL.amountRight, next.y - 19, GREEN);
  next = gap(next, 36);

  if (invoice.notes) {
    next = writeLine(next, doc, font, 'Notes', 9, MUTED, 12);
    for (const line of wrap(font, draw.text(invoice.notes), 10, CONTENT_WIDTH - 8)) {
      next = writeLine(next, doc, font, line, 10, INK, 13);
    }
    next = gap(next, 6);
  }

  next = writeLine(next, doc, font, 'Thank you for your purchase!', 9, GREEN, 16);

  return next;
}

function formatVendorAddress(vendor: Vendor): string {
  return [vendor.addressLine1, vendor.addressLine2, vendor.city, stateLabel(vendor.stateCode), 'India']
    .filter(Boolean)
    .join(', ');
}

function uniformGstRateBps(items: readonly InvoiceItem[]): number | null {
  if (items.length === 0) {
    return null;
  }
  const first = items[0]?.gstRateBps;
  if (first == null) {
    return null;
  }
  return items.every((item) => item.gstRateBps === first) ? first : null;
}

function trimRate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function formatInvoiceDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function createDrawer(font: PDFFont): Drawer {
  const supported = new Set(font.getCharacterSet());
  const rupee = supported.has(0x20b9);

  function text(value: string): string {
    let result = '';
    for (const char of value) {
      const code = char.codePointAt(0);
      result += code !== undefined && supported.has(code) ? char : '?';
    }
    return result;
  }

  function money(paise: number): string {
    const label = paiseToRupeeLabel(paise);
    return text(rupee ? label : label.replace('₹', 'Rs '));
  }

  return { text, money };
}

function addPage(doc: PDFDocument): Cursor {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: WHITE,
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: GREEN,
  });
  return { page, y: PAGE_HEIGHT - MARGIN };
}

function room(cursor: Cursor, doc: PDFDocument, needed: number): Cursor {
  if (cursor.y - needed >= MARGIN) {
    return cursor;
  }
  return addPage(doc);
}

function gap(cursor: Cursor, amount: number): Cursor {
  return { page: cursor.page, y: cursor.y - amount };
}

function writeLine(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  value: string,
  size: number,
  color: Color,
  step: number,
): Cursor {
  const next = room(cursor, doc, step);
  next.page.drawText(value, {
    x: MARGIN,
    y: next.y - size,
    size,
    font,
    color,
  });
  return { page: next.page, y: next.y - step };
}

function hairline(cursor: Cursor): Cursor {
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
    thickness: 0.5,
    color: RULE,
  });
  return cursor;
}

function drawRight(
  page: PDFPage,
  font: PDFFont,
  value: string,
  size: number,
  right: number,
  y: number,
  color: Color,
) {
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: right - width, y, size, font, color });
}

function drawCentered(
  page: PDFPage,
  font: PDFFont,
  value: string,
  size: number,
  center: number,
  y: number,
  color: Color,
) {
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: center - width / 2, y, size, font, color });
}

function tableRow(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  draw: Drawer,
  item: InvoiceItem,
  index: number,
): Cursor {
  const name = draw.text(item.productNameSnapshot);
  const nameLines = wrap(font, name, 10, COL.qtyCenter - COL.item - 40);
  const unitLine = `${draw.money(item.unitPricePaise)} / ${draw.text(item.unitSnapshot)}`;
  const rowHeight = 10 + nameLines.length * 12 + 12;
  const next = room(cursor, doc, rowHeight + 6);
  const top = next.y - 10;

  next.page.drawText(String(index), {
    x: COL.index,
    y: top,
    size: 9,
    font,
    color: INK,
  });
  nameLines.forEach((line, lineIndex) => {
    next.page.drawText(line, {
      x: COL.item,
      y: top - lineIndex * 12,
      size: 10,
      font,
      color: INK,
    });
  });
  next.page.drawText(unitLine, {
    x: COL.item,
    y: top - nameLines.length * 12,
    size: 8,
    font,
    color: MUTED,
  });

  // Qty on a single line with unit — no Tax column. Qty / Rate / Amount centered.
  const qty = `${quantityMilliToText(item.quantityMilli)} ${draw.text(item.unitSnapshot)}`;
  drawCentered(next.page, font, qty, 9, COL.qtyCenter, top, INK);
  drawCentered(next.page, font, draw.money(item.unitPricePaise), 9, COL.rateCenter, top, INK);
  drawCentered(next.page, font, draw.money(item.lineTotalPaise), 9, COL.amountCenter, top, INK);

  const ruleY = top - nameLines.length * 12 - 12;
  next.page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: PAGE_WIDTH - MARGIN, y: ruleY },
    thickness: 0.4,
    color: RULE,
  });

  return { page: next.page, y: ruleY - 8 };
}

function summaryRow(
  cursor: Cursor,
  doc: PDFDocument,
  font: PDFFont,
  label: string,
  value: string,
): Cursor {
  const next = room(cursor, doc, 16);
  const y = next.y - 9;
  next.page.drawText(label, { x: 340, y, size: 9, font, color: MUTED });
  drawRight(next.page, font, value, 9, COL.amountRight, y, INK);
  return { page: next.page, y: y - 6 };
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const pieces = breakWord(font, word, size, maxWidth);
    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
        }
        current = piece;
      }
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function breakWord(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) {
    return [word];
  }
  const pieces: string[] = [];
  let current = '';
  for (const char of word) {
    const candidate = current + char;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        pieces.push(current);
      }
      current = char;
    }
  }
  if (current) {
    pieces.push(current);
  }
  return pieces;
}

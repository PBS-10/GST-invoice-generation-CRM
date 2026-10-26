import { quantityMilliToText, type InvoiceTotals } from '@invoice-gst/shared';
import type { InvoiceWithItems, Vendor } from '@invoice-gst/types';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../../../components/common/AppText';
import { Icon } from '../../../components/common/Icon';
import { stateLabel } from '../../../constants/states';
import type { InvoiceDraftState } from '../../../store/slices/invoiceDraftSlice';
import { useTheme } from '../../../theme/ThemeProvider';
import { radius, space } from '../../../theme/theme';
import { formatRupees, invoiceStatusLabel, paidByLabel } from '../../../utils/format';

/** Cream ticket stock — always paper-coloured so it pops on dark chrome. */
const paper = {
  sheet: '#F6F0E4',
  ink: '#1A2A22',
  brand: '#1F4D3A',
  muted: '#6A746C',
  rule: '#D9D2C3',
  header: '#1F4D3A',
  headerInk: '#F7F3EA',
  totalBand: '#CDE5D6',
  totalInk: '#1F4D3A',
  statusPaid: '#1F4D3A',
  statusPaidBg: '#D7E8DD',
  statusCancel: '#5E6A63',
  statusCancelBg: '#E5E1D7',
} as const;

const NOTCH = 11;
const layoutGutter = space[5];

export type ReceiptLine = {
  key: string;
  productName: string;
  unit: string;
  quantityMilli: number;
  unitPricePaise: number;
  gstRateBps: number;
  lineTotalPaise: number;
};

export type ReceiptTotals = {
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
};

export type ReceiptModel = {
  shopName: string;
  gstLabel: string;
  address: string;
  invoiceNumber: string;
  issuedAt: Date;
  customerName: string;
  placeOfSupplyStateCode: string;
  isInterState: boolean;
  lines: readonly ReceiptLine[];
  totals: ReceiptTotals;
  notes?: string | null;
  cancelled?: boolean;
  /** When fully paid — e.g. "Paid by Cash". Omitted on Review / unpaid. */
  paidBy?: string | null;
};

/**
 * Thermal / ticket-style invoice receipt used on Review, Detail, and mirrored in PDF.
 * Table columns: # · Item · Qty · Rate · Amount (no Tax; qty is a single line).
 */
export function InvoiceReceiptPaper({ receipt }: { receipt: ReceiptModel }) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const paperWidth = Math.min(windowWidth - layoutGutter * 2, 680);
  const notchCount = Math.max(10, Math.floor(paperWidth / (NOTCH + 6)));

  const placeName = stateLabel(receipt.placeOfSupplyStateCode);
  const uniformRateBps = uniformGstRateBps(receipt.lines);
  const halfRateLabel =
    uniformRateBps != null ? `${trimRate(uniformRateBps / 200)}%` : null;
  const metaPill = receiptMetaPill(receipt);

  return (
    <View style={[styles.wrap, { boxShadow: `0px 12px 32px ${colors.overlay}` }]}>
      <TicketEdge cutoutColor={colors.background} count={notchCount} edge="top" />
      <View style={styles.sheet}>
        <View style={styles.shopRow}>
          <View style={styles.shopIcon}>
            <Icon name="storefront" size={20} color={paper.headerInk} />
          </View>
          <View style={styles.shopText}>
            <Text variant="h3" style={styles.brand} numberOfLines={2}>
              {receipt.shopName}
            </Text>
            <Text variant="caption" style={styles.muted}>
              {receipt.gstLabel}
            </Text>
            {receipt.address ? (
              <Text variant="caption" style={styles.muted} numberOfLines={3}>
                {receipt.address}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaColumn}>
            <Text variant="label" style={styles.invoiceStamp}>
              INVOICE
            </Text>
            <Text variant="caption" style={styles.ink} tabular numberOfLines={1}>
              {receipt.invoiceNumber}
            </Text>
            <Text variant="caption" style={styles.muted} tabular>
              {formatReceiptDateTime(receipt.issuedAt)}
            </Text>
            {metaPill ? (
              <View style={[styles.statusPill, { backgroundColor: metaPill.bg }]}>
                <Text
                  variant="caption"
                  style={[styles.statusPillText, { color: metaPill.fg }]}
                >
                  {metaPill.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.hairline} />

        <View style={styles.partyRow}>
          <View style={styles.partyBlock}>
            <View style={styles.partyLabelRow}>
              <Icon name="person-outline" size={13} color={paper.muted} />
              <Text variant="caption" style={styles.muted}>
                Bill To
              </Text>
            </View>
            <Text variant="bodyMedium" style={styles.ink} numberOfLines={2}>
              {receipt.customerName}
            </Text>
          </View>
          <View style={[styles.partyBlock, styles.partyRight]}>
            <View style={[styles.partyLabelRow, styles.partyLabelEnd]}>
              <Icon name="navigate-outline" size={13} color={paper.muted} />
              <Text variant="caption" style={styles.muted}>
                Place of supply
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.ink} align="right" numberOfLines={2}>
              {placeName}
            </Text>
            <Text variant="caption" style={styles.muted} align="right">
              {receipt.isInterState ? 'Inter-State · IGST' : 'Intra-State · CGST + SGST'}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text variant="caption" style={[styles.headerCell, styles.colIndex]}>
              #
            </Text>
            <Text variant="caption" style={[styles.headerCell, styles.colItem]}>
              Item
            </Text>
            <Text variant="caption" style={[styles.headerCell, styles.colQty]} align="center">
              Qty
            </Text>
            <Text variant="caption" style={[styles.headerCell, styles.colRate]} align="center">
              Rate
            </Text>
            <Text variant="caption" style={[styles.headerCell, styles.colAmt]} align="center">
              Amount
            </Text>
          </View>

          {receipt.lines.map((line, index) => {
            const isLast = index === receipt.lines.length - 1;
            return (
              <View key={line.key} style={[styles.tableRow, isLast && styles.tableRowLast]}>
                <Text variant="caption" style={[styles.cell, styles.colIndex]} tabular>
                  {index + 1}
                </Text>
                <View style={styles.colItem}>
                  <Text variant="bodySmall" style={styles.ink} numberOfLines={2}>
                    {line.productName}
                  </Text>
                  <Text variant="caption" style={styles.muted} tabular numberOfLines={1}>
                    {formatRupees(line.unitPricePaise)} / {line.unit}
                  </Text>
                </View>
                <Text variant="caption" style={[styles.cell, styles.colQty]} align="center" tabular>
                  {quantityMilliToText(line.quantityMilli)} {line.unit}
                </Text>
                <Text variant="caption" style={[styles.cell, styles.colRate]} align="center" tabular>
                  {formatRupees(line.unitPricePaise)}
                </Text>
                <Text
                  variant="caption"
                  style={[styles.cell, styles.colAmt, receipt.cancelled && styles.strike]}
                  align="center"
                  tabular
                >
                  {formatRupees(line.lineTotalPaise)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totalsBlock}>
          {receipt.totals.discountPaise > 0 ? (
            <TotalsRow label="Discount" value={formatRupees(-receipt.totals.discountPaise)} />
          ) : null}
          <TotalsRow label="Taxable value" value={formatRupees(receipt.totals.taxablePaise)} />
          {receipt.isInterState || receipt.totals.igstPaise !== 0 ? (
            <TotalsRow
              label={
                uniformRateBps != null
                  ? `IGST (${trimRate(uniformRateBps / 100)}%)`
                  : 'IGST'
              }
              value={formatRupees(receipt.totals.igstPaise)}
            />
          ) : (
            <>
              <TotalsRow
                label={halfRateLabel ? `CGST (${halfRateLabel})` : 'CGST'}
                value={formatRupees(receipt.totals.cgstPaise)}
              />
              <TotalsRow
                label={halfRateLabel ? `SGST (${halfRateLabel})` : 'SGST'}
                value={formatRupees(receipt.totals.sgstPaise)}
              />
            </>
          )}
          {receipt.totals.roundOffPaise !== 0 ? (
            <TotalsRow label="Round off" value={formatRupees(receipt.totals.roundOffPaise)} />
          ) : null}
        </View>

        <View style={styles.totalBand}>
          <Text variant="bodyMedium" style={styles.totalLabel}>
            Total Amount
          </Text>
          <Text
            variant="h2"
            style={[styles.totalValue, receipt.cancelled && styles.strike]}
            tabular
          >
            {formatRupees(receipt.totals.totalPaise)}
          </Text>
        </View>

        {receipt.notes ? (
          <View style={styles.notesBlock}>
            <Text variant="caption" style={styles.muted}>
              Notes
            </Text>
            <Text variant="bodySmall" style={styles.ink}>
              {receipt.notes}
            </Text>
          </View>
        ) : null}

        <View style={styles.thanks}>
          <View style={styles.thanksRule} />
          <Icon name="leaf" size={12} color={paper.brand} />
          <Text variant="caption" style={styles.thanksText}>
            Thank you for your purchase!
          </Text>
          <Icon name="leaf" size={12} color={paper.brand} />
          <View style={styles.thanksRule} />
        </View>
      </View>
      <TicketEdge cutoutColor={colors.background} count={notchCount} edge="bottom" />
    </View>
  );
}

export function receiptFromDraft({
  vendor,
  draft,
  totals,
  isInterState,
  placeOfSupplyStateCode,
  invoiceNumber,
  issuedAt,
}: {
  vendor: Vendor;
  draft: InvoiceDraftState;
  totals: InvoiceTotals;
  isInterState: boolean;
  placeOfSupplyStateCode: string;
  invoiceNumber: string;
  issuedAt: Date;
}): ReceiptModel {
  return {
    shopName: vendor.tradeName || vendor.businessName,
    gstLabel: vendor.gstin ? `GSTIN ${vendor.gstin}` : 'Unregistered',
    address: formatVendorAddress(vendor),
    invoiceNumber,
    issuedAt,
    customerName: draft.customerSnapshot.name,
    placeOfSupplyStateCode,
    isInterState,
    lines: draft.lines.map((line, index) => ({
      key: line.key,
      productName: line.productName,
      unit: line.unit,
      quantityMilli: line.quantityMilli,
      unitPricePaise: line.unitPricePaise,
      gstRateBps: line.gstRateBps,
      lineTotalPaise: totals.lines[index]?.lineTotalPaise ?? 0,
    })),
    totals: {
      discountPaise: totals.discountPaise,
      taxablePaise: totals.taxablePaise,
      cgstPaise: totals.cgstPaise,
      sgstPaise: totals.sgstPaise,
      igstPaise: totals.igstPaise,
      roundOffPaise: totals.roundOffPaise,
      totalPaise: totals.totalPaise,
    },
    // Notes stay in the editor cards on Review; they print on the saved receipt / PDF.
    notes: null,
  };
}

export function receiptFromInvoice(vendor: Vendor, invoice: InvoiceWithItems): ReceiptModel {
  return {
    shopName: vendor.tradeName || vendor.businessName,
    gstLabel: vendor.gstin ? `GSTIN ${vendor.gstin}` : 'Unregistered',
    address: formatVendorAddress(vendor),
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: new Date(invoice.finalizedAt ?? invoice.createdAt),
    customerName: invoice.customerSnapshot.name,
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
    isInterState: invoice.isInterState,
    lines: invoice.items.map((item) => ({
      key: item.id,
      productName: item.productNameSnapshot,
      unit: item.unitSnapshot,
      quantityMilli: item.quantityMilli,
      unitPricePaise: item.unitPricePaise,
      gstRateBps: item.gstRateBps,
      lineTotalPaise: item.lineTotalPaise,
    })),
    totals: {
      discountPaise: invoice.discountPaise,
      taxablePaise: invoice.taxablePaise,
      cgstPaise: invoice.cgstPaise,
      sgstPaise: invoice.sgstPaise,
      igstPaise: invoice.igstPaise,
      roundOffPaise: invoice.roundOffPaise,
      totalPaise: invoice.totalPaise,
    },
    notes: invoice.notes,
    cancelled: invoice.status === 'cancelled',
    paidBy:
      invoice.status !== 'cancelled' && invoice.paymentStatus === 'paid'
        ? paidByLabel(invoice.payments) ?? 'Paid'
        : null,
  };
}

function receiptMetaPill(
  receipt: ReceiptModel,
): { label: string; fg: string; bg: string } | null {
  if (receipt.cancelled) {
    return {
      label: invoiceStatusLabel.cancelled,
      fg: paper.statusCancel,
      bg: paper.statusCancelBg,
    };
  }
  if (receipt.paidBy) {
    return {
      label: receipt.paidBy,
      fg: paper.statusPaid,
      bg: paper.statusPaidBg,
    };
  }
  return null;
}

function TotalsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalsRow}>
      <Text variant="caption" style={styles.muted}>
        {label}
      </Text>
      <Text variant="caption" style={styles.ink} tabular>
        {value}
      </Text>
    </View>
  );
}

function TicketEdge({
  cutoutColor,
  count,
  edge,
}: {
  cutoutColor: string;
  count: number;
  edge: 'top' | 'bottom';
}) {
  return (
    <View
      style={[styles.edgeRail, edge === 'top' ? styles.edgeTop : styles.edgeBottom]}
      pointerEvents="none"
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={[
            styles.notch,
            {
              backgroundColor: cutoutColor,
              marginTop: edge === 'top' ? -NOTCH / 2 : undefined,
              marginBottom: edge === 'bottom' ? -NOTCH / 2 : undefined,
            },
          ]}
        />
      ))}
    </View>
  );
}

function formatVendorAddress(vendor: Vendor): string {
  return [vendor.addressLine1, vendor.addressLine2, vendor.city, stateLabel(vendor.stateCode), 'India']
    .filter(Boolean)
    .join(', ');
}

function uniformGstRateBps(lines: readonly ReceiptLine[]): number | null {
  if (lines.length === 0) {
    return null;
  }
  const first = lines[0]?.gstRateBps;
  if (first == null) {
    return null;
  }
  return lines.every((line) => line.gstRateBps === first) ? first : null;
}

function trimRate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

const receiptDateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatReceiptDateTime(date: Date): string {
  return Number.isNaN(date.getTime()) ? '—' : receiptDateTime.format(date);
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.large,
    backgroundColor: paper.sheet,
  },
  sheet: {
    backgroundColor: paper.sheet,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[1],
    gap: space[3],
  },
  edgeRail: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    height: NOTCH / 2,
    backgroundColor: paper.sheet,
    zIndex: 2,
  },
  edgeTop: {
    borderTopLeftRadius: radius.large,
    borderTopRightRadius: radius.large,
  },
  edgeBottom: {
    borderBottomLeftRadius: radius.large,
    borderBottomRightRadius: radius.large,
  },
  notch: {
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  shopIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.small,
    backgroundColor: paper.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  metaColumn: {
    alignItems: 'flex-end',
    gap: 3,
    maxWidth: '40%',
  },
  invoiceStamp: {
    color: paper.brand,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  statusPill: {
    marginTop: 2,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontWeight: '700',
    fontSize: 11,
  },
  brand: {
    color: paper.brand,
  },
  ink: {
    color: paper.ink,
  },
  muted: {
    color: paper.muted,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.rule,
  },
  partyRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  partyBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  partyRight: {
    alignItems: 'flex-end',
  },
  partyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partyLabelEnd: {
    justifyContent: 'flex-end',
  },
  table: {
    borderRadius: radius.small,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.rule,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: paper.header,
    paddingHorizontal: space[2],
    paddingVertical: 7,
    gap: 4,
  },
  headerCell: {
    color: paper.headerInk,
    fontWeight: '700',
    fontSize: 11,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    backgroundColor: paper.sheet,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.rule,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    color: paper.ink,
    fontSize: 11,
  },
  colIndex: { width: 18 },
  colItem: { flex: 1.5, minWidth: 0, gap: 1 },
  colQty: { width: 58 },
  colRate: { width: 62 },
  colAmt: { width: 62 },
  strike: {
    textDecorationLine: 'line-through',
  },
  totalsBlock: {
    gap: 6,
    paddingHorizontal: space[1],
    paddingTop: space[1],
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[3],
  },
  totalBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    backgroundColor: paper.totalBand,
    marginHorizontal: -space[4],
    paddingHorizontal: space[4],
    paddingVertical: space[3] + 2,
  },
  totalLabel: {
    color: paper.totalInk,
    fontWeight: '700',
  },
  totalValue: {
    color: paper.totalInk,
    fontWeight: '700',
  },
  notesBlock: {
    gap: 4,
    paddingHorizontal: space[1],
  },
  thanks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  thanksRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.rule,
    maxWidth: 36,
  },
  thanksText: {
    color: paper.brand,
    fontWeight: '500',
  },
});

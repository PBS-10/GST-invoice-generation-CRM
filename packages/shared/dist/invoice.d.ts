export declare function getFinancialYear(date?: Date): string;
/**
 * GST Rule 46: invoice number max 16 characters.
 * Format: `{prefix}{series}/{FY}/{seq:5}` e.g. `INVA/25-26/00001`.
 * Legacy 3-arg form (no series) still pads to 6 digits for older callers/tests.
 */
export declare function formatInvoiceNumber(prefix: string, financialYearOrSeries: string, sequenceOrFinancialYear: number | string, sequenceMaybe?: number): string;
export declare function parseInvoiceSequence(invoiceNumber: string, prefix: string, seriesCode: string): number | null;
export declare function resolvePlaceOfSupply(vendorStateCode: string, customerStateCode: string | null): {
    placeOfSupplyStateCode: string;
    isInterState: boolean;
};
export declare function paymentStatusFromAmounts(totalPaise: number, paidPaise: number): 'unpaid' | 'partial' | 'paid';

export type RoundingMode = 'nearest' | 'up' | 'down';
export type InvoiceLineInput = {
    quantityMilli: number;
    unitPricePaise: number;
    gstRateBps: number;
    priceInclusive: boolean;
    lineDiscountPaise: number;
};
export type InvoiceCalcInput = {
    lines: InvoiceLineInput[];
    invoiceDiscountPaise: number;
    isInterState: boolean;
    roundingMode: RoundingMode;
    compositionScheme: boolean;
};
export type InvoiceLineResult = {
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    lineTotalPaise: number;
};
export type InvoiceTotals = {
    subtotalPaise: number;
    discountPaise: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    roundOffPaise: number;
    totalPaise: number;
    lines: InvoiceLineResult[];
};

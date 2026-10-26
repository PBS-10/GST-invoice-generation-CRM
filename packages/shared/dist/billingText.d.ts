/**
 * Turns a typed shop line into catalogue draft fields.
 * A stated price is the amount for the whole quantity ("2 kg rice 100 rupees"
 * is ₹100 for 2 kg). "at" or "per" marks a unit rate instead.
 * No speech model and no network.
 */
export type BillingUnit = 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'packet';
export type ExtractedLine = {
    productText: string;
    quantityMilli: number | null;
    unit: BillingUnit | null;
    pricePaise: number | null;
    priceIsUnit: boolean;
};
export type BillingCatalogProduct = {
    id: string;
    name: string;
    localName: string | null;
    aliases: string[];
    hsnCode: string | null;
    unit: string;
    sellingPricePaise: number;
    gstRateBps: number;
    priceInclusive: boolean;
};
export type MatchedBillingLine = {
    productId: string;
    productName: string;
    localName: string | null;
    hsnCode: string | null;
    unit: string;
    quantityMilli: number;
    unitPricePaise: number;
    gstRateBps: number;
    priceInclusive: boolean;
};
export type BillingMatch = {
    ok: true;
    priced: boolean;
    line: MatchedBillingLine;
} | {
    ok: false;
    productText: string;
    reason: 'not_found' | 'ambiguous' | 'unit';
};
export declare function extractBillingText(text: string): ExtractedLine[];
export declare function matchBillingLine(line: ExtractedLine, catalog: BillingCatalogProduct[]): BillingMatch;

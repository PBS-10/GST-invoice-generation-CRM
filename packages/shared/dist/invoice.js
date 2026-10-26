"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinancialYear = getFinancialYear;
exports.formatInvoiceNumber = formatInvoiceNumber;
exports.parseInvoiceSequence = parseInvoiceSequence;
exports.resolvePlaceOfSupply = resolvePlaceOfSupply;
exports.paymentStatusFromAmounts = paymentStatusFromAmounts;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MAX_INVOICE_NUMBER_LENGTH = 16;
const DEFAULT_SERIES = 'A';
function getFinancialYear(date = new Date()) {
    const ist = new Date(date.getTime() + IST_OFFSET_MS);
    const year = ist.getUTCFullYear();
    const month = ist.getUTCMonth();
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}
/**
 * GST Rule 46: invoice number max 16 characters.
 * Format: `{prefix}{series}/{FY}/{seq:5}` e.g. `INVA/25-26/00001`.
 * Legacy 3-arg form (no series) still pads to 6 digits for older callers/tests.
 */
function formatInvoiceNumber(prefix, financialYearOrSeries, sequenceOrFinancialYear, sequenceMaybe) {
    if (typeof sequenceOrFinancialYear === 'number' && sequenceMaybe === undefined) {
        const financialYear = financialYearOrSeries;
        const sequence = sequenceOrFinancialYear;
        return `${prefix}/${financialYear}/${String(sequence).padStart(6, '0')}`;
    }
    const seriesCode = financialYearOrSeries || DEFAULT_SERIES;
    const financialYear = String(sequenceOrFinancialYear);
    const sequence = sequenceMaybe ?? 0;
    const number = `${prefix}${seriesCode}/${financialYear}/${String(sequence).padStart(5, '0')}`;
    if (number.length > MAX_INVOICE_NUMBER_LENGTH) {
        throw new Error(`Invoice number "${number}" is ${number.length} characters; GST allows at most ${MAX_INVOICE_NUMBER_LENGTH}`);
    }
    return number;
}
function parseInvoiceSequence(invoiceNumber, prefix, seriesCode) {
    const expectedHead = `${prefix}${seriesCode}/`;
    if (!invoiceNumber.startsWith(expectedHead)) {
        return null;
    }
    const rest = invoiceNumber.slice(expectedHead.length);
    const match = /^[0-9]{2}-[0-9]{2}\/([0-9]+)$/.exec(rest);
    if (!match) {
        return null;
    }
    const sequence = Number(match[1]);
    return Number.isFinite(sequence) ? sequence : null;
}
function resolvePlaceOfSupply(vendorStateCode, customerStateCode) {
    if (customerStateCode == null || customerStateCode.length === 0) {
        return { placeOfSupplyStateCode: vendorStateCode, isInterState: false };
    }
    return {
        placeOfSupplyStateCode: customerStateCode,
        isInterState: customerStateCode !== vendorStateCode,
    };
}
function paymentStatusFromAmounts(totalPaise, paidPaise) {
    if (paidPaise <= 0) {
        return 'unpaid';
    }
    if (paidPaise >= totalPaise) {
        return 'paid';
    }
    return 'partial';
}

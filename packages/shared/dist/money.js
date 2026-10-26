"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundDiv = roundDiv;
exports.mulDiv = mulDiv;
exports.roundToRupee = roundToRupee;
exports.paiseToRupeeLabel = paiseToRupeeLabel;
exports.rupeesTextToPaise = rupeesTextToPaise;
exports.quantityMilliToText = quantityMilliToText;
exports.quantityTextToMilli = quantityTextToMilli;
function roundDiv(numerator, denominator, mode) {
    if (denominator === 0n) {
        throw new Error('Division by zero');
    }
    const negative = numerator < 0n !== denominator < 0n;
    const n = numerator < 0n ? -numerator : numerator;
    const d = denominator < 0n ? -denominator : denominator;
    const quotient = n / d;
    const remainder = n % d;
    if (remainder === 0n) {
        return negative ? -quotient : quotient;
    }
    if (mode === 'down') {
        return negative ? -quotient : quotient;
    }
    if (mode === 'up') {
        const rounded = quotient + 1n;
        return negative ? -rounded : rounded;
    }
    const rounded = remainder * 2n >= d ? quotient + 1n : quotient;
    return negative ? -rounded : rounded;
}
function mulDiv(amount, multiplier, divisor, mode) {
    return Number(roundDiv(BigInt(amount) * BigInt(multiplier), BigInt(divisor), mode));
}
function roundToRupee(paise, mode) {
    const rupees = roundDiv(BigInt(paise), 100n, mode);
    return Number(rupees * 100n);
}
function paiseToRupeeLabel(paise) {
    const sign = paise < 0 ? '-' : '';
    const absolute = Math.abs(paise);
    const rupees = Math.floor(absolute / 100);
    const remainder = String(absolute % 100).padStart(2, '0');
    return `${sign}₹${rupees}.${remainder}`;
}
function rupeesTextToPaise(text) {
    const trimmed = text.trim();
    const negative = trimmed.startsWith('-');
    const raw = negative ? trimmed.slice(1) : trimmed;
    const [rupeesPart = '0', paisePart = '0'] = raw.split('.');
    const paise = Number(rupeesPart) * 100 + Number(paisePart.padEnd(2, '0').slice(0, 2));
    return negative ? -paise : paise;
}
function quantityMilliToText(quantityMilli) {
    if (quantityMilli % 1000 === 0) {
        return String(quantityMilli / 1000);
    }
    const text = (quantityMilli / 1000).toFixed(3);
    return text.replace(/\.?0+$/, '');
}
function quantityTextToMilli(text) {
    const value = Number(text.trim());
    if (!Number.isFinite(value) || value < 0) {
        throw new Error('Invalid quantity');
    }
    return Math.round(value * 1000);
}

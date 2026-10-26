import type { RoundingMode } from './gst/types';
export declare function roundDiv(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint;
export declare function mulDiv(amount: number, multiplier: number, divisor: number, mode: RoundingMode): number;
export declare function roundToRupee(paise: number, mode: RoundingMode): number;
export declare function paiseToRupeeLabel(paise: number): string;
export declare function rupeesTextToPaise(text: string): number;
export declare function quantityMilliToText(quantityMilli: number): string;
export declare function quantityTextToMilli(text: string): number;

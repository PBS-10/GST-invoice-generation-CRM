import { mulDiv, roundToRupee } from '../money';
import type {
  InvoiceCalcInput,
  InvoiceLineResult,
  InvoiceTotals,
} from './types';

function lineGrossPaise(quantityMilli: number, unitPricePaise: number): number {
  return mulDiv(quantityMilli, unitPricePaise, 1000, 'nearest');
}

function allocateDiscount(totalDiscount: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalDiscount <= 0 || weightSum <= 0) {
    return weights.map(() => 0);
  }

  const rawShares = weights.map((weight) => (totalDiscount * weight) / weightSum);
  const floors = rawShares.map((share) => Math.floor(share));
  let remainder = totalDiscount - floors.reduce((sum, value) => sum + value, 0);

  const order = rawShares
    .map((share, index) => ({ index, fraction: share - floors[index]! }))
    .sort((left, right) => right.fraction - left.fraction);

  const allocated = [...floors];
  for (const { index } of order) {
    if (remainder <= 0) {
      break;
    }
    allocated[index] = (allocated[index] ?? 0) + 1;
    remainder -= 1;
  }

  return allocated;
}

function splitIntraStateTax(taxPaise: number): { cgstPaise: number; sgstPaise: number } {
  const cgstPaise = Math.floor(taxPaise / 2);
  return { cgstPaise, sgstPaise: taxPaise - cgstPaise };
}

function taxableFromInclusive(lineNetPaise: number, gstRateBps: number): number {
  return mulDiv(lineNetPaise, 10_000, 10_000 + gstRateBps, 'nearest');
}

export function calculateInvoiceTotals(input: InvoiceCalcInput): InvoiceTotals {
  const lineNets = input.lines.map((line) => {
    const gross = lineGrossPaise(line.quantityMilli, line.unitPricePaise);
    return Math.max(0, gross - Math.max(0, line.lineDiscountPaise));
  });

  const preDiscountTaxables = input.lines.map((line, index) => {
    const net = lineNets[index] ?? 0;
    if (input.compositionScheme) {
      return net;
    }
    if (line.priceInclusive && line.gstRateBps > 0) {
      return taxableFromInclusive(net, line.gstRateBps);
    }
    return net;
  });

  const subtotalPaise = lineNets.reduce((sum, value) => sum + value, 0);
  const discountPaise = Math.min(
    Math.max(0, input.invoiceDiscountPaise),
    preDiscountTaxables.reduce((sum, value) => sum + value, 0),
  );
  const allocated = allocateDiscount(discountPaise, preDiscountTaxables);

  const lines: InvoiceLineResult[] = input.lines.map((line, index) => {
    const taxablePaise = Math.max(0, (preDiscountTaxables[index] ?? 0) - (allocated[index] ?? 0));

    if (input.compositionScheme) {
      return {
        taxablePaise,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        lineTotalPaise: taxablePaise,
      };
    }

    const taxPaise = mulDiv(taxablePaise, line.gstRateBps, 10_000, 'nearest');

    if (input.isInterState) {
      return {
        taxablePaise,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: taxPaise,
        lineTotalPaise: taxablePaise + taxPaise,
      };
    }

    const { cgstPaise, sgstPaise } = splitIntraStateTax(taxPaise);
    return {
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      lineTotalPaise: taxablePaise + cgstPaise + sgstPaise,
    };
  });

  const taxablePaise = lines.reduce((sum, line) => sum + line.taxablePaise, 0);
  const cgstPaise = lines.reduce((sum, line) => sum + line.cgstPaise, 0);
  const sgstPaise = lines.reduce((sum, line) => sum + line.sgstPaise, 0);
  const igstPaise = lines.reduce((sum, line) => sum + line.igstPaise, 0);
  const rawTotal = taxablePaise + cgstPaise + sgstPaise + igstPaise;
  const totalPaise = roundToRupee(rawTotal, input.roundingMode);
  const roundOffPaise = totalPaise - rawTotal;

  return {
    subtotalPaise,
    discountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    roundOffPaise,
    totalPaise,
    lines,
  };
}

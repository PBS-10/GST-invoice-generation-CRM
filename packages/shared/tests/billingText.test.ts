import { describe, expect, it } from 'vitest';
import { extractBillingText, matchBillingLine, type BillingCatalogProduct } from '../src/billingText';

const rice: BillingCatalogProduct = {
  id: 'rice-1',
  name: 'Rice',
  localName: 'അരി',
  aliases: ['rice', 'ari', 'അരി'],
  hsnCode: '1006',
  unit: 'kg',
  sellingPricePaise: 5000,
  gstRateBps: 500,
  priceInclusive: false,
};

describe('extractBillingText', () => {
  it('reads a typed shop line as quantity, unit, product, and line price', () => {
    expect(extractBillingText('2 kg rice 100 rupees')).toEqual([
      {
        productText: 'rice',
        quantityMilli: 2000,
        unit: 'kg',
        pricePaise: 10_000,
        priceIsUnit: false,
      },
    ]);
  });

  it('reads the spoken English form from the ML plan', () => {
    expect(extractBillingText('two kilo ari one hundred rupees')).toEqual([
      {
        productText: 'ari',
        quantityMilli: 2000,
        unit: 'kg',
        pricePaise: 10_000,
        priceIsUnit: false,
      },
    ]);
  });

  it('reads a short spoken English line typical of OS STT', () => {
    expect(extractBillingText('two kg rice hundred rupees')).toEqual([
      {
        productText: 'rice',
        quantityMilli: 2000,
        unit: 'kg',
        pricePaise: 10_000,
        priceIsUnit: false,
      },
    ]);
  });

  it('reads the Malayalam form from the ML plan', () => {
    expect(extractBillingText('രണ്ട് കിലോ അരി നൂറ് രൂപ')).toEqual([
      {
        productText: 'അരി',
        quantityMilli: 2000,
        unit: 'kg',
        pricePaise: 10_000,
        priceIsUnit: false,
      },
    ]);
  });

  it('treats "at" or "per" as a unit price', () => {
    expect(extractBillingText('2 kg rice at 100 rupees')[0]?.priceIsUnit).toBe(true);
    expect(extractBillingText('2 kg rice 100 per kg')[0]).toMatchObject({
      pricePaise: 10_000,
      priceIsUnit: true,
      unit: 'kg',
    });
  });

  it('splits two items on a comma', () => {
    const lines = extractBillingText('2 kg rice 100 rupees, 1 packet sugar');
    expect(lines.map((line) => line.productText)).toEqual(['rice', 'sugar']);
    expect(lines[1]).toMatchObject({ quantityMilli: 1000, unit: 'packet', pricePaise: null });
  });
});

describe('matchBillingLine', () => {
  it('matches an alias and turns a line price into a unit price', () => {
    const [line] = extractBillingText('2 kg rice 100 rupees');
    expect(line).toBeDefined();
    const matched = matchBillingLine(line!, [rice]);
    expect(matched).toEqual({
      ok: true,
      priced: true,
      line: {
        productId: 'rice-1',
        productName: 'Rice',
        localName: 'അരി',
        hsnCode: '1006',
        unit: 'kg',
        quantityMilli: 2000,
        unitPricePaise: 5000,
        gstRateBps: 500,
        priceInclusive: false,
      },
    });
  });

  it('keeps the catalogue price when the text has no amount', () => {
    const [line] = extractBillingText('2 kg ari');
    const matched = matchBillingLine(line!, [rice]);
    expect(matched.ok).toBe(true);
    if (matched.ok) {
      expect(matched.priced).toBe(false);
      expect(matched.line.unitPricePaise).toBe(5000);
      expect(matched.line.quantityMilli).toBe(2000);
    }
  });

  it('converts grams into the product kilogram unit', () => {
    const [line] = extractBillingText('500 g rice');
    const matched = matchBillingLine(line!, [rice]);
    expect(matched.ok).toBe(true);
    if (matched.ok) {
      expect(matched.line.quantityMilli).toBe(500);
      expect(matched.line.unit).toBe('kg');
    }
  });

  it('uses a stated unit price as the rate', () => {
    const [line] = extractBillingText('2 kg rice at 80 rupees');
    const matched = matchBillingLine(line!, [rice]);
    expect(matched.ok).toBe(true);
    if (matched.ok) {
      expect(matched.line.unitPricePaise).toBe(8000);
      expect(matched.line.quantityMilli).toBe(2000);
    }
  });

  it('refuses to guess when two products share the alias', () => {
    const other: BillingCatalogProduct = { ...rice, id: 'rice-2', name: 'Boiled rice' };
    const [line] = extractBillingText('2 kg ari');
    const matched = matchBillingLine(line!, [rice, other]);
    expect(matched.ok).toBe(false);
    if (!matched.ok) {
      expect(matched.reason).toBe('ambiguous');
      expect(matched.productText).toBe('ari');
      expect(matched.candidates.map((product) => product.id).sort()).toEqual(['rice-1', 'rice-2']);
    }
  });

  it('reports a product the catalogue does not have', () => {
    const [line] = extractBillingText('1 kg sugar');
    const matched = matchBillingLine(line!, [rice]);
    expect(matched.ok).toBe(false);
    if (!matched.ok) {
      expect(matched.reason).toBe('not_found');
      expect(matched.productText).toBe('sugar');
      expect(matched.candidates).toEqual([]);
    }
  });

  it('asks for quantity when the product matches but no amount was spoken', () => {
    const [line] = extractBillingText('ari');
    const matched = matchBillingLine(line!, [rice]);
    expect(matched.ok).toBe(false);
    if (!matched.ok) {
      expect(matched.reason).toBe('need_quantity');
      expect(matched.candidates[0]?.id).toBe('rice-1');
    }
  });

  it('flags incompatible units and suggests the spoken count in the product unit', () => {
    const milk: BillingCatalogProduct = {
      ...rice,
      id: 'milk-1',
      name: 'Milk',
      localName: null,
      aliases: ['milk'],
      unit: 'packet',
    };
    const [line] = extractBillingText('2 kg milk');
    const matched = matchBillingLine(line!, [milk]);
    expect(matched.ok).toBe(false);
    if (!matched.ok) {
      expect(matched.reason).toBe('unit');
      expect(matched.spokenUnit).toBe('kg');
      expect(matched.suggestedQuantityMilli).toBe(2000);
      expect(matched.candidates[0]?.unit).toBe('packet');
    }
  });

  it('surfaces related products when STT truncates the name (o → Ooo)', () => {
    const ooo: BillingCatalogProduct = {
      ...rice,
      id: 'ooo-1',
      name: 'Ooo',
      localName: null,
      aliases: ['ooo'],
      unit: 'pcs',
    };
    const [line] = extractBillingText('o');
    const matched = matchBillingLine(line!, [ooo, rice]);
    expect(matched.ok).toBe(false);
    if (!matched.ok) {
      expect(matched.reason).toBe('related');
      expect(matched.candidates.some((product) => product.id === 'ooo-1')).toBe(true);
    }
  });

  it('reports not_found when nothing is related', () => {
    const [line] = extractBillingText('xyzzy');
    const matched = matchBillingLine(line!, [rice]);
    expect(matched.ok).toBe(false);
    if (!matched.ok) {
      expect(matched.reason).toBe('not_found');
      expect(matched.candidates).toEqual([]);
    }
  });
});

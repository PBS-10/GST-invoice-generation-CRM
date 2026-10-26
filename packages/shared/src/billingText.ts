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

export type BillingMatchFailureReason =
  | 'not_found'
  | 'ambiguous'
  | 'related'
  | 'unit'
  | 'need_quantity';

export type BillingMatchFailure = {
  ok: false;
  productText: string;
  reason: BillingMatchFailureReason;
  /** Original parse — used when the clerk picks a product / quantity. */
  extracted: ExtractedLine;
  /** Ranked catalogue hits the UI can offer (empty when not_found). */
  candidates: BillingCatalogProduct[];
  spokenUnit: BillingUnit | null;
  spokenQuantityMilli: number | null;
  /**
   * Suggested quantity in the product's unit when the spoken unit does not
   * convert (e.g. "2 kg milk" sold by packet → suggest 2 packets).
   */
  suggestedQuantityMilli: number;
};

export type BillingMatch =
  | { ok: true; priced: boolean; line: MatchedBillingLine }
  | BillingMatchFailure;

const UNITS: Record<string, BillingUnit> = {
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  കിലോ: 'kg',
  किलो: 'kg',
  கிலோ: 'kg',
  g: 'g',
  gm: 'g',
  gms: 'g',
  gram: 'g',
  grams: 'g',
  ഗ്രാം: 'g',
  ग्राम: 'g',
  l: 'l',
  lt: 'l',
  ltr: 'l',
  litre: 'l',
  liter: 'l',
  litres: 'l',
  liters: 'l',
  ലിറ്റർ: 'l',
  लीटर: 'l',
  ml: 'ml',
  millilitre: 'ml',
  milliliter: 'ml',
  pcs: 'pcs',
  pc: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  nos: 'pcs',
  packet: 'packet',
  packets: 'packet',
  pkt: 'packet',
  pack: 'packet',
  പാക്കറ്റ്: 'packet',
  पैकेट: 'packet',
};

const PRICE_WORDS = new Set([
  'rupee',
  'rupees',
  'rs',
  'inr',
  'രൂപ',
  'रुपये',
  'रुपया',
  'रुपए',
  'ரூபாய்',
]);

const SMALL: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const INDIC_NUMBERS: Record<string, number> = {
  ഒന്ന്: 1,
  ഒരു: 1,
  രണ്ട്: 2,
  രണ്ടു: 2,
  മൂന്ന്: 3,
  മൂന്നു: 3,
  നാല്: 4,
  നാലു: 4,
  അഞ്ച്: 5,
  ആറ്: 6,
  ഏഴ്: 7,
  എട്ട്: 8,
  ഒൻപത്: 9,
  പത്ത്: 10,
  നൂറ്: 100,
  ആയിരം: 1000,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  सौ: 100,
  ஒன்று: 1,
  இரண்டு: 2,
  மூன்று: 3,
  நூறு: 100,
};

const FILLER = new Set(['of', 'the']);

function fold(token: string): string {
  return token.normalize('NFC').toLowerCase();
}

function unitOf(token: string): BillingUnit | null {
  return UNITS[fold(token)] ?? null;
}

function isPriceWord(token: string): boolean {
  return PRICE_WORDS.has(fold(token));
}

function readEnglish(tokens: string[], start: number): { value: number; next: number } | null {
  let index = start;
  let total = 0;
  let saw = false;
  const word = fold(tokens[index] ?? '');
  const head = SMALL[word];

  if (head !== undefined && head < 10 && fold(tokens[index + 1] ?? '') === 'hundred') {
    total = head * 100;
    index += 2;
    saw = true;
  } else if (word === 'hundred' || (word === 'a' && fold(tokens[index + 1] ?? '') === 'hundred')) {
    total = 100;
    index += word === 'a' ? 2 : 1;
    saw = true;
  }

  const tens = SMALL[fold(tokens[index] ?? '')];
  if (tens !== undefined && tens >= 20 && tens % 10 === 0) {
    total += tens;
    index += 1;
    saw = true;
    const ones = SMALL[fold(tokens[index] ?? '')];
    if (ones !== undefined && ones < 10 && fold(tokens[index + 1] ?? '') !== 'hundred') {
      total += ones;
      index += 1;
    }
  } else if (tens !== undefined && tens < 20) {
    total += tens;
    index += 1;
    saw = true;
  } else if (!saw && head !== undefined) {
    return { value: head, next: start + 1 };
  }

  return saw ? { value: total, next: index } : null;
}

function readNumber(tokens: string[], start: number): { value: number; next: number } | null {
  const token = tokens[start];
  if (!token) {
    return null;
  }
  if (/^\d+(?:\.\d+)?$/.test(token)) {
    return { value: Number(token), next: start + 1 };
  }
  const indic = INDIC_NUMBERS[fold(token)];
  if (indic !== undefined) {
    return { value: indic, next: start + 1 };
  }
  return readEnglish(tokens, start);
}

function explodeToken(raw: string): string[] {
  const glued = raw.match(/^(\d+(?:\.\d+)?)(.+)$/);
  if (glued?.[1] && glued[2] && (unitOf(glued[2]) || isPriceWord(glued[2]))) {
    return [glued[1], glued[2]];
  }
  const prefixed = raw.match(/^(?:rs\.?|inr)(\d+(?:\.\d+)?)$/i);
  if (prefixed?.[1]) {
    return ['rupees', prefixed[1]];
  }
  return [raw];
}

function splitClauses(text: string): string[] {
  const clauses: string[] = [];
  for (const line of text.split(/\n+|;\s*/)) {
    for (const part of line.split(/,(?!\d)/)) {
      const pieces = part.split(/\s+(?:and|plus)\s+/i);
      const numeric = (value: string) =>
        /\d/.test(value) ||
        /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|രണ്ട്|ഒരു|നൂറ്)\b/i.test(value);
      if (pieces.length > 1 && pieces.every((piece) => numeric(piece))) {
        clauses.push(...pieces);
      } else {
        clauses.push(part);
      }
    }
  }
  return clauses.map((clause) => clause.trim()).filter(Boolean);
}

function parseClause(clause: string): ExtractedLine | null {
  const tokens = clause
    .split(/\s+/)
    .flatMap(explodeToken)
    .map((token) => token.replace(/^[.,]+|[.,]+$/g, ''))
    .filter(Boolean);

  const product: string[] = [];
  let quantityMilli: number | null = null;
  let unit: BillingUnit | null = null;
  let pricePaise: number | null = null;
  let priceIsUnit = false;
  let bare: number | null = null;
  let marker: 'unit' | 'line' | null = null;

  const takePrice = (rupees: number, asUnit: boolean) => {
    pricePaise = Math.round(rupees * 100);
    priceIsUnit = asUnit;
    bare = null;
    marker = null;
  };

  const takeQuantity = (value: number, nextUnit: BillingUnit | null) => {
    quantityMilli = Math.round(value * 1000);
    if (nextUnit) {
      unit = nextUnit;
    }
    bare = null;
    marker = null;
  };

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? '';
    const folded = fold(token);
    const parsed = readNumber(tokens, index);

    if (parsed) {
      const next = tokens[parsed.next];
      const nextUnit = next ? unitOf(next) : null;
      const nextFold = next ? fold(next) : '';

      if (nextUnit && marker !== 'unit') {
        takeQuantity(parsed.value, nextUnit);
        index = parsed.next + 1;
        continue;
      }
      if (next && isPriceWord(next)) {
        takePrice(parsed.value, marker === 'unit');
        index = parsed.next + 1;
        continue;
      }
      if (nextFold === 'per' || nextFold === 'each') {
        takePrice(parsed.value, true);
        index = parsed.next + 1;
        const ratedUnit = tokens[index];
        if (ratedUnit && unitOf(ratedUnit)) {
          if (!unit) {
            unit = unitOf(ratedUnit);
          }
          index += 1;
        }
        continue;
      }
      if (marker === 'unit' || marker === 'line') {
        takePrice(parsed.value, marker === 'unit');
        index = parsed.next;
        continue;
      }
      if (bare !== null && quantityMilli === null) {
        takeQuantity(bare, null);
      }
      bare = parsed.value;
      index = parsed.next;
      continue;
    }

    if (isPriceWord(token)) {
      if (bare !== null && pricePaise === null) {
        takePrice(bare, marker === 'unit');
      } else if (pricePaise === null) {
        marker = 'line';
      }
      index += 1;
      continue;
    }

    const spokenUnit = unitOf(token);
    if (spokenUnit && bare !== null && quantityMilli === null && marker !== 'unit') {
      takeQuantity(bare, spokenUnit);
      index += 1;
      continue;
    }

    if (folded === 'at' || folded === '@') {
      marker = 'unit';
      index += 1;
      continue;
    }
    if (folded === 'for') {
      marker = 'line';
      index += 1;
      continue;
    }
    if (folded === 'per' || folded === 'each') {
      marker = 'unit';
      index += 1;
      continue;
    }
    if (!FILLER.has(folded)) {
      product.push(token);
    }
    index += 1;
  }

  if (bare !== null) {
    if (pricePaise === null && quantityMilli !== null) {
      takePrice(bare, marker === 'unit');
    } else if (quantityMilli === null) {
      takeQuantity(bare, null);
    }
  }

  const productText = product.join(' ').replace(/\s+/g, ' ').trim();
  if (!productText) {
    return null;
  }
  return { productText, quantityMilli, unit, pricePaise, priceIsUnit };
}

export function extractBillingText(text: string): ExtractedLine[] {
  const normalized = text
    .normalize('NFC')
    .replace(/₹/g, ' rupees ')
    .replace(/(\d)\s*\/-/g, '$1 rupees')
    .replace(/[।]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!normalized) {
    return [];
  }
  return splitClauses(normalized).flatMap((clause) => {
    const line = parseClause(clause);
    return line ? [line] : [];
  });
}

function norm(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function compact(value: string): string {
  return norm(value).replace(/\s/g, '');
}

/** Small Levenshtein for STT near-misses (e.g. "o" ↔ "ooo", "ric" ↔ "rice"). */
function editDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) {
    matrix[i]![0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[left.length]![right.length]!;
}

/**
 * Score how well a spoken/typed phrase matches a catalogue product.
 * Includes prefix + fuzzy scores so STT truncations like "o" for "Ooo" still
 * surface related products.
 */
function scoreProduct(query: string, product: BillingCatalogProduct): number {
  const needle = norm(query);
  if (!needle) {
    return 0;
  }
  const needleCompact = compact(needle);
  const fields = [product.name, product.localName ?? '', ...product.aliases]
    .map(norm)
    .filter(Boolean);

  let best = 0;
  for (const field of fields) {
    const fieldCompact = compact(field);
    if (!fieldCompact) {
      continue;
    }
    if (field === needle || fieldCompact === needleCompact) {
      return 100;
    }

    // Prefix: voice often clips the end ("o" → "ooo", "ric" → "rice").
    // 1–2 letter prefixes stay "related" (not auto-add) — STT truncations.
    if (fieldCompact.startsWith(needleCompact)) {
      if (needleCompact.length <= 2) {
        best = Math.max(best, needleCompact.length === 1 ? 28 : 35);
      } else {
        const ratio = needleCompact.length / fieldCompact.length;
        best = Math.max(best, Math.round(30 + ratio * 55));
      }
    } else if (needleCompact.startsWith(fieldCompact) && fieldCompact.length >= 2) {
      best = Math.max(best, 55);
    }

    if (
      needleCompact.length >= 2 &&
      (fieldCompact.includes(needleCompact) || needleCompact.includes(fieldCompact))
    ) {
      best = Math.max(best, 45);
    }

    // Fuzzy STT — keep short fields only (edit distance is O(n²)).
    if (fieldCompact.length <= 28 && needleCompact.length <= 28) {
      const distance = editDistance(needleCompact, fieldCompact);
      const maxLen = Math.max(needleCompact.length, fieldCompact.length);
      const similarity = maxLen === 0 ? 0 : 1 - distance / maxLen;
      const maxEdits =
        needleCompact.length <= 2 ? 2 : needleCompact.length <= 4 ? 2 : Math.ceil(maxLen * 0.35);
      if (distance <= maxEdits && similarity >= 0.4) {
        best = Math.max(best, Math.round(20 + similarity * 45));
      }
    }
  }

  // Drop noise — random 1-letter hits against long unrelated names stay out.
  return best >= 25 ? best : 0;
}

/** Strong enough to auto-add without asking (exact / clear substring). */
const STRONG_SCORE = 40;

/** Quantity in milli-units of `toUnit`, or null when the units are not the same measure. */
function convertQuantity(quantityMilli: number, fromUnit: string, toUnit: string): number | null {
  if (fromUnit === toUnit) {
    return quantityMilli;
  }
  const mass: Record<string, number> = { kg: 1, g: 1000 };
  const volume: Record<string, number> = { l: 1, ml: 1000 };
  const family = mass[fromUnit] ? mass : volume[fromUnit] ? volume : null;
  const targetScale = family?.[toUnit];
  const sourceScale = family?.[fromUnit];
  if (!family || targetScale === undefined || sourceScale === undefined) {
    return null;
  }
  return Math.round((quantityMilli * targetScale) / sourceScale);
}

const MAX_CANDIDATES = 8;

function failure(
  reason: BillingMatchFailureReason,
  line: ExtractedLine,
  candidates: BillingCatalogProduct[],
): BillingMatchFailure {
  const spokenQuantityMilli = line.quantityMilli;
  return {
    ok: false,
    productText: line.productText,
    reason,
    extracted: line,
    candidates: candidates.slice(0, MAX_CANDIDATES),
    spokenUnit: line.unit,
    spokenQuantityMilli,
    // Reuse the spoken count when units cannot convert (2 kg → 2 packets).
    suggestedQuantityMilli: Math.max(1000, spokenQuantityMilli ?? 1000),
  };
}

function buildMatchedLine(
  product: BillingCatalogProduct,
  quantityMilli: number,
  line: ExtractedLine,
): Extract<BillingMatch, { ok: true }> {
  const statedPaise = line.pricePaise;
  const unitPricePaise =
    statedPaise === null
      ? product.sellingPricePaise
      : line.priceIsUnit
        ? statedPaise
        : Math.round((statedPaise * 1000) / quantityMilli);

  return {
    ok: true,
    priced: statedPaise !== null,
    line: {
      productId: product.id,
      productName: product.name,
      localName: product.localName,
      hsnCode: product.hsnCode,
      unit: product.unit,
      quantityMilli,
      unitPricePaise,
      gstRateBps: product.gstRateBps,
      priceInclusive: product.priceInclusive,
    },
  };
}

/** Rank catalogue hits for a spoken / typed product phrase. */
export function rankBillingProducts(
  productText: string,
  catalog: BillingCatalogProduct[],
): Array<{ product: BillingCatalogProduct; score: number }> {
  return catalog
    .map((product) => ({ product, score: scoreProduct(productText, product) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

/**
 * Finish a match after the clerk picks a product (and optionally a quantity
 * in that product's unit). Used by the voice resolve sheet.
 */
export function completeBillingMatch(
  product: BillingCatalogProduct,
  line: ExtractedLine,
  quantityMilliOverride?: number,
): BillingMatch {
  if (quantityMilliOverride != null) {
    if (quantityMilliOverride <= 0) {
      return failure('need_quantity', line, [product]);
    }
    return buildMatchedLine(product, quantityMilliOverride, line);
  }

  let quantityMilli = line.quantityMilli ?? 1000;
  if (line.unit) {
    const converted = convertQuantity(quantityMilli, line.unit, product.unit);
    if (converted === null || converted <= 0) {
      return failure('unit', line, [product]);
    }
    quantityMilli = converted;
  }
  if (quantityMilli <= 0) {
    return failure('need_quantity', line, [product]);
  }
  return buildMatchedLine(product, quantityMilli, line);
}

export function matchBillingLine(line: ExtractedLine, catalog: BillingCatalogProduct[]): BillingMatch {
  const ranked = rankBillingProducts(line.productText, catalog);
  const best = ranked[0];
  if (!best) {
    return failure('not_found', line, []);
  }

  const spokenCompact = line.productText.normalize('NFC').trim().toLowerCase().replace(/\s/g, '');
  const shortSpoken = spokenCompact.length > 0 && spokenCompact.length < 3;
  // Fuzzy / short STT clips — always ask; never auto-add on a 1–2 letter guess.
  if (best.score < STRONG_SCORE || (shortSpoken && best.score < 90)) {
    return failure(
      'related',
      line,
      ranked.map((entry) => entry.product),
    );
  }

  // Exact / near-exact ties, or many weak substring hits → ask the clerk.
  const tied = ranked.filter((entry) => entry.score === best.score);
  const near = ranked.filter((entry) => entry.score >= best.score - 10);
  const weakCrowd = best.score < 90 && near.length > 1;
  if (tied.length > 1 || weakCrowd) {
    const candidates = (tied.length > 1 ? tied : near).map((entry) => entry.product);
    return failure('ambiguous', line, candidates);
  }

  const product = best.product;
  if (line.quantityMilli == null && line.unit == null) {
    // "milk" with no qty — confirm quantity in the product's unit.
    return failure('need_quantity', line, [product]);
  }

  return completeBillingMatch(product, line);
}

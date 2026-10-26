"use strict";
/**
 * Turns a typed shop line into catalogue draft fields.
 * A stated price is the amount for the whole quantity ("2 kg rice 100 rupees"
 * is ₹100 for 2 kg). "at" or "per" marks a unit rate instead.
 * No speech model and no network.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractBillingText = extractBillingText;
exports.matchBillingLine = matchBillingLine;
const UNITS = {
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
const SMALL = {
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
const INDIC_NUMBERS = {
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
function fold(token) {
    return token.normalize('NFC').toLowerCase();
}
function unitOf(token) {
    return UNITS[fold(token)] ?? null;
}
function isPriceWord(token) {
    return PRICE_WORDS.has(fold(token));
}
function readEnglish(tokens, start) {
    let index = start;
    let total = 0;
    let saw = false;
    const word = fold(tokens[index] ?? '');
    const head = SMALL[word];
    if (head !== undefined && head < 10 && fold(tokens[index + 1] ?? '') === 'hundred') {
        total = head * 100;
        index += 2;
        saw = true;
    }
    else if (word === 'hundred' || (word === 'a' && fold(tokens[index + 1] ?? '') === 'hundred')) {
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
    }
    else if (tens !== undefined && tens < 20) {
        total += tens;
        index += 1;
        saw = true;
    }
    else if (!saw && head !== undefined) {
        return { value: head, next: start + 1 };
    }
    return saw ? { value: total, next: index } : null;
}
function readNumber(tokens, start) {
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
function explodeToken(raw) {
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
function splitClauses(text) {
    const clauses = [];
    for (const line of text.split(/\n+|;\s*/)) {
        for (const part of line.split(/,(?!\d)/)) {
            const pieces = part.split(/\s+(?:and|plus)\s+/i);
            const numeric = (value) => /\d/.test(value) ||
                /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|രണ്ട്|ഒരു|നൂറ്)\b/i.test(value);
            if (pieces.length > 1 && pieces.every((piece) => numeric(piece))) {
                clauses.push(...pieces);
            }
            else {
                clauses.push(part);
            }
        }
    }
    return clauses.map((clause) => clause.trim()).filter(Boolean);
}
function parseClause(clause) {
    const tokens = clause
        .split(/\s+/)
        .flatMap(explodeToken)
        .map((token) => token.replace(/^[.,]+|[.,]+$/g, ''))
        .filter(Boolean);
    const product = [];
    let quantityMilli = null;
    let unit = null;
    let pricePaise = null;
    let priceIsUnit = false;
    let bare = null;
    let marker = null;
    const takePrice = (rupees, asUnit) => {
        pricePaise = Math.round(rupees * 100);
        priceIsUnit = asUnit;
        bare = null;
        marker = null;
    };
    const takeQuantity = (value, nextUnit) => {
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
            }
            else if (pricePaise === null) {
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
        }
        else if (quantityMilli === null) {
            takeQuantity(bare, null);
        }
    }
    const productText = product.join(' ').replace(/\s+/g, ' ').trim();
    if (!productText) {
        return null;
    }
    return { productText, quantityMilli, unit, pricePaise, priceIsUnit };
}
function extractBillingText(text) {
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
function norm(value) {
    return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}
function scoreProduct(query, product) {
    const needle = norm(query);
    if (!needle) {
        return 0;
    }
    const fields = [product.name, product.localName ?? '', ...product.aliases]
        .map(norm)
        .filter(Boolean);
    if (fields.some((field) => field === needle)) {
        return 100;
    }
    const compact = needle.replace(/\s/g, '');
    if (fields.some((field) => field.replace(/\s/g, '') === compact)) {
        return 90;
    }
    if (needle.length < 3) {
        return 0;
    }
    if (fields.some((field) => field.includes(needle) || needle.includes(field))) {
        return 40;
    }
    return 0;
}
/** Quantity in milli-units of `toUnit`, or null when the units are not the same measure. */
function convertQuantity(quantityMilli, fromUnit, toUnit) {
    if (fromUnit === toUnit) {
        return quantityMilli;
    }
    const mass = { kg: 1, g: 1000 };
    const volume = { l: 1, ml: 1000 };
    const family = mass[fromUnit] ? mass : volume[fromUnit] ? volume : null;
    const targetScale = family?.[toUnit];
    const sourceScale = family?.[fromUnit];
    if (!family || targetScale === undefined || sourceScale === undefined) {
        return null;
    }
    return Math.round((quantityMilli * targetScale) / sourceScale);
}
function matchBillingLine(line, catalog) {
    const ranked = catalog
        .map((product) => ({ product, score: scoreProduct(line.productText, product) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score);
    const best = ranked[0];
    if (!best) {
        return { ok: false, productText: line.productText, reason: 'not_found' };
    }
    const tied = ranked.filter((entry) => entry.score === best.score);
    if (tied.length > 1) {
        return { ok: false, productText: line.productText, reason: 'ambiguous' };
    }
    const product = best.product;
    let quantityMilli = line.quantityMilli ?? 1000;
    if (line.unit) {
        const converted = convertQuantity(quantityMilli, line.unit, product.unit);
        if (converted === null || converted <= 0) {
            return { ok: false, productText: line.productText, reason: 'unit' };
        }
        quantityMilli = converted;
    }
    if (quantityMilli <= 0) {
        return { ok: false, productText: line.productText, reason: 'not_found' };
    }
    const statedPaise = line.pricePaise;
    const unitPricePaise = statedPaise === null
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

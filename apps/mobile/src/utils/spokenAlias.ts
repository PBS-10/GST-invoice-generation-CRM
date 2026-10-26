const MAX_ALIAS_LENGTH = 48;
const MIN_ALIAS_LENGTH = 2;
export const MAX_PRODUCT_ALIASES = 20;

/**
 * Normalize a spoken product phrase into an alias candidate.
 * Returns null when the phrase is too short/long or empty after trim.
 */
export function normalizeSpokenAlias(spoken: string): string | null {
  const trimmed = spoken.trim().replace(/\s+/g, ' ');
  if (trimmed.length < MIN_ALIAS_LENGTH || trimmed.length > MAX_ALIAS_LENGTH) {
    return null;
  }
  return trimmed;
}

/**
 * Merge a learned spoken alias into a product's alias list.
 * Dedupes against name, localName, and existing aliases (case-insensitive).
 * Caps at MAX_PRODUCT_ALIASES (drops oldest extras).
 */
export function mergeSpokenAlias(input: {
  name: string;
  localName: string | null;
  aliases: string[];
  spoken: string;
}): { aliases: string[]; added: boolean } {
  const candidate = normalizeSpokenAlias(input.spoken);
  if (!candidate) {
    return { aliases: input.aliases, added: false };
  }

  const known = new Set(
    [input.name, input.localName ?? '', ...input.aliases]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  if (known.has(candidate.toLowerCase())) {
    return { aliases: input.aliases, added: false };
  }

  const next = [...input.aliases, candidate];
  while (next.length > MAX_PRODUCT_ALIASES) {
    next.shift();
  }
  return { aliases: next, added: true };
}

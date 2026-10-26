import { describe, expect, it } from 'vitest';
import { MAX_PRODUCT_ALIASES, mergeSpokenAlias, normalizeSpokenAlias } from './spokenAlias';

describe('normalizeSpokenAlias', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSpokenAlias('  चावल   दो  ')).toBe('चावल दो');
  });

  it('rejects short or empty phrases', () => {
    expect(normalizeSpokenAlias('a')).toBeNull();
    expect(normalizeSpokenAlias('   ')).toBeNull();
  });

  it('rejects overly long phrases', () => {
    expect(normalizeSpokenAlias('x'.repeat(49))).toBeNull();
  });
});

describe('mergeSpokenAlias', () => {
  it('adds a new spoken alias', () => {
    const result = mergeSpokenAlias({
      name: 'Rice',
      localName: 'Ari',
      aliases: ['rice'],
      spoken: 'चावल',
    });
    expect(result.added).toBe(true);
    expect(result.aliases).toEqual(['rice', 'चावल']);
  });

  it('skips duplicates against name, localName, and aliases', () => {
    expect(
      mergeSpokenAlias({
        name: 'Rice',
        localName: null,
        aliases: [],
        spoken: 'Rice',
      }).added,
    ).toBe(false);
    expect(
      mergeSpokenAlias({
        name: 'Rice',
        localName: 'അരി',
        aliases: [],
        spoken: 'അരി',
      }).added,
    ).toBe(false);
    expect(
      mergeSpokenAlias({
        name: 'Rice',
        localName: null,
        aliases: ['ari'],
        spoken: 'ARI',
      }).added,
    ).toBe(false);
  });

  it(`caps aliases at ${MAX_PRODUCT_ALIASES}`, () => {
    const aliases = Array.from({ length: MAX_PRODUCT_ALIASES }, (_, i) => `a${i}`);
    const result = mergeSpokenAlias({
      name: 'Rice',
      localName: null,
      aliases,
      spoken: 'new-alias',
    });
    expect(result.added).toBe(true);
    expect(result.aliases).toHaveLength(MAX_PRODUCT_ALIASES);
    expect(result.aliases[0]).toBe('a1');
    expect(result.aliases.at(-1)).toBe('new-alias');
  });
});

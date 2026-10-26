/**
 * Integration-style checks for series allocation used by register/login.
 * Full HTTP e2e against Postgres is run manually via docker compose + curl;
 * these tests lock the allocation rules without a live database.
 */
import { describe, expect, it } from 'vitest';
import { SERIES_CODES } from '../config';
import { nextSeriesCode } from './series';

describe('device series allocation (integration rules)', () => {
  it('assigns distinct codes for sequential devices', () => {
    const used: string[] = [];
    const first = nextSeriesCode(used);
    used.push(first);
    const second = nextSeriesCode(used);
    expect(first).toBe('A');
    expect(second).toBe('B');
    expect(first).not.toBe(second);
  });

  it('never reuses a revoked series code once listed as used', () => {
    expect(nextSeriesCode(['A', 'B'])).toBe('C');
  });

  it('supports up to SERIES_CODES.length devices', () => {
    expect(SERIES_CODES).toHaveLength(32);
    const almost = [...SERIES_CODES].slice(0, -1);
    expect(nextSeriesCode(almost)).toBe(SERIES_CODES[SERIES_CODES.length - 1]);
  });
});

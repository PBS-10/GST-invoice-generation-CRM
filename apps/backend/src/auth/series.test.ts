import { describe, expect, it } from 'vitest';
import { SERIES_CODES } from '../config';
import { nextSeriesCode } from './series';

describe('nextSeriesCode', () => {
  it('assigns A when none are used', () => {
    expect(nextSeriesCode([])).toBe('A');
  });

  it('skips used codes and never reuses', () => {
    expect(nextSeriesCode(['A', 'C'])).toBe('B');
  });

  it('throws DEVICE_LIMIT when the alphabet is exhausted', () => {
    expect(() => nextSeriesCode([...SERIES_CODES])).toThrow(/DEVICE_LIMIT|maximum number of devices/);
  });
});

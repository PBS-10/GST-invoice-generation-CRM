import { describe, expect, it } from 'vitest';
import { MAX_OPEN_CARTS, cartDisplayTitle } from './cartHelpers';

describe('cartDisplayTitle', () => {
  it('prefers label then customer name', () => {
    expect(
      cartDisplayTitle({
        label: 'Counter 1',
        customerSnapshot: { name: 'Ramesh', phone: null, gstin: null, stateCode: null },
      }),
    ).toBe('Counter 1');
    expect(
      cartDisplayTitle({
        label: null,
        customerSnapshot: { name: 'Ramesh', phone: null, gstin: null, stateCode: null },
      }),
    ).toBe('Ramesh');
    expect(
      cartDisplayTitle({
        label: '  ',
        customerSnapshot: { name: '', phone: null, gstin: null, stateCode: null },
      }),
    ).toBe('Walk-in');
  });
});

describe('MAX_OPEN_CARTS', () => {
  it('caps parked bills at 8', () => {
    expect(MAX_OPEN_CARTS).toBe(8);
  });
});

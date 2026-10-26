import type { CustomerSnapshot } from '@invoice-gst/types';

export const MAX_OPEN_CARTS = 8;

export function cartDisplayTitle(cart: {
  label: string | null;
  customerSnapshot: CustomerSnapshot;
}): string {
  return cart.label?.trim() || cart.customerSnapshot.name?.trim() || 'Walk-in';
}

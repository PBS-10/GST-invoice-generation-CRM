export type PostLoginAction = 'resume' | 'restore' | 'confirm_replace';

/**
 * Same shop on this phone → push outbox then pull.
 * Different shop with local data → ask before wipe.
 * Different shop with empty/seed-only phone → restore immediately.
 */
export function choosePostLoginAction(input: {
  localVendorId: string | null;
  cloudVendorId: string;
  hasLocalBusinessOrUnsyncedData: boolean;
  userConfirmedReplace: boolean;
}): PostLoginAction {
  const sameShop = input.localVendorId != null && input.localVendorId === input.cloudVendorId;
  if (sameShop) {
    return 'resume';
  }
  if (input.hasLocalBusinessOrUnsyncedData && !input.userConfirmedReplace) {
    return 'confirm_replace';
  }
  return 'restore';
}

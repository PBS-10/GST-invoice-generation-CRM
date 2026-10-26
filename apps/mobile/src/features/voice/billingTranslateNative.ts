/**
 * Soft load of the local Expo ML Kit module.
 * Missing native binary (Expo Go / pre-rebuild) returns null — billing still works.
 */

import type {
  BillingTranslateLang,
  DownloadModelOptions,
} from 'billing-translate';

export type BillingTranslateApi = {
  isAvailable: () => boolean;
  isModelDownloaded: (lang: BillingTranslateLang) => Promise<boolean>;
  downloadModel: (lang: BillingTranslateLang, options?: DownloadModelOptions) => Promise<void>;
  deleteModel: (lang: BillingTranslateLang) => Promise<void>;
  getDownloadedModels: () => Promise<string[]>;
  translate: (
    text: string,
    sourceLang: BillingTranslateLang,
    targetLang?: string,
  ) => Promise<string>;
};

let cached: BillingTranslateApi | null | undefined;
/** When set (including null), unit tests bypass the real native require. */
let testOverride: BillingTranslateApi | null | undefined;

export function loadBillingTranslate(): BillingTranslateApi | null {
  if (testOverride !== undefined) {
    return testOverride;
  }
  if (cached !== undefined) {
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('billing-translate') as BillingTranslateApi;
    if (typeof mod?.translate !== 'function' || typeof mod.isAvailable !== 'function') {
      cached = null;
      return null;
    }
    if (!mod.isAvailable()) {
      cached = null;
      return null;
    }
    cached = mod;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

/** Test hook — inject a fake native API (or null). Pass `undefined` to clear. */
export function setBillingTranslateForTests(api: BillingTranslateApi | null | undefined): void {
  testOverride = api;
  cached = undefined;
}

/** Test hook — clear soft-load cache between unit tests. */
export function resetBillingTranslateCacheForTests(): void {
  testOverride = undefined;
  cached = undefined;
}

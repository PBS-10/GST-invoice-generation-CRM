import type { BillingTranslateLang } from 'billing-translate';
import type { BillingVoiceLocale } from './types';

/**
 * Maps invoice voice STT locale → ML Kit source language.
 * `null` means skip on-device translate (English, or unsupported e.g. Malayalam).
 */
export function translateSourceLang(
  locale: BillingVoiceLocale,
): BillingTranslateLang | null {
  switch (locale) {
    case 'hi-IN':
      return 'hi';
    case 'ta-IN':
      return 'ta';
    case 'en-IN':
    case 'ml-IN':
      return null;
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}

export function translatePackLabel(lang: BillingTranslateLang): string {
  switch (lang) {
    case 'hi':
      return 'Hindi';
    case 'ta':
      return 'Tamil';
    default: {
      const _exhaustive: never = lang;
      return _exhaustive;
    }
  }
}

/** Languages that have downloadable on-device packs in Settings. */
export const BILLING_TRANSLATE_PACKS: readonly BillingTranslateLang[] = ['hi', 'ta'];

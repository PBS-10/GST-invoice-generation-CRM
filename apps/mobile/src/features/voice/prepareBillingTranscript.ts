import type { BillingVoiceLocale } from './types';
import { loadBillingTranslate } from './billingTranslateNative';
import { translateSourceLang } from './translateLocale';

export type PrepareBillingTranscriptResult = {
  /** Text passed to extract/match (translated or original). */
  text: string;
  /** True when ML Kit produced an English translation. */
  translated: boolean;
  /**
   * True when the locale needs a pack that is not on device yet
   * (caller may toast once and still bill on original text).
   */
  modelMissing: boolean;
  sourceLang: string | null;
};

const sessionCache = new Map<string, string>();

function cacheKey(lang: string, text: string): string {
  return `${lang}::${text.trim().toLowerCase()}`;
}

/**
 * Prepare a final voice transcript for catalogue matching.
 * Never throws — falls back to the original text.
 */
export async function prepareBillingTranscript(
  transcript: string,
  locale: BillingVoiceLocale,
): Promise<PrepareBillingTranscriptResult> {
  const original = transcript.trim();
  const sourceLang = translateSourceLang(locale);

  if (!original || sourceLang == null) {
    return { text: original, translated: false, modelMissing: false, sourceLang };
  }

  const native = loadBillingTranslate();
  if (!native) {
    return { text: original, translated: false, modelMissing: true, sourceLang };
  }

  try {
    const ready = await native.isModelDownloaded(sourceLang);
    if (!ready) {
      return { text: original, translated: false, modelMissing: true, sourceLang };
    }

    const key = cacheKey(sourceLang, original);
    const cached = sessionCache.get(key);
    if (cached != null) {
      return { text: cached, translated: true, modelMissing: false, sourceLang };
    }

    const translated = (await native.translate(original, sourceLang, 'en')).trim();
    const text = translated || original;
    if (translated) {
      sessionCache.set(key, text);
    }
    return {
      text,
      translated: Boolean(translated) && text !== original,
      modelMissing: false,
      sourceLang,
    };
  } catch {
    return { text: original, translated: false, modelMissing: false, sourceLang };
  }
}

/** Clears the in-memory phrase cache (tests / locale pack delete). */
export function clearBillingTranscriptCache(): void {
  sessionCache.clear();
}

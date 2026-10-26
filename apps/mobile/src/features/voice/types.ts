/** Locales offered for OS speech recognition on the new-invoice screen. */
export const BILLING_VOICE_LOCALES = [
  { value: 'en-IN', label: 'EN', hint: 'Speech English' },
  { value: 'ml-IN', label: 'ML', hint: 'Speech Malayalam (learns aliases)' },
  { value: 'hi-IN', label: 'HI', hint: 'Speech Hindi + on-device translate' },
  { value: 'ta-IN', label: 'TA', hint: 'Speech Tamil + on-device translate' },
] as const;

export type BillingVoiceLocale = (typeof BILLING_VOICE_LOCALES)[number]['value'];

export type BillingVoiceErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'unavailable'
  | 'no_speech'
  | 'busy'
  | 'network'
  | 'language_not_supported'
  | 'unknown';

export type BillingVoiceError = {
  code: BillingVoiceErrorCode;
  message: string;
};

export type BillingVoiceCallbacks = {
  onPartial?: (transcript: string) => void;
  onFinal?: (transcript: string) => void;
  onError?: (error: BillingVoiceError) => void;
  onListeningChange?: (listening: boolean) => void;
  /** Fired when the OS ends a session — used to auto-restart continuous mode. */
  onSessionEnd?: () => void;
};

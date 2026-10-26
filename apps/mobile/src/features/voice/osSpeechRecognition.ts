/**
 * Thin wrapper around the phone OS speech recognizer.
 * No custom ML models and no backend — only Android/iOS/Web STT.
 * Native module is loaded lazily so Expo Go does not crash on import.
 */

import type { BillingVoiceCallbacks, BillingVoiceError, BillingVoiceErrorCode, BillingVoiceLocale } from './types';

type SpeechPackage = typeof import('expo-speech-recognition');
type SpeechModule = SpeechPackage['ExpoSpeechRecognitionModule'];
type SpeechErrorCode = import('expo-speech-recognition').ExpoSpeechRecognitionErrorCode;

type ListenerHandle = { remove: () => void };

let cachedModule: SpeechModule | null | undefined;
let listenersAttached = false;
let activeCallbacks: BillingVoiceCallbacks | null = null;
const listenerHandles: ListenerHandle[] = [];

function loadSpeechModule(): SpeechModule | null {
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  try {
    // Lazy require: Expo Go throws when the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const speech = require('expo-speech-recognition') as SpeechPackage;
    cachedModule = speech.ExpoSpeechRecognitionModule;
    return cachedModule;
  } catch {
    cachedModule = null;
    return null;
  }
}

function mapNativeError(code: SpeechErrorCode, message: string): BillingVoiceError {
  const mapped: BillingVoiceErrorCode =
    code === 'not-allowed'
      ? 'permission_denied'
      : code === 'no-speech' || code === 'speech-timeout'
        ? 'no_speech'
        : code === 'busy'
          ? 'busy'
          : code === 'network'
            ? 'network'
            : code === 'language-not-supported'
              ? 'language_not_supported'
              : code === 'service-not-allowed' || code === 'audio-capture'
                ? 'unavailable'
                : code === 'aborted'
                  ? 'unknown'
                  : 'unknown';

  const friendly: Record<BillingVoiceErrorCode, string> = {
    unsupported: 'Voice billing needs a development build (not Expo Go).',
    permission_denied: 'Microphone or speech permission was denied.',
    unavailable: 'Speech recognition is not available on this device.',
    no_speech: 'No speech was heard. Try again.',
    busy: 'Speech recognition is busy. Stop and try again.',
    network: 'Speech recognition needs a network connection on this device.',
    language_not_supported: 'This language is not supported by the phone speech service.',
    unknown: message || 'Speech recognition failed.',
  };

  return {
    code: mapped,
    message: mapped === 'unknown' ? friendly.unknown : friendly[mapped],
  };
}

function ensureListeners(module: SpeechModule): void {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;

  listenerHandles.push(
    module.addListener('start', () => {
      activeCallbacks?.onListeningChange?.(true);
    }),
  );
  listenerHandles.push(
    module.addListener('end', () => {
      activeCallbacks?.onListeningChange?.(false);
      activeCallbacks?.onSessionEnd?.();
    }),
  );
  listenerHandles.push(
    module.addListener('result', (event) => {
      const transcript = event.results[0]?.transcript?.trim() ?? '';
      if (!transcript) {
        return;
      }
      if (event.isFinal) {
        activeCallbacks?.onFinal?.(transcript);
      } else {
        activeCallbacks?.onPartial?.(transcript);
      }
    }),
  );
  listenerHandles.push(
    module.addListener('error', (event) => {
      if (event.error === 'aborted') {
        activeCallbacks?.onListeningChange?.(false);
        return;
      }
      activeCallbacks?.onError?.(mapNativeError(event.error, event.message));
      activeCallbacks?.onListeningChange?.(false);
    }),
  );
}

/** True when the OS speech module is present and reports recognition available. */
export function isBillingVoiceSupported(): boolean {
  const module = loadSpeechModule();
  if (!module) {
    return false;
  }
  try {
    return module.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function startBillingVoice(
  locale: BillingVoiceLocale,
  callbacks: BillingVoiceCallbacks,
  options?: { continuous?: boolean },
): Promise<BillingVoiceError | null> {
  const module = loadSpeechModule();
  if (!module) {
    const error: BillingVoiceError = {
      code: 'unsupported',
      message: 'Voice billing needs a development build (not Expo Go).',
    };
    callbacks.onError?.(error);
    return error;
  }

  try {
    if (!module.isRecognitionAvailable()) {
      const error: BillingVoiceError = {
        code: 'unavailable',
        message: 'Speech recognition is not available on this device.',
      };
      callbacks.onError?.(error);
      return error;
    }
  } catch {
    const error: BillingVoiceError = {
      code: 'unsupported',
      message: 'Voice billing needs a development build (not Expo Go).',
    };
    callbacks.onError?.(error);
    return error;
  }

  const permission = await module.requestPermissionsAsync();
  if (!permission.granted) {
    const error: BillingVoiceError = {
      code: 'permission_denied',
      message: 'Microphone or speech permission was denied.',
    };
    callbacks.onError?.(error);
    return error;
  }

  ensureListeners(module);
  activeCallbacks = callbacks;

  try {
    module.start({
      lang: locale,
      interimResults: true,
      // Prefer OS continuous when available; the hook also restarts on session end.
      continuous: options?.continuous ?? true,
      maxAlternatives: 1,
      addsPunctuation: false,
    });
    return null;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Speech recognition failed.';
    const error: BillingVoiceError = { code: 'unavailable', message };
    callbacks.onError?.(error);
    activeCallbacks = null;
    return error;
  }
}

export function stopBillingVoice(): void {
  const module = loadSpeechModule();
  if (!module) {
    return;
  }
  try {
    module.stop();
  } catch {
    try {
      module.abort();
    } catch {
      // Expo Go / missing native path
    }
  }
}

export function abortBillingVoice(): void {
  const module = loadSpeechModule();
  if (!module) {
    return;
  }
  try {
    module.abort();
  } catch {
    // Expo Go / missing native path
  }
  activeCallbacks = null;
}

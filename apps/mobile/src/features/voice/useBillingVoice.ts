import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '../../utils/haptics';
import {
  abortBillingVoice,
  isBillingVoiceSupported,
  startBillingVoice,
  stopBillingVoice,
} from './osSpeechRecognition';
import type { BillingVoiceError, BillingVoiceLocale } from './types';

export type UseBillingVoiceOptions = {
  locale: BillingVoiceLocale;
  /** Called with interim and final transcripts so the billing text field can update. */
  onTranscript: (transcript: string, isFinal: boolean) => void;
  /**
   * Keep listening across utterances (shop counter mode). Restarts after each
   * OS session ends until the clerk stops the mic.
   */
  continuous?: boolean;
  /** When false, continuous auto-restart pauses (e.g. while resolving a match). */
  restartEnabled?: boolean;
};

const RESTART_DELAY_MS = 350;

export function useBillingVoice({
  locale,
  onTranscript,
  continuous = true,
  restartEnabled = true,
}: UseBillingVoiceOptions) {
  const [supported] = useState(() => isBillingVoiceSupported());
  const [listening, setListening] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<BillingVoiceError | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  const localeRef = useRef(locale);
  const continuousRef = useRef(continuous);
  const restartEnabledRef = useRef(restartEnabled);
  const armedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginSessionRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  useEffect(() => {
    restartEnabledRef.current = restartEnabled;
  }, [restartEnabled]);

  useEffect(() => {
    armedRef.current = armed;
  }, [armed]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const scheduleRestart = useCallback(
    (delayMs = RESTART_DELAY_MS) => {
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (!armedRef.current || !restartEnabledRef.current) {
          return;
        }
        void beginSessionRef.current();
      }, delayMs);
    },
    [clearRestartTimer],
  );

  const beginSession = useCallback(async () => {
    if (!supported) {
      const unavailable: BillingVoiceError = {
        code: 'unsupported',
        message: 'Voice billing needs a development build (not Expo Go).',
      };
      setError(unavailable);
      setArmed(false);
      return;
    }

    setError(null);

    const startError = await startBillingVoice(
      localeRef.current,
      {
        onPartial: (transcript) => {
          onTranscriptRef.current(transcript, false);
        },
        onFinal: (transcript) => {
          onTranscriptRef.current(transcript, true);
        },
        onError: (voiceError) => {
          if (continuousRef.current && armedRef.current && voiceError.code === 'no_speech') {
            setListening(false);
            scheduleRestart();
            return;
          }
          setError(voiceError);
          setListening(false);
          setArmed(false);
          haptics.warning();
        },
        onListeningChange: (next) => {
          setListening(next);
        },
        onSessionEnd: () => {
          setListening(false);
          if (continuousRef.current && armedRef.current && restartEnabledRef.current) {
            scheduleRestart();
          } else if (!continuousRef.current) {
            setArmed(false);
          }
        },
      },
      { continuous: continuousRef.current },
    );

    if (startError) {
      if (startError.code === 'busy' && armedRef.current) {
        scheduleRestart(600);
        return;
      }
      setError(startError);
      setListening(false);
      setArmed(false);
      haptics.warning();
    }
  }, [scheduleRestart, supported]);

  useEffect(() => {
    beginSessionRef.current = beginSession;
  }, [beginSession]);

  useEffect(() => {
    return () => {
      clearRestartTimer();
      abortBillingVoice();
    };
  }, [clearRestartTimer]);

  // Resume after a resolve sheet closes (restartEnabled flips back on).
  const prevRestartRef = useRef(restartEnabled);
  useEffect(() => {
    const wasPaused = !prevRestartRef.current && restartEnabled;
    prevRestartRef.current = restartEnabled;
    if (wasPaused && armed && continuous && !listening) {
      scheduleRestart(200);
    }
  }, [armed, continuous, listening, restartEnabled, scheduleRestart]);

  const startListening = useCallback(async () => {
    clearRestartTimer();
    setArmed(true);
    haptics.selection();
    await beginSession();
  }, [beginSession, clearRestartTimer]);

  const stopListening = useCallback(() => {
    clearRestartTimer();
    setArmed(false);
    stopBillingVoice();
    setListening(false);
    haptics.light();
  }, [clearRestartTimer]);

  const toggleListening = useCallback(async () => {
    if (armed || listening) {
      stopListening();
      return;
    }
    await startListening();
  }, [armed, listening, startListening, stopListening]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    supported,
    listening,
    /** Clerk still wants continuous listening (even between OS sessions). */
    armed,
    error,
    clearError,
    startListening,
    stopListening,
    toggleListening,
  };
}

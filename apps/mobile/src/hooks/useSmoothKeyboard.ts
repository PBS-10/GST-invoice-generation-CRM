import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  type KeyboardEvent,
} from 'react-native';

const DEFAULT_DURATION_MS = Platform.OS === 'ios' ? 250 : 220;

/** Matches the system keyboard curve closely enough for layout lifts. */
const KEYBOARD_EASING = Easing.bezier(0.17, 0.59, 0.4, 0.77);

export type SmoothKeyboard = {
  /** Animated height of the software keyboard (0 when hidden). */
  height: Animated.Value;
  /** Latest keyboard height in px (for maxHeight / layout math). */
  keyboardHeight: number;
  /** Whether the keyboard is currently open. */
  visible: boolean;
};

function insetFromEvent(event: KeyboardEvent): number {
  // screenY = top edge of the keyboard. Overlap with the window bottom is the inset.
  const windowHeight = Dimensions.get('window').height;
  const keyboardTop = event.endCoordinates.screenY;
  return Math.max(0, windowHeight - keyboardTop);
}

/**
 * Tracks keyboard height with a smooth animated value so sheets and screens
 * can lift/settle in sync with the system keyboard (important on Android
 * edge-to-edge where window resize often does not run).
 */
export function useSmoothKeyboard(enabled = true): SmoothKeyboard {
  const height = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      height.stopAnimation();
      height.setValue(0);
      setKeyboardHeight(0);
      setVisible(false);
      return;
    }

    function animateTo(toValue: number, event?: KeyboardEvent) {
      const duration =
        typeof event?.duration === 'number' && event.duration > 0
          ? event.duration
          : DEFAULT_DURATION_MS;
      Animated.timing(height, {
        toValue,
        duration,
        easing: KEYBOARD_EASING,
        useNativeDriver: false,
      }).start();
      setKeyboardHeight(toValue);
      setVisible(toValue > 0);
    }

    if (Platform.OS === 'ios') {
      // Follows interactive dismiss as the frame slides.
      const frameSub = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
        animateTo(insetFromEvent(event), event);
      });
      return () => {
        frameSub.remove();
      };
    }

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      animateTo(insetFromEvent(event), event);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', (event) => {
      animateTo(0, event);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled, height]);

  return { height, keyboardHeight, visible };
}

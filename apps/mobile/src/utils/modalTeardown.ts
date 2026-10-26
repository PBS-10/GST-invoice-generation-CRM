import { Keyboard, Platform } from 'react-native';

/**
 * Yield until keyboard / Modal hosts can finish tearing down before navigate
 * or goBack. Android Fabric otherwise crashes with addViewAt /
 * "child already has a parent" when a Screen with keyboard inset unmounts
 * in the same frame as Keyboard.dismiss + navigation.
 *
 * Call after Keyboard.dismiss() (and after closing any BottomSheet).
 */
export function waitForModalTeardown(): Promise<void> {
  return waitForUiSettle();
}

export function waitForUiSettle(): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      requestAnimationFrame(() => {
        setTimeout(resolve, Platform.OS === 'android' ? 80 : 0);
      });
    };

    if (Platform.OS !== 'android') {
      finish();
      return;
    }

    let done = false;
    const complete = () => {
      if (done) {
        return;
      }
      done = true;
      sub.remove();
      finish();
    };

    const sub = Keyboard.addListener('keyboardDidHide', complete);
    // Keyboard may already be closed — do not hang waiting for hide.
    setTimeout(complete, 120);
  });
}

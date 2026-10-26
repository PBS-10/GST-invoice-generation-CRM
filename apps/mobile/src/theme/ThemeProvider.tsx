import * as SystemUI from 'expo-system-ui';
import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';
import { logger } from '../utils/logger';
import { themes, type ColorScheme, type Theme } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = Theme & {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  reducedMotion: boolean;
};

const PREFERENCE_KEY = 'ui.themePreference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Native reads the SQLite key-value store synchronously so the first frame is
 * already in the right theme. On web the sync path blocks and times out, so
 * localStorage is used instead.
 */
const preferenceStore = {
  read(): string | null {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(PREFERENCE_KEY) ?? null;
    }
    return Storage.getItemSync(PREFERENCE_KEY);
  },
  async write(value: ThemePreference): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(PREFERENCE_KEY, value);
      return;
    }
    await Storage.setItemAsync(PREFERENCE_KEY, value);
  },
};

function readStoredPreference(): ThemePreference {
  try {
    const stored = preferenceStore.read();
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (error) {
    logger.warn('theme_preference_read_failed', { message: String(error) });
  }
  return 'system';
}

function applyNativeAppearance(preference: ThemePreference) {
  if (Platform.OS === 'web') {
    return;
  }
  try {
    // Keeps native chrome (keyboard, alerts, switches) in step with the app.
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  } catch {
    // Older runtimes may not support overriding; the app theme still applies.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [reducedMotion, setReducedMotion] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    applyNativeAppearance(preference);
  }, [preference]);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) {
        setReducedMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const theme = themes[scheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void preferenceStore.write(next).catch((error: unknown) => {
      logger.warn('theme_preference_write_failed', { message: String(error) });
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ ...theme, preference, setPreference, reducedMotion }),
    [theme, preference, setPreference, reducedMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return value;
}

/**
 * Builds a StyleSheet-like object from the active theme, recomputed only when
 * the scheme changes. The factory must be defined outside the component.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const { scheme } = useTheme();
  return useMemo(() => factory(themes[scheme]), [factory, scheme]);
}

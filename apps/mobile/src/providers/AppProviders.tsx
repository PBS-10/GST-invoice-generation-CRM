import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { preloadIcons } from '../components/common/Icon';
import { ToastProvider } from '../components/common/Toast';
import { SyncBootstrap } from '../services/sync/SyncBootstrap';
import { store } from '../store';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { DatabaseFallback, DatabaseProvider } from './DatabaseProvider';

function ThemedNavigation({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();

  const navigationTheme = useMemo<NavTheme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: scheme === 'dark',
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        primary: colors.primaryText,
        notification: colors.secondary,
      },
    };
  }, [colors, scheme]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ToastProvider>{children}</ToastProvider>
    </NavigationContainer>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    preloadIcons();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Provider store={store}>
          <Suspense fallback={<DatabaseFallback />}>
            <DatabaseProvider>
              <SyncBootstrap />
              <ThemedNavigation>{children}</ThemedNavigation>
            </DatabaseProvider>
          </Suspense>
        </Provider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

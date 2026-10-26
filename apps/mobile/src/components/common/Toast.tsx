import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { layout, motion, radius, space, type Palette, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type ToastTone = 'success' | 'error' | 'info';
type ToastInput = { message: string; tone?: ToastTone };
type ToastItem = Required<ToastInput> & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);
const useNativeDriver = Platform.OS !== 'web';
const VISIBLE_MS = 3200;
const DISMISS_DISTANCE = 56;

const toneIcon: Record<ToastTone, { icon: IconName; color: keyof Palette; soft: keyof Palette }> = {
  success: { icon: 'checkmark-circle', color: 'success', soft: 'successSoft' },
  error: { icon: 'alert-circle', color: 'error', soft: 'errorSoft' },
  info: { icon: 'information-circle', color: 'info', soft: 'infoSoft' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const counter = useRef(0);

  const show = useCallback((input: ToastInput) => {
    counter.current += 1;
    setToast({ id: counter.current, message: input.message, tone: input.tone ?? 'info' });
    AccessibilityInfo.announceForAccessibility(input.message);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onHidden={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onHidden }: { toast: ToastItem; onHidden: () => void }) {
  const { colors, reducedMotion } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const onHiddenRef = useRef(onHidden);
  const hideRef = useRef<() => void>(() => undefined);
  onHiddenRef.current = onHidden;

  const hide = useCallback(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: motion.base,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) {
        onHiddenRef.current();
      }
    });
  }, [progress]);
  hideRef.current = hide;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
      onPanResponderMove: (_event, gesture) => {
        dragX.setValue(gesture.dx);
        dragY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_event, gesture) => {
        const distance = Math.hypot(gesture.dx, gesture.dy);
        const velocity = Math.hypot(gesture.vx, gesture.vy);
        if (distance > DISMISS_DISTANCE || velocity > 1.05) {
          const dominateX = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
          const outX = dominateX ? Math.sign(gesture.dx || 1) * 420 : gesture.dx * 1.6;
          const outY = dominateX ? gesture.dy * 1.6 : Math.sign(gesture.dy || -1) * 280;
          Animated.parallel([
            Animated.timing(dragX, {
              toValue: outX,
              duration: motion.base,
              easing: Easing.in(Easing.cubic),
              useNativeDriver,
            }),
            Animated.timing(dragY, {
              toValue: outY,
              duration: motion.base,
              easing: Easing.in(Easing.cubic),
              useNativeDriver,
            }),
            Animated.timing(progress, {
              toValue: 0,
              duration: motion.base,
              useNativeDriver,
            }),
          ]).start(({ finished }) => {
            if (finished) {
              onHiddenRef.current();
            }
          });
          return;
        }
        Animated.parallel([
          Animated.spring(dragX, { toValue: 0, useNativeDriver, bounciness: 0, speed: 20 }),
          Animated.spring(dragY, { toValue: 0, useNativeDriver, bounciness: 0, speed: 20 }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(dragX, { toValue: 0, useNativeDriver, bounciness: 0 }),
          Animated.spring(dragY, { toValue: 0, useNativeDriver, bounciness: 0 }),
        ]).start();
      },
    }),
  ).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
    const timer = setTimeout(() => hideRef.current(), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [progress]);

  const { icon, color, soft } = toneIcon[toast.tone];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: Math.max(insets.top, space[3]) + space[2] }]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.toast,
          {
            backgroundColor: colors[soft],
            borderColor: colors[color],
            opacity: progress,
            transform: reducedMotion
              ? [{ translateX: dragX }, { translateY: dragY }]
              : [
                  {
                    translateY: Animated.add(
                      progress.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }),
                      dragY,
                    ),
                  },
                  { translateX: dragX },
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
          },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={toast.message}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name={icon} color={colors[color]} size="large" />
        </View>
        <Text variant="bodyMedium" style={styles.message} numberOfLines={3}>
          {toast.message}
        </Text>
        <PressableScale
          onPress={hide}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.dismiss}
        >
          <Icon name="close" size="small" tone="textTertiary" />
        </PressableScale>
      </Animated.View>
    </View>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return useMemo(
    () => ({
      show,
      success: (message: string) => show({ message, tone: 'success' }),
      error: (message: string) => show({ message, tone: 'error' }),
      info: (message: string) => show({ message, tone: 'info' }),
    }),
    [show],
  );
}

function createStyles({ colors, elevation }: Theme) {
  return StyleSheet.create({
    host: {
      position: 'absolute',
      left: space[4],
      right: space[4],
      zIndex: 9999,
      elevation: 9999,
      alignItems: 'center',
    },
    toast: {
      width: '100%',
      maxWidth: layout.maxContentWidth - space[8],
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingLeft: space[3],
      paddingRight: space[2],
      paddingVertical: space[3],
      minHeight: 56,
      borderRadius: radius.extraLarge,
      borderWidth: StyleSheet.hairlineWidth,
      boxShadow: elevation.high,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    message: {
      flex: 1,
      color: colors.textPrimary,
    },
    dismiss: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

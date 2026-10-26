import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSmoothKeyboard } from '../../hooks/useSmoothKeyboard';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { layout, motion, radius, space, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { IconButton } from './IconButton';

const useNativeDriver = Platform.OS !== 'web';

function keyboardIsOpen(): boolean {
  return typeof Keyboard.isVisible === 'function' ? Keyboard.isVisible() : false;
}

/**
 * Modal sheet that slides from the bottom. Dismiss by tapping the backdrop,
 * dragging the handle down, the close button, or Android back.
 *
 * Android Fabric: keep keyboard lift on a plain View (not Animated layout props)
 * and tear the Modal down cleanly before the host screen unmounts.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  fullHeight = false,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  fullHeight?: boolean;
  /**
   * When false, children fill the sheet body (use FlatList etc. inside).
   * Default wraps children in a ScrollView.
   */
  scroll?: boolean;
}) {
  const { reducedMotion } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  const closingRef = useRef(false);
  onCloseRef.current = onClose;

  const { keyboardHeight, visible: keyboardVisible } = useSmoothKeyboard(visible && mounted);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
      drag.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: reducedMotion ? motion.fast : motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      }).start();
      return;
    }

    if (!mounted) {
      return;
    }

    closingRef.current = true;
    Keyboard.dismiss();
    // Android Fabric: hide the Modal first (visible=false), then drop it from the
    // tree on the next frame. Instant unmount + navigate in the same tick causes
    // addViewAt / "child already has a parent".
    if (Platform.OS === 'android') {
      progress.setValue(0);
      drag.setValue(0);
      let cancelled = false;
      const handle = requestAnimationFrame(() => {
        setTimeout(() => {
          if (!cancelled) {
            setMounted(false);
            closingRef.current = false;
          }
        }, 32);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(handle);
      };
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: motion.base,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished || closingRef.current) {
        setMounted(false);
        closingRef.current = false;
      }
    });
  }, [visible, mounted, progress, drag, reducedMotion]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 6 && !keyboardIsOpen(),
      onPanResponderMove: (_event, gesture) => {
        drag.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 1.1) {
          onCloseRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver, bounciness: 0 }).start();
        }
      },
    }),
  ).current;

  if (!mounted) {
    return null;
  }

  const offscreen = reducedMotion ? 24 : windowHeight * 0.6;
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] }),
    drag,
  );
  const sheetMaxHeight = Math.max(
    280,
    windowHeight - insets.top - space[6] - Math.max(0, keyboardHeight - insets.bottom),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        {/*
          Keyboard lift on a plain View. Transform lives on an outer Animated.View
          so Fabric can still lay out flex children (FlatList in scroll={false} sheets).
        */}
        <View style={{ marginBottom: Platform.OS === 'android' ? keyboardHeight : 0, width: '100%' }}>
          <Animated.View
            style={{
              width: '100%',
              opacity: reducedMotion ? progress : 1,
              transform: [{ translateY }],
            }}
          >
            <View
              accessibilityViewIsModal
              style={[
                styles.sheet,
                { maxHeight: sheetMaxHeight },
                fullHeight && { height: Math.min(windowHeight * 0.82, sheetMaxHeight) },
                {
                  paddingBottom: footer ? 0 : Math.max(insets.bottom, space[4]),
                },
              ]}
            >
              <View {...panResponder.panHandlers} style={styles.header}>
                <View style={styles.handle} />
                {title ? (
                  <View style={styles.titleRow}>
                    <View style={styles.titleText}>
                      <Text variant="h3" accessibilityRole="header">
                        {title}
                      </Text>
                      {description ? (
                        <Text variant="bodySmall" tone="secondary">
                          {description}
                        </Text>
                      ) : null}
                    </View>
                    <IconButton
                      icon="close"
                      accessibilityLabel="Close"
                      variant="tonal"
                      size={32}
                      tone="textSecondary"
                      onPress={() => {
                        Keyboard.dismiss();
                        onClose();
                      }}
                      style={styles.close}
                    />
                  </View>
                ) : null}
              </View>
              {scroll ? (
                <ScrollView
                  style={[styles.body, fullHeight && styles.bodyFill]}
                  contentContainerStyle={styles.bodyContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={[styles.bodyFill, styles.bodyPad]}>{children}</View>
              )}
              {footer ? (
                <View
                  style={[
                    styles.footer,
                    {
                      paddingBottom: keyboardVisible
                        ? space[4]
                        : Math.max(insets.bottom, space[4]),
                    },
                  ]}
                >
                  {footer}
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles({ colors, elevation }: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      backgroundColor: colors.overlay,
    },
    sheet: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      flexDirection: 'column',
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radius.extraLarge,
      borderTopRightRadius: radius.extraLarge,
      boxShadow: elevation.high,
      overflow: 'hidden',
    },
    header: {
      flexShrink: 0,
      paddingHorizontal: space[5],
      paddingBottom: space[2],
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.borderStrong,
      marginTop: space[2],
      marginBottom: space[3],
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
      paddingBottom: space[2],
    },
    titleText: {
      flex: 1,
      gap: space[1],
      paddingTop: space[1],
    },
    close: {
      backgroundColor: colors.surfaceSecondary,
    },
    body: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
    },
    bodyFill: {
      flex: 1,
      flexDirection: 'column',
      minHeight: 0,
    },
    bodyPad: {
      paddingHorizontal: space[5],
      paddingBottom: space[2],
    },
    bodyContent: {
      paddingHorizontal: space[5],
      paddingBottom: space[2],
      gap: space[4],
    },
    footer: {
      flexShrink: 0,
      paddingHorizontal: space[5],
      paddingTop: space[4],
      gap: space[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
  });
}

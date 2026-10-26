import { type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSmoothKeyboard } from '../../hooks/useSmoothKeyboard';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { layout, space, type Theme } from '../../theme/theme';
import { Text } from './AppText';

type Edge = 'top' | 'bottom';
type ScrollViewHandle = ComponentRef<typeof ScrollView>;

/**
 * Content padding shared by scroll and list screens: a consistent gutter,
 * safe-area aware, and centred with a max width on tablets.
 */
export function useScreenContentStyle(edges: readonly Edge[], hasFooter = false): ViewStyle {
  const insets = useSafeAreaInsets();
  return {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: (edges.includes('top') ? insets.top : 0) + space[4],
    paddingBottom:
      space[8] + (edges.includes('bottom') && !hasFooter ? insets.bottom : 0),
  };
}

/**
 * Screen scaffold. Tab screens (no native header) pass `edges={['top']}`;
 * stack screens keep the default bottom edge. `footer` pins a primary action
 * above the home indicator and keyboard.
 *
 * When `keyboard` is true (default), the whole screen — scroll body and sticky
 * footer — lifts with the software keyboard so focused fields stay visible.
 * Uses a plain View + numeric inset (not Animated layout props) for Fabric safety.
 */
export function Screen({
  children,
  scroll = true,
  edges = ['bottom'],
  footer,
  keyboard = true,
  gap = space[6],
  contentStyle,
  scrollRef,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  footer?: ReactNode;
  /** Lift content with the keyboard. On by default for form-friendly screens. */
  keyboard?: boolean;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: Ref<ScrollViewHandle>;
}) {
  const styles = useThemedStyles(createStyles);
  const contentContainerStyle = useScreenContentStyle(edges, Boolean(footer));
  const { keyboardHeight, visible: keyboardVisible } = useSmoothKeyboard(keyboard);

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={[contentContainerStyle, { gap }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets={false}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, contentStyle]}>{children}</View>
  );

  const content = (
    <>
      {body}
      {footer ? (
        <StickyFooter bottomInset={edges.includes('bottom')} keyboardOpen={keyboardVisible}>
          {footer}
        </StickyFooter>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      {keyboard ? (
        <View style={[styles.fill, { paddingBottom: keyboardHeight }]}>{content}</View>
      ) : (
        content
      )}
    </View>
  );
}

export function StickyFooter({
  children,
  bottomInset = true,
  keyboardOpen = false,
}: {
  children: ReactNode;
  bottomInset?: boolean;
  /** When the keyboard is open, drop home-indicator padding — keyboard replaces it. */
  keyboardOpen?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const paddingBottom =
    keyboardOpen || !bottomInset ? space[4] : Math.max(insets.bottom, space[4]);

  return (
    <View style={[styles.footer, { paddingBottom }]}>
      <View style={styles.footerInner}>{children}</View>
    </View>
  );
}

/** Large in-content title used by tab screens, in place of a native header. */
export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? (
          <Text variant="label" tone="secondary">
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h1" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.headerTrailing}>{trailing}</View> : null}
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    fill: {
      flex: 1,
    },
    footer: {
      paddingTop: space[3],
      paddingHorizontal: layout.gutter,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    footerInner: {
      width: '100%',
      maxWidth: layout.maxContentWidth - layout.gutter * 2,
      alignSelf: 'center',
      gap: space[3],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: space[3],
      paddingTop: space[2],
    },
    headerText: {
      flex: 1,
      gap: space[1],
    },
    headerTrailing: {
      paddingBottom: 2,
    },
  });
}

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { PressableScale } from './PressableScale';

type Variant = 'outlined' | 'filled';

/**
 * A quiet surface. Borders and surface contrast carry the structure; shadows
 * are left to things that float.
 */
export function Card({
  children,
  onPress,
  variant = 'outlined',
  padded = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  padded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  const cardStyle = [styles.card, styles[variant], padded && styles.padded, style];

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        scaleTo={0.985}
        style={cardStyle}
        pressedStyle={styles.pressed}
      >
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.large,
      overflow: 'hidden',
    },
    outlined: {
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    filled: {
      backgroundColor: colors.surfaceSecondary,
    },
    padded: {
      padding: space[4],
    },
    pressed: {
      backgroundColor: colors.surfaceSecondary,
    },
  });
}

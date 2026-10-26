import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { radius, type Palette, type Theme } from '../../theme/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'plain' | 'tonal' | 'filled' | 'outlined';

const iconToken: Record<Variant, keyof Palette> = {
  plain: 'textSecondary',
  tonal: 'primaryText',
  filled: 'onPrimary',
  outlined: 'textPrimary',
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  size = 40,
  disabled = false,
  tone,
  style,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  variant?: Variant;
  size?: number;
  disabled?: boolean;
  tone?: keyof Palette;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Visual size can be compact; the touch target always reaches 44pt.
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={slop}
      scaleTo={0.92}
      style={[
        styles.base,
        { width: size, height: size },
        styles[variant],
        disabled && styles.disabled,
        style,
      ]}
      pressedStyle={styles.pressed}
    >
      <Icon name={icon} size={size >= 40 ? 'medium' : 'small'} color={colors[tone ?? iconToken[variant]]} />
    </PressableScale>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    base: {
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plain: { backgroundColor: 'transparent' },
    tonal: { backgroundColor: colors.primarySoft },
    filled: { backgroundColor: colors.primary },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
  });
}

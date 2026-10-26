import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Palette, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'dangerSolid' | 'inverse';
type Size = 'small' | 'medium' | 'large';

const foregroundToken: Record<Variant, keyof Palette> = {
  primary: 'onPrimary',
  secondary: 'textPrimary',
  tonal: 'primaryText',
  ghost: 'primaryText',
  danger: 'error',
  dangerSolid: 'surface',
  inverse: 'hero',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  trailingIcon,
  iconPosition = 'leading',
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Optional second icon on the opposite side of `icon`. */
  trailingIcon?: IconName;
  iconPosition?: 'leading' | 'trailing';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const inactive = disabled || loading;
  const foreground = colors[foregroundToken[variant]];
  const iconSize = size === 'small' ? 'small' : 'medium';
  const leadingName = trailingIcon ? icon : iconPosition === 'leading' ? icon : undefined;
  const trailingName = trailingIcon ?? (iconPosition === 'trailing' ? icon : undefined);

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === 'small' ? 6 : undefined}
      style={[styles.base, styles[size], styles[variant], disabled && styles.disabled, style]}
      pressedStyle={styles[`${variant}Pressed`]}
    >
      <View style={[styles.content, loading && styles.hidden]}>
        {leadingName ? <Icon name={leadingName} size={iconSize} color={foreground} /> : null}
        <Text
          variant="button"
          numberOfLines={1}
          style={[{ color: foreground }, size === 'small' && styles.smallLabel]}
        >
          {label}
        </Text>
        {trailingName ? <Icon name={trailingName} size={iconSize} color={foreground} /> : null}
      </View>
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator color={foreground} />
        </View>
      ) : null}
    </PressableScale>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    base: {
      borderRadius: radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space[5],
      borderWidth: 1,
      borderColor: 'transparent',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[2],
    },
    hidden: { opacity: 0 },
    spinner: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    small: { minHeight: 36, paddingHorizontal: space[3], borderRadius: radius.small },
    medium: { minHeight: 48 },
    large: { minHeight: 56 },
    smallLabel: { fontSize: 14 },
    primary: { backgroundColor: colors.primary },
    primaryPressed: { backgroundColor: colors.primaryPressed },
    secondary: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
    secondaryPressed: { backgroundColor: colors.surfaceSecondary },
    tonal: { backgroundColor: colors.primarySoft },
    tonalPressed: { opacity: 0.8 },
    ghost: { backgroundColor: 'transparent' },
    ghostPressed: { backgroundColor: colors.surfaceSecondary },
    danger: { backgroundColor: colors.errorSoft },
    dangerPressed: { opacity: 0.8 },
    dangerSolid: { backgroundColor: colors.error },
    dangerSolidPressed: { opacity: 0.88 },
    inverse: { backgroundColor: colors.onHero },
    inversePressed: { opacity: 0.9 },
    disabled: { opacity: 0.45 },
  });
}

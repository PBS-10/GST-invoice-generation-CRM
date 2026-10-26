import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { typography, type Palette, type TypographyVariant } from '../../theme/theme';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'brand'
  | 'onPrimary'
  | 'onHero'
  | 'onHeroMuted'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const toneColor: Record<TextTone, keyof Palette> = {
  primary: 'textPrimary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  brand: 'primaryText',
  onPrimary: 'onPrimary',
  onHero: 'onHero',
  onHeroMuted: 'onHeroMuted',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Fixed-width digits so amounts line up in columns. */
  tabular?: boolean;
  align?: 'left' | 'center' | 'right';
};

const headingVariants: ReadonlySet<TypographyVariant> = new Set(['display', 'h1', 'h2']);

export function Text({
  variant = 'body',
  tone = 'primary',
  tabular = false,
  align,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...props
}: AppTextProps) {
  const { colors } = useTheme();
  const isHeading = headingVariants.has(variant);
  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (isHeading ? 'header' : undefined)}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isHeading ? 1.4 : 1.8)}
      style={[
        typography[variant],
        { color: colors[toneColor[tone]] },
        tabular && { fontVariant: ['tabular-nums'] },
        align && { textAlign: align },
        style,
      ]}
      {...props}
    />
  );
}

import { typography, type TypographyVariant } from '../../theme/theme';
import { formatRupees, rupeeParts } from '../../utils/format';
import { Text, type TextTone } from './AppText';

/**
 * Money, set in tabular figures with Indian digit grouping. Large amounts
 * quieten the paise so the rupee figure reads first.
 */
export function Amount({
  paise,
  variant = 'bodyMedium',
  tone = 'primary',
  quietPaise = false,
  strike = false,
}: {
  paise: number;
  variant?: TypographyVariant;
  tone?: TextTone;
  quietPaise?: boolean;
  strike?: boolean;
}) {
  const { sign, rupees, paise: fraction } = rupeeParts(paise);
  const label = formatRupees(paise);
  const strikeStyle = strike ? { textDecorationLine: 'line-through' as const } : null;

  if (!quietPaise) {
    return (
      <Text variant={variant} tone={tone} tabular accessibilityLabel={label} style={strikeStyle}>
        {label}
      </Text>
    );
  }

  const size = typography[variant].fontSize;
  return (
    <Text variant={variant} tone={tone} tabular accessibilityLabel={label} style={strikeStyle}>
      <Text variant={variant} tone={tone} style={{ fontSize: size * 0.62, fontWeight: '600' }}>
        {sign}₹
      </Text>
      {rupees}
      <Text variant={variant} tone={tone} style={{ fontSize: size * 0.5, opacity: 0.7 }}>
        .{fraction}
      </Text>
    </Text>
  );
}

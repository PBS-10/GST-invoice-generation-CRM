import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { haptics } from '../../utils/haptics';
import { Text } from './AppText';
import { PressableScale } from './PressableScale';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <PressableScale
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      scaleTo={0.95}
      hitSlop={4}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.selected]}
      pressedStyle={!selected && styles.pressed}
    >
      <Text variant="label" tone={selected ? 'brand' : 'secondary'}>
        {label}
      </Text>
    </PressableScale>
  );
}

/** Single-choice chips that wrap. For long lists use SelectField instead. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    group: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space[2],
    },
    chip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: space[4],
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    selected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryText,
    },
    pressed: {
      backgroundColor: colors.surfaceSecondary,
    },
  });
}

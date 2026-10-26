import { Platform, StyleSheet, Switch, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/theme';
import { haptics } from '../../utils/haptics';
import { Text } from './AppText';

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="bodyMedium">{label}</Text>
        {description ? (
          <Text variant="bodySmall" tone="secondary">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          haptics.selection();
          onValueChange(next);
        }}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ false: colors.borderStrong, true: colors.primary }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? colors.onPrimary : colors.surface}
        ios_backgroundColor={colors.borderStrong}
        // react-native-web colours the "on" thumb from a separate prop.
        {...(Platform.OS === 'web' ? { activeThumbColor: colors.onPrimary } : null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  text: {
    flex: 1,
    gap: 2,
  },
});

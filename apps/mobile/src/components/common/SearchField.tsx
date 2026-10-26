import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, typography, type Theme } from '../../theme/theme';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus = false,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.wrap, style]}>
      <Icon name="search" size="small" tone="textTertiary" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primaryText}
        cursorColor={colors.primaryText}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityRole="search"
        accessibilityLabel={placeholder}
        style={styles.input}
      />
      {value.length > 0 ? (
        <IconButton
          icon="close-circle"
          accessibilityLabel="Clear search"
          size={28}
          tone="textTertiary"
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    wrap: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingLeft: space[3],
      paddingRight: space[1],
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceSecondary,
    },
    input: {
      flex: 1,
      fontSize: typography.body.fontSize,
      color: colors.textPrimary,
      paddingVertical: space[2],
    },
  });
}

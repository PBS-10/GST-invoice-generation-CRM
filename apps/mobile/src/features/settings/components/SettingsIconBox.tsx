import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '../../../components/common/Icon';
import { useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, type Theme } from '../../../theme/theme';

/** Squared icon tile used on settings hub rows (reference: outlined glyph box). */
export function SettingsIconBox({ name }: { name: IconName }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.box} accessibilityElementsHidden importantForAccessibility="no">
      <Icon name={name} size="medium" tone="textPrimary" />
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    box: {
      width: 36,
      height: 36,
      borderRadius: radius.small,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
  });
}

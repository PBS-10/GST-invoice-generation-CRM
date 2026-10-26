import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { initials } from '../../utils/format';
import { Text } from './AppText';
import { Icon, type IconName } from './Icon';

/**
 * People are round, things are squircles. The shape tells customers and
 * products apart at a glance without adding colour noise.
 */
export function Avatar({
  name,
  icon,
  shape = 'circle',
  size = 40,
  tone = 'brand',
}: {
  name?: string;
  icon?: IconName;
  shape?: 'circle' | 'square';
  size?: number;
  tone?: 'brand' | 'neutral';
}) {
  const { colors } = useTheme();
  const background = tone === 'brand' ? colors.primarySoft : colors.surfaceSecondary;
  const foreground = tone === 'brand' ? colors.primaryText : colors.textSecondary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : radius.medium,
          backgroundColor: background,
        },
      ]}
    >
      {icon ? (
        <Icon name={icon} size={size >= 40 ? 'medium' : 'small'} color={foreground} />
      ) : (
        <Text
          variant="label"
          maxFontSizeMultiplier={1.2}
          style={{ color: foreground, fontSize: size * 0.36 }}
        >
          {initials(name ?? '')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

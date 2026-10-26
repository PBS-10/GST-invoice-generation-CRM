import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: inset },
        style,
      ]}
    />
  );
}

/**
 * The receipt rule: a dashed line used where an invoice's totals begin.
 * Single-sided dashed borders render unreliably, so a fully dashed box is
 * clipped down to its top edge.
 */
export function DashedRule({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.clip, style]}>
      <View style={[styles.dash, { borderColor: colors.borderStrong }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    height: 1,
    overflow: 'hidden',
  },
  dash: {
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 1,
  },
});

import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, type Palette } from '../../theme/theme';
import { Text } from './AppText';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';

const toneTokens: Record<BadgeTone, { bg: keyof Palette; fg: keyof Palette }> = {
  neutral: { bg: 'surfaceSecondary', fg: 'textSecondary' },
  brand: { bg: 'primarySoft', fg: 'primaryText' },
  success: { bg: 'successSoft', fg: 'success' },
  warning: { bg: 'warningSoft', fg: 'warning' },
  error: { bg: 'errorSoft', fg: 'error' },
  info: { bg: 'infoSoft', fg: 'info' },
};

export function Badge({
  label,
  tone = 'neutral',
  dot = false,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  const { colors } = useTheme();
  const { bg, fg } = toneTokens[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[bg] }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: colors[fg] }]} /> : null}
      <Text variant="caption" style={[styles.label, { color: colors[fg] }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
  },
});

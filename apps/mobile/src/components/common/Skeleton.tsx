import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/theme';

const useNativeDriver = Platform.OS !== 'web';
/** Local reads are usually instant; waiting a beat avoids a skeleton flash. */
const REVEAL_DELAY_MS = 160;

function useSkeletonOpacity() {
  const { reducedMotion } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const reveal = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      delay: REVEAL_DELAY_MS,
      useNativeDriver,
    });
    if (reducedMotion) {
      reveal.start();
      return () => reveal.stop();
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    const sequence = Animated.sequence([reveal, pulse]);
    sequence.start();
    return () => sequence.stop();
  }, [opacity, reducedMotion]);

  return opacity;
}

export function SkeletonBlock({
  width = '100%',
  height = 14,
  rounded = radius.small,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[{ width, height, borderRadius: rounded, backgroundColor: colors.skeleton }, style]}
    />
  );
}

/** Placeholder for an inset-grouped list while it loads. */
export function SkeletonList({ rows = 5, avatar = true }: { rows?: number; avatar?: boolean }) {
  const { colors } = useTheme();
  const opacity = useSkeletonOpacity();
  return (
    <Animated.View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={[
        styles.group,
        { opacity, backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={[
            styles.row,
            index < rows - 1 && { borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth },
          ]}
        >
          {avatar ? <SkeletonBlock width={40} height={40} rounded={20} /> : null}
          <View style={styles.lines}>
            <SkeletonBlock width={index % 2 === 0 ? '62%' : '48%'} height={14} />
            <SkeletonBlock width={index % 2 === 0 ? '38%' : '52%'} height={12} />
          </View>
          <SkeletonBlock width={56} height={14} />
        </View>
      ))}
    </Animated.View>
  );
}

/** Freeform skeleton layout: wrap any SkeletonBlocks to get the reveal and pulse. */
export function SkeletonGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSkeletonOpacity();
  return (
    <Animated.View accessibilityLabel="Loading" accessibilityRole="progressbar" style={[style, { opacity }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    minHeight: 64,
  },
  lines: {
    flex: 1,
    gap: space[2],
  },
});

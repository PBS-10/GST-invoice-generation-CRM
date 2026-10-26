import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { motion, radius, space, type Theme } from '../../theme/theme';
import { haptics } from '../../utils/haptics';
import { Text } from './AppText';
import { PressableScale } from './PressableScale';

const TRACK_PADDING = 3;
const useNativeDriver = Platform.OS !== 'web';

export type Segment<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const { reducedMotion } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value),
  );
  const position = useRef(new Animated.Value(index)).current;
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / segments.length : 0;

  useEffect(() => {
    if (reducedMotion) {
      position.setValue(index);
      return;
    }
    Animated.timing(position, {
      toValue: index,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  }, [index, position, reducedMotion]);

  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              width: segmentWidth,
              transform: [
                {
                  translateX: position.interpolate({
                    inputRange: [0, Math.max(1, segments.length - 1)],
                    outputRange: [0, segmentWidth * Math.max(1, segments.length - 1)],
                  }),
                },
              ],
            },
          ]}
        />
      ) : null}
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <PressableScale
            key={segment.value}
            scaleTo={1}
            onPress={() => {
              if (!selected) {
                haptics.selection();
                onChange(segment.value);
              }
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={segment.label}
            style={styles.segment}
          >
            <Text
              variant="label"
              tone={selected ? 'primary' : 'secondary'}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {segment.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function createStyles({ colors, elevation, scheme }: Theme) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: TRACK_PADDING,
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceSecondary,
    },
    thumb: {
      position: 'absolute',
      top: TRACK_PADDING,
      bottom: TRACK_PADDING,
      left: TRACK_PADDING,
      borderRadius: radius.medium - TRACK_PADDING,
      backgroundColor: scheme === 'dark' ? colors.borderStrong : colors.surfaceElevated,
      boxShadow: elevation.low,
    },
    segment: {
      flex: 1,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space[2],
    },
  });
}

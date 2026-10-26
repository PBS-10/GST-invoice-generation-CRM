import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';

export type GroupPosition = { first: boolean; last: boolean };

/**
 * A row inside an inset-grouped list. Rows share one rounded surface instead
 * of each being its own card, which keeps long lists light.
 */
export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron = Boolean(onPress),
  position = { first: true, last: true },
  accessibilityLabel,
  accessibilityHint,
  dimmed = false,
  style,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  position?: GroupPosition;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  const rowStyle = [
    styles.row,
    position.first && styles.first,
    position.last && styles.last,
    style,
  ];

  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={[styles.main, !position.last && styles.divider, dimmed && styles.dimmed]}>
        <View style={styles.text}>
          <Text variant="bodyMedium" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        {chevron ? <Icon name="chevron-forward" size="small" tone="textTertiary" /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={rowStyle}
      pressedStyle={styles.pressed}
    >
      {content}
    </PressableScale>
  );
}

export function groupPosition(index: number, count: number): GroupPosition {
  return { first: index === 0, last: index === count - 1 };
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingLeft: space[4],
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    first: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopLeftRadius: radius.large,
      borderTopRightRadius: radius.large,
    },
    last: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomLeftRadius: radius.large,
      borderBottomRightRadius: radius.large,
    },
    pressed: {
      backgroundColor: colors.surfaceSecondary,
    },
    leading: {
      marginRight: space[3],
      paddingVertical: space[3],
    },
    main: {
      flex: 1,
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingVertical: space[3],
      paddingRight: space[4],
    },
    divider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    dimmed: {
      opacity: 0.55,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    trailing: {
      alignItems: 'flex-end',
      gap: 4,
    },
  });
}

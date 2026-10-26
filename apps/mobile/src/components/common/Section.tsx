import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { space } from '../../theme/theme';
import { Text } from './AppText';
import { PressableScale } from './PressableScale';

export function Section({
  title,
  description,
  action,
  children,
  gap = space[4],
  style,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.section, style]}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="h3" accessibilityRole="header">
              {title}
            </Text>
            {description ? (
              <Text variant="bodySmall" tone="secondary">
                {description}
              </Text>
            ) : null}
          </View>
          {action ? (
            <PressableScale
              onPress={action.onPress}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Text variant="label" tone="brand">
                {action.label}
              </Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      <View style={{ gap }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
});

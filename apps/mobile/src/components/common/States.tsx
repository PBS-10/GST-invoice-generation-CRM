import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { space, type Palette } from '../../theme/theme';
import { Text } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type Action = { label: string; onPress: () => void; icon?: IconName };

function StateLayout({
  icon,
  iconBg,
  iconFg,
  title,
  message,
  action,
  secondaryAction,
  compact,
  style,
}: {
  icon: IconName;
  iconBg: keyof Palette;
  iconFg: keyof Palette;
  title: string;
  message?: string;
  action?: Action;
  secondaryAction?: Action;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.compact, style]}>
      <View style={[styles.icon, { backgroundColor: colors[iconBg] }]}>
        <Icon name={icon} size="large" color={colors[iconFg]} />
      </View>
      <View style={styles.text}>
        <Text variant="h3" align="center">
          {title}
        </Text>
        {message ? (
          <Text variant="bodySmall" tone="secondary" align="center" style={styles.message}>
            {message}
          </Text>
        ) : null}
      </View>
      {action || secondaryAction ? (
        <View style={styles.actions}>
          {action ? (
            <Button label={action.label} icon={action.icon} onPress={action.onPress} variant="tonal" />
          ) : null}
          {secondaryAction ? (
            <Button
              label={secondaryAction.label}
              icon={secondaryAction.icon}
              onPress={secondaryAction.onPress}
              variant="ghost"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Explains what is empty, why, and the next step. */
export function EmptyState(props: {
  icon: IconName;
  title: string;
  message?: string;
  action?: Action;
  secondaryAction?: Action;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <StateLayout {...props} iconBg="primarySoft" iconFg="primaryText" />;
}

/** Explains what went wrong and offers a way back. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  compact,
  style,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <StateLayout
      icon="alert-circle-outline"
      iconBg="errorSoft"
      iconFg="error"
      title={title}
      message={message}
      action={onRetry ? { label: 'Try again', onPress: onRetry, icon: 'refresh' } : undefined}
      compact={compact}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: space[12],
    paddingHorizontal: space[6],
  },
  compact: {
    paddingVertical: space[8],
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: space[1],
    alignItems: 'center',
    maxWidth: 320,
  },
  message: {
    lineHeight: 20,
  },
  actions: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space[1],
  },
});

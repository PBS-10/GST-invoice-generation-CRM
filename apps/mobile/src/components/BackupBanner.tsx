import type { BackupStatus } from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import type { TabScreenNavigation } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store';
import { backupActions } from '../store/slices/backupSlice';
import { useThemedStyles } from '../theme/ThemeProvider';
import { radius, space, type Theme } from '../theme/theme';
import { isCloudBackupEnabled } from '../services/sync/config';
import { Text } from './common/AppText';
import { Icon, type IconName } from './common/Icon';
import { PressableScale } from './common/PressableScale';

type BannerCopy = {
  title: string;
  subtitle: string;
  icon: IconName;
  route: 'SignIn' | 'CreateAccount' | 'BackupDevices' | null;
};

function copyFor(status: BackupStatus, accountEmail: string | null): BannerCopy | null {
  switch (status) {
    case 'anonymous':
      return {
        title: 'Protect your shop data',
        subtitle: 'Create a free backup account so another phone can restore your bills.',
        icon: 'cloud-outline',
        route: 'CreateAccount',
      };
    case 'paused_auth':
      return {
        title: 'Backup paused — tap to sign in',
        subtitle: 'Bills on this phone are safe. Sign in again to resume cloud backup.',
        icon: 'lock-closed-outline',
        route: 'SignIn',
      };
    case 'paused_network':
      return {
        title: 'Backup waiting for internet',
        subtitle: accountEmail
          ? 'Changes stay on this phone until you are online again.'
          : 'Connect to the internet to back up.',
        icon: 'wifi-outline',
        route: 'BackupDevices',
      };
    case 'needs_attention':
      return {
        title: 'Backup needs attention',
        subtitle: 'Open Backup & devices to retry or sign in again.',
        icon: 'alert-circle-outline',
        route: 'BackupDevices',
      };
    case 'syncing':
    case 'synced':
      return null;
    default:
      return null;
  }
}

export function BackupBanner() {
  const navigation = useNavigation<TabScreenNavigation>();
  const dispatch = useAppDispatch();
  const backup = useAppSelector((state) => state.backup);
  const styles = useThemedStyles(createStyles);

  if (!isCloudBackupEnabled()) {
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (backup.bannerDismissedDate === today) {
    return null;
  }

  const copy = copyFor(backup.status, backup.accountEmail);
  if (!copy) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={copy.title}
        accessibilityHint={copy.subtitle}
        style={styles.card}
        onPress={() => {
          if (copy.route) {
            navigation.navigate(copy.route);
          }
        }}
      >
        <View style={styles.icon}>
          <Icon name={copy.icon} tone="primaryText" />
        </View>
        <View style={styles.text}>
          <Text variant="label">{copy.title}</Text>
          <Text variant="caption" tone="secondary">
            {copy.subtitle}
          </Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Dismiss for today"
          hitSlop={12}
          onPress={() => dispatch(backupActions.dismissBannerForToday())}
          style={styles.dismiss}
        >
          <Icon name="close" size={18} tone="textTertiary" />
        </PressableScale>
      </PressableScale>
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    wrap: {
      marginBottom: space[1],
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      padding: space[3],
      borderRadius: radius.large,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    icon: {
      width: 36,
      height: 36,
      borderRadius: radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    dismiss: {
      padding: space[1],
    },
  });
}

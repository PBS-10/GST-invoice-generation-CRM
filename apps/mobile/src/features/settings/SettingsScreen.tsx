import { useNavigation } from '@react-navigation/native';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Icon } from '../../components/common/Icon';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { TabScreenNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { isCloudBackupEnabled } from '../../services/sync/config';
import { useAppSelector } from '../../store';
import { useTheme, useThemedStyles, type ThemePreference } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { SettingsIconBox } from './components/SettingsIconBox';
import { VoiceLanguagePacks } from './components/VoiceLanguagePacks';

const THEME_SEGMENTS: readonly { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.group}>
      <Text variant="label" tone="secondary" style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const { repos } = useDatabase();
  const { colors, preference, setPreference } = useTheme();
  const styles = useThemedStyles(createStyles);
  const backup = useAppSelector((state) => state.backup);
  const backupEnabled = isCloudBackupEnabled();
  const needsLoginHighlight =
    backupEnabled && (backup.status === 'anonymous' || backup.status === 'paused_auth');
  const isPausedAuth = backup.status === 'paused_auth';
  const accountRoute = isPausedAuth ? 'SignIn' : 'CreateAccount';

  const load = useCallback(async () => {
    const vendor = await repos.vendors.get();
    return { shopName: vendor?.businessName ?? 'Not set up yet' };
  }, [repos]);
  const query = useFocusedQuery(load);

  const shopRows = backupEnabled ? 2 : 1;
  const backupSubtitle = backup.accountEmail
    ? backup.accountEmail
    : needsLoginHighlight
      ? 'Sign in to secure your shop data'
      : 'Cloud copy and other phones';

  return (
    <Screen edges={['top']} gap={space[5]}>
      <ScreenHeader title="Settings" />

      {needsLoginHighlight ? (
        <View style={styles.secureCard} accessibilityRole="summary">
          <View style={styles.secureTop}>
            <View style={styles.secureIcon}>
              <Icon name="shield-outline" size="large" color={colors.onHero} />
            </View>
            <View style={styles.secureText}>
              <Text variant="bodyMedium" style={styles.secureTitle}>
                {isPausedAuth ? 'Sign in to resume backup' : 'Sign in to secure your data'}
              </Text>
              <Text variant="bodySmall" style={styles.secureSubtitle}>
                {isPausedAuth
                  ? 'Bills on this phone are safe. Sign in again to sync across phones.'
                  : 'Create a free account so your invoices stay backed up if you change phones.'}
              </Text>
            </View>
          </View>
          <Button
            label={isPausedAuth ? 'Sign in' : 'Protect data'}
            variant="inverse"
            icon={isPausedAuth ? 'log-in-outline' : 'cloud-upload-outline'}
            onPress={() => navigation.navigate(accountRoute)}
            accessibilityHint={
              isPausedAuth
                ? 'Opens sign in'
                : 'Opens create account to back up this shop'
            }
          />
        </View>
      ) : null}

      <SettingsGroup title="Shop">
        <ListItem
          title="Shop profile"
          subtitle={query.data?.shopName ?? '…'}
          leading={<SettingsIconBox name="storefront-outline" />}
          position={groupPosition(0, shopRows)}
          onPress={() => navigation.navigate('ShopProfile')}
          accessibilityHint="Edit business name, GSTIN, and address"
        />
        {backupEnabled ? (
          <ListItem
            title="Backup & devices"
            subtitle={backupSubtitle}
            leading={<SettingsIconBox name="cloud-outline" />}
            position={groupPosition(1, shopRows)}
            onPress={() =>
              navigation.navigate(needsLoginHighlight ? accountRoute : 'BackupDevices')
            }
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="Appearance">
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <SettingsIconBox name="sunny-outline" />
            <View style={styles.panelText}>
              <Text variant="bodyMedium">Theme</Text>
              <Text variant="bodySmall" tone="secondary">
                System follows your phone’s light or dark setting
              </Text>
            </View>
          </View>
          <SegmentedControl
            accessibilityLabel="Colour theme"
            segments={THEME_SEGMENTS}
            value={preference}
            onChange={setPreference}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup title="Voice">
        <VoiceLanguagePacks />
      </SettingsGroup>

      {!needsLoginHighlight ? (
        <View style={styles.about}>
          <View style={styles.aboutIcon}>
            <Icon name="shield-checkmark-outline" size="medium" tone="primaryText" />
          </View>
          <Text variant="bodySmall" tone="secondary" style={styles.aboutText}>
            Billing works offline on this phone. No account is required to create invoices.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    group: {
      gap: space[2],
    },
    groupTitle: {
      paddingHorizontal: space[1],
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    secureCard: {
      gap: space[4],
      padding: space[4],
      borderRadius: radius.large,
      backgroundColor: colors.hero,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primaryPressed,
    },
    secureTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
    },
    secureIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(247, 243, 234, 0.14)',
    },
    secureText: {
      flex: 1,
      gap: space[1],
    },
    secureTitle: {
      color: colors.onHero,
    },
    secureSubtitle: {
      color: colors.onHeroMuted,
    },
    panel: {
      gap: space[4],
      padding: space[4],
      borderRadius: radius.large,
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
    },
    panelText: {
      flex: 1,
      gap: 2,
    },
    about: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingVertical: space[4],
      paddingHorizontal: space[4],
      borderRadius: radius.large,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    aboutIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.small,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    aboutText: {
      flex: 1,
    },
  });
}

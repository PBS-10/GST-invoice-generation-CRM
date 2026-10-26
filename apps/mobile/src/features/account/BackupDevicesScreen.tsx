import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ConfirmSheet } from '../../components/common/ConfirmSheet';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useToast } from '../../components/common/Toast';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useAppSelector } from '../../store';
import { logoutAccount } from '../../services/sync/authApi';
import { apiRequest } from '../../services/sync/apiClient';
import { isCloudBackupEnabled } from '../../services/sync/config';
import { refreshBackupState } from '../../services/sync/syncScheduler';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';
import { haptics } from '../../utils/haptics';

type DeviceRow = {
  id: string;
  label: string;
  platform: string;
  seriesCode: string;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  isCurrent: boolean;
  revokedAt: string | null;
};

export function BackupDevicesScreen() {
  const { db, repos } = useDatabase();
  const navigation = useNavigation<StackNavigation>();
  const toast = useToast();
  const backup = useAppSelector((state) => state.backup);
  const styles = useThemedStyles(createStyles);
  const [signingOut, setSigningOut] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    const email = await repos.appMeta.get('accountEmail');
    const seriesCode = await repos.appMeta.getSeriesCode();
    if (!email) {
      return { email: null as string | null, seriesCode, devices: [] as DeviceRow[] };
    }
    const deviceId = await repos.appMeta.get('deviceId');
    const devices = await apiRequest<DeviceRow[]>('/devices', {
      deviceId: deviceId ?? undefined,
    });
    return { email, seriesCode, devices: devices.filter((d) => !d.revokedAt) };
  }, [repos]);

  const query = useFocusedQuery(load);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logoutAccount(repos);
      await refreshBackupState({ db, repos });
      haptics.success();
      toast.success('Signed out on this phone');
      navigation.goBack();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSigningOut(false);
    }
  }

  async function onRevoke(id: string) {
    setRevoking(true);
    try {
      const deviceId = await repos.appMeta.get('deviceId');
      await apiRequest(`/devices/${id}`, {
        method: 'DELETE',
        deviceId: deviceId ?? undefined,
      });
      haptics.success();
      toast.success('Device removed');
      setRevokeId(null);
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRevoking(false);
    }
  }

  if (!isCloudBackupEnabled()) {
    return (
      <Screen>
        <ScreenHeader title="Backup & devices" />
        <EmptyState
          icon="cloud-offline-outline"
          title="Cloud backup is not configured"
          message="Set EXPO_PUBLIC_API_URL to enable backup."
        />
      </Screen>
    );
  }

  const email = query.data?.email ?? backup.accountEmail;
  const devices = query.data?.devices ?? [];

  return (
    <Screen>
      <ScreenHeader
        title="Backup & devices"
        subtitle="Cloud copy of this shop. Billing never needs the network."
      />

      <Card variant="filled">
        <View style={styles.statusBlock}>
          <Text variant="label">{email ?? 'Not signed in'}</Text>
          <Text variant="caption" tone="secondary">
            {backup.status === 'synced' && backup.lastSyncAt
              ? `Last backup ${formatDateTime(backup.lastSyncAt)}`
              : backup.status === 'syncing'
                ? 'Backing up…'
                : backup.status === 'anonymous'
                  ? 'No cloud account on this phone'
                  : `Status: ${backup.status.replace('_', ' ')}`}
          </Text>
          {query.data?.seriesCode ? (
            <Text variant="caption" tone="secondary">
              This phone&apos;s invoice series: {query.data.seriesCode}
            </Text>
          ) : null}
          {backup.pendingCount > 0 ? (
            <Text variant="caption" tone="secondary">
              {backup.pendingCount} change{backup.pendingCount === 1 ? '' : 's'} waiting to upload
            </Text>
          ) : null}
        </View>
      </Card>

      {!email ? (
        <View style={styles.actions}>
          <Button
            label="Create backup account"
            size="large"
            onPress={() => navigation.navigate('CreateAccount')}
          />
          <Button
            label="Sign in to restore"
            variant="secondary"
            onPress={() => navigation.navigate('SignIn')}
          />
        </View>
      ) : (
        <>
          <Section title="Devices" gap={0}>
            {query.status === 'loading' ? <SkeletonList rows={2} avatar={false} /> : null}
            {query.status === 'error' && !query.data ? (
              <ErrorState compact message={query.error} onRetry={query.reload} />
            ) : null}
            {devices.map((device, index) => (
              <ListItem
                key={device.id}
                title={device.label || device.platform}
                subtitle={`${device.platform} · series ${device.seriesCode}${
                  device.isCurrent ? ' · this phone' : ''
                }${device.lastSyncAt ? ` · synced ${formatDateTime(device.lastSyncAt)}` : ''}`}
                position={groupPosition(index, devices.length)}
                chevron={false}
                trailing={
                  device.isCurrent ? undefined : (
                    <Button
                      label="Remove"
                      variant="ghost"
                      size="small"
                      onPress={() => setRevokeId(device.id)}
                    />
                  )
                }
              />
            ))}
          </Section>
          <View style={styles.actions}>
            <Button
              label="Back up now"
              variant="secondary"
              onPress={() => void refreshBackupState({ db, repos })}
            />
            <Button
              label="Sign out this phone"
              variant="dangerSolid"
              loading={signingOut}
              onPress={() => void onSignOut()}
            />
          </View>
        </>
      )}

      <ConfirmSheet
        visible={revokeId != null}
        title="Remove this device?"
        message="It will stop syncing. Its invoice series will not be reused. Bills already on that phone stay there."
        confirmLabel="Remove device"
        destructive
        loading={revoking}
        onConfirm={() => {
          if (revokeId) {
            void onRevoke(revokeId);
          }
        }}
        onCancel={() => setRevokeId(null)}
      />
    </Screen>
  );
}

function createStyles(_theme: Theme) {
  return StyleSheet.create({
    statusBlock: {
      gap: space[1],
    },
    actions: {
      gap: space[3],
      marginTop: space[4],
    },
  });
}

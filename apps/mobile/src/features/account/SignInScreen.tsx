import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { ConfirmSheet } from '../../components/common/ConfirmSheet';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { TextField } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { loginAccount, logoutAccount } from '../../services/sync/authApi';
import {
  choosePostLoginAction,
  localHasUnsyncedOrBusinessData,
  restoreFromCloud,
  resumeBackupAfterLogin,
} from '../../services/sync/restore';
import { refreshBackupState } from '../../services/sync/syncScheduler';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';

export function SignInScreen() {
  const { db, repos } = useDatabase();
  const navigation = useNavigation<StackNavigation>();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [offline, setOffline] = useState(false);
  /** Cloud vendor id from a login that is waiting on replace confirm. */
  const [pendingCloudVendorId, setPendingCloudVendorId] = useState<string | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setOffline(!state.isConnected));
    void NetInfo.fetch().then((state) => setOffline(!state.isConnected));
    return () => sub();
  }, []);

  async function finishAfterAuth(cloudVendorId: string, userConfirmedReplace: boolean) {
    const localVendor = await repos.vendors.get();
    const hasLocal = await localHasUnsyncedOrBusinessData(repos);
    const action = choosePostLoginAction({
      localVendorId: localVendor?.id ?? null,
      cloudVendorId,
      hasLocalBusinessOrUnsyncedData: hasLocal,
      userConfirmedReplace,
    });

    if (action === 'confirm_replace') {
      setPendingCloudVendorId(cloudVendorId);
      setConfirmReplace(true);
      return;
    }

    if (action === 'resume') {
      await resumeBackupAfterLogin({ db, repos });
      await refreshBackupState({ db, repos });
      haptics.success();
      toast.success('Signed in — local changes will upload to backup');
      navigation.goBack();
      return;
    }

    await restoreFromCloud({ db, repos }, { force: true });
    await refreshBackupState({ db, repos });
    haptics.success();
    toast.success('Signed in — shop restored from cloud');
    navigation.goBack();
  }

  async function completeLogin(userConfirmedReplace: boolean) {
    setBusy(true);
    try {
      // Tokens already saved if we only need confirm after a prior login attempt.
      if (userConfirmedReplace && pendingCloudVendorId) {
        await finishAfterAuth(pendingCloudVendorId, true);
        return;
      }
      const response = await loginAccount(repos, { email: email.trim(), password });
      await finishAfterAuth(response.vendorId, userConfirmedReplace);
    } catch (error) {
      haptics.error();
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (userConfirmedReplace) {
        setConfirmReplace(false);
        setPendingCloudVendorId(null);
      }
    }
  }

  async function onSubmit() {
    if (offline) {
      toast.info('Connect to the internet to sign in');
      return;
    }
    if (!email.trim() || password.length < 8) {
      toast.error('Enter your email and password (at least 8 characters)');
      return;
    }
    await completeLogin(false);
  }

  return (
    <Screen keyboard>
      <ScreenHeader
        title="Sign in"
        subtitle="Resume backup on this phone, or restore your cloud shop."
      />
      {offline ? (
        <View style={styles.banner}>
          <Text variant="bodySmall" tone="secondary">
            You are offline. Sign in is disabled until you reconnect.
          </Text>
        </View>
      ) : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!busy}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        editable={!busy}
      />
      <Button
        label="Sign in"
        onPress={() => void onSubmit()}
        loading={busy}
        disabled={offline}
        size="large"
      />
      <Button
        label="Create an account instead"
        variant="ghost"
        onPress={() => navigation.replace('CreateAccount')}
        disabled={busy}
      />
      <ConfirmSheet
        visible={confirmReplace}
        title="Replace this phone's data?"
        message="This phone already has products, customers, or invoices that are not in the cloud shop you are signing into. Continuing deletes them and restores the cloud copy. Changes only on this phone will be lost."
        confirmLabel="Replace and restore"
        cancelLabel="Cancel"
        destructive
        loading={busy}
        onConfirm={() => void completeLogin(true)}
        onCancel={() => {
          setConfirmReplace(false);
          setPendingCloudVendorId(null);
          // Login already succeeded; drop the session so we do not sync into the wrong shop.
          void logoutAccount(repos).then(() => refreshBackupState({ db, repos }));
        }}
      />
    </Screen>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    banner: {
      padding: space[3],
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
      marginBottom: space[2],
    },
  });
}

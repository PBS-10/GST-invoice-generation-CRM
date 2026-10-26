import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { TextField } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { registerAccount } from '../../services/sync/authApi';
import { refreshBackupState } from '../../services/sync/syncScheduler';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { haptics } from '../../utils/haptics';

export function CreateAccountScreen() {
  const { db, repos } = useDatabase();
  const navigation = useNavigation<StackNavigation>();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => setOffline(!state.isConnected));
    void NetInfo.fetch().then((state) => setOffline(!state.isConnected));
    return () => sub();
  }, []);

  async function onSubmit() {
    if (offline) {
      toast.info('Connect to the internet to create an account');
      return;
    }
    if (!email.trim() || password.length < 8) {
      toast.error('Use a valid email and a password of at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await registerAccount(repos, { email: email.trim(), password });
      await refreshBackupState({ db, repos });
      haptics.success();
      toast.success('Backup account created');
      navigation.goBack();
    } catch (error) {
      haptics.error();
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard>
      <ScreenHeader
        title="Create backup account"
        subtitle="Keeps a cloud copy of this shop. Billing still works offline."
      />
      {offline ? (
        <View style={styles.banner}>
          <Text variant="bodySmall" tone="secondary">
            You are offline. Creating an account needs internet.
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
        autoComplete="new-password"
        hint="At least 8 characters"
        editable={!busy}
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        editable={!busy}
      />
      <Button
        label="Create account"
        onPress={() => void onSubmit()}
        loading={busy}
        disabled={offline}
        size="large"
      />
      <Button
        label="Already have an account? Sign in"
        variant="ghost"
        onPress={() => navigation.replace('SignIn')}
        disabled={busy}
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

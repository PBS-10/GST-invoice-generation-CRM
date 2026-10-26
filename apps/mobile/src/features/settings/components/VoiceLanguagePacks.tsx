import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { BillingTranslateLang } from 'billing-translate';
import { Text } from '../../../components/common/AppText';
import { Button } from '../../../components/common/Button';
import { useToast } from '../../../components/common/Toast';
import {
  BILLING_TRANSLATE_PACKS,
  clearBillingTranscriptCache,
  translatePackLabel,
} from '../../voice';
import { loadBillingTranslate } from '../../voice/billingTranslateNative';
import { useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../../theme/theme';
import { errorMessage } from '../../../utils/errors';
import { SettingsIconBox } from './SettingsIconBox';

type PackState = 'unavailable' | 'missing' | 'ready' | 'busy' | 'error';

type PackRow = {
  lang: BillingTranslateLang;
  state: PackState;
};

export function VoiceLanguagePacks() {
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [rows, setRows] = useState<PackRow[]>(() =>
    BILLING_TRANSLATE_PACKS.map((lang) => ({ lang, state: 'missing' as PackState })),
  );

  const refresh = useCallback(async () => {
    const native = loadBillingTranslate();
    if (!native) {
      setRows(BILLING_TRANSLATE_PACKS.map((lang) => ({ lang, state: 'unavailable' })));
      return;
    }
    const next = await Promise.all(
      BILLING_TRANSLATE_PACKS.map(async (lang) => {
        try {
          const ready = await native.isModelDownloaded(lang);
          return { lang, state: (ready ? 'ready' : 'missing') as PackState };
        } catch {
          return { lang, state: 'error' as PackState };
        }
      }),
    );
    setRows(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onDownload(lang: BillingTranslateLang) {
    const native = loadBillingTranslate();
    if (!native) {
      toast.info('Voice packs need a development build (rebuild after installing).');
      return;
    }
    setRows((current) =>
      current.map((row) => (row.lang === lang ? { ...row, state: 'busy' } : row)),
    );
    try {
      await native.downloadModel(lang, { wifiOnly: true });
      toast.success(`${translatePackLabel(lang)} pack ready (~30 MB).`);
      await refresh();
    } catch (error) {
      toast.error(`Couldn't download. ${errorMessage(error)}`);
      await refresh();
    }
  }

  async function onDelete(lang: BillingTranslateLang) {
    const native = loadBillingTranslate();
    if (!native) {
      return;
    }
    setRows((current) =>
      current.map((row) => (row.lang === lang ? { ...row, state: 'busy' } : row)),
    );
    try {
      await native.deleteModel(lang);
      clearBillingTranscriptCache();
      toast.info(`${translatePackLabel(lang)} pack removed.`);
      await refresh();
    } catch (error) {
      toast.error(`Couldn't remove pack. ${errorMessage(error)}`);
      await refresh();
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <SettingsIconBox name="language-outline" />
        <View style={styles.panelText}>
          <Text variant="bodyMedium">Voice language packs</Text>
          <Text variant="bodySmall" tone="secondary">
            Hindi and Tamil translate on-device to English for matching. ~30 MB each. Download on
            Wi‑Fi. Malayalam is not supported by ML Kit — aliases are learned when you pick a
            product.
          </Text>
        </View>
      </View>

      {rows.map((row) => (
        <View key={row.lang} style={styles.row}>
          <View style={styles.rowText}>
            <Text variant="bodyMedium">{translatePackLabel(row.lang)}</Text>
            <Text variant="caption" tone="secondary">
              {statusLabel(row.state)}
            </Text>
          </View>
          {row.state === 'busy' ? (
            <ActivityIndicator />
          ) : row.state === 'ready' ? (
            <Button
              label="Remove"
              variant="secondary"
              size="small"
              onPress={() => void onDelete(row.lang)}
            />
          ) : row.state === 'unavailable' ? (
            <Text variant="caption" tone="secondary">
              Rebuild app
            </Text>
          ) : (
            <Button
              label="Download"
              size="small"
              onPress={() => void onDownload(row.lang)}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function statusLabel(state: PackState): string {
  switch (state) {
    case 'ready':
      return 'Ready offline';
    case 'missing':
      return 'Not downloaded';
    case 'busy':
      return 'Working…';
    case 'unavailable':
      return 'Native module not in this build';
    case 'error':
      return 'Could not check status';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
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
      alignItems: 'flex-start',
      gap: space[3],
    },
    panelText: {
      flex: 1,
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
  });
}

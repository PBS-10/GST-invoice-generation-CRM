import { paiseToRupeeLabel, rupeesTextToPaise } from '@invoice-gst/shared';
import type { PaymentMethod } from '@invoice-gst/types';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../../components/common/Amount';
import { Text } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { ChipGroup } from '../../../components/common/Chip';
import { SegmentedControl } from '../../../components/common/SegmentedControl';
import { TextField } from '../../../components/common/TextField';
import { useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../../theme/theme';
import { formatRupees, paymentMethodLabel } from '../../../utils/format';

const PAYMENT_METHODS = (['cash', 'upi', 'card'] as const satisfies readonly PaymentMethod[]).map(
  (value) => ({ value, label: paymentMethodLabel[value] }),
);

const QUICK_TENDER = [
  { value: 'exact', label: 'Exact' },
  { value: '10000', label: '₹100' },
  { value: '20000', label: '₹200' },
  { value: '50000', label: '₹500' },
] as const;

function paiseFieldText(paise: number): string {
  return paiseToRupeeLabel(paise).replace('₹', '');
}

function parsePaiseField(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }
  try {
    return rupeesTextToPaise(trimmed);
  } catch {
    return null;
  }
}

export type PaymentSheetResult = {
  method: PaymentMethod;
  /** Amount applied to the invoice (never above bill total). */
  amountPaise: number;
  /** Cash tendered by the customer (cash only). */
  tenderedPaise: number | null;
};

export function PaymentSheet({
  visible,
  totalPaise,
  initialMethod = 'cash',
  confirming = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  totalPaise: number;
  initialMethod?: PaymentMethod;
  confirming?: boolean;
  onClose: () => void;
  onConfirm: (result: PaymentSheetResult) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [method, setMethod] = useState<PaymentMethod>(
    initialMethod === 'credit' ? 'cash' : initialMethod,
  );
  const [tenderText, setTenderText] = useState(paiseFieldText(totalPaise));
  const [quickValue, setQuickValue] = useState<(typeof QUICK_TENDER)[number]['value']>('exact');

  useEffect(() => {
    if (!visible) {
      return;
    }
    setMethod(initialMethod === 'credit' ? 'cash' : initialMethod);
    setTenderText(paiseFieldText(totalPaise));
    setQuickValue('exact');
  }, [visible, totalPaise, initialMethod]);

  const tenderedPaise = useMemo(() => {
    if (method !== 'cash') {
      return totalPaise;
    }
    const parsed = parsePaiseField(tenderText);
    return parsed == null ? 0 : Math.max(0, parsed);
  }, [method, tenderText, totalPaise]);

  const changePaise = Math.max(0, tenderedPaise - totalPaise);
  const shortPaise = Math.max(0, totalPaise - tenderedPaise);
  const appliedPaise = method === 'cash' ? Math.min(tenderedPaise, totalPaise) : totalPaise;
  const canConfirm = method !== 'cash' || tenderedPaise > 0;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Collect payment"
      description={`Bill total ${formatRupees(totalPaise)}`}
      footer={
        <Button
          label={
            shortPaise > 0 && method === 'cash'
              ? `Take ${formatRupees(appliedPaise)} · part-paid`
              : `Confirm · ${formatRupees(appliedPaise)}`
          }
          icon="checkmark"
          size="large"
          loading={confirming}
          disabled={!canConfirm || confirming}
          onPress={() =>
            onConfirm({
              method,
              amountPaise: appliedPaise,
              tenderedPaise: method === 'cash' ? tenderedPaise : null,
            })
          }
        />
      }
    >
      <SegmentedControl
        accessibilityLabel="Payment method"
        segments={PAYMENT_METHODS}
        value={method === 'credit' ? 'cash' : method}
        onChange={setMethod}
      />

      {method === 'cash' ? (
        <View style={styles.cashBlock}>
          <TextField
            label="Amount given"
            prefix="₹"
            value={tenderText}
            onChangeText={setTenderText}
            onBlur={() => {
              const parsed = parsePaiseField(tenderText);
              setTenderText(paiseFieldText(parsed == null ? 0 : Math.max(0, parsed)));
            }}
            placeholder={paiseFieldText(totalPaise)}
            keyboardType="decimal-pad"
          />
          <ChipGroup
            accessibilityLabel="Quick cash amounts"
            options={[...QUICK_TENDER]}
            value={quickValue}
            onChange={(next) => {
              setQuickValue(next);
              if (next === 'exact') {
                setTenderText(paiseFieldText(totalPaise));
                return;
              }
              const note = Number(next);
              const tender = Math.max(note, totalPaise);
              setTenderText(paiseFieldText(tender));
            }}
          />
          <View style={styles.calcCard}>
            <View style={styles.calcRow}>
              <Text variant="bodySmall" tone="secondary">
                Bill total
              </Text>
              <Amount paise={totalPaise} variant="bodyMedium" />
            </View>
            <View style={styles.calcRow}>
              <Text variant="bodySmall" tone="secondary">
                Given
              </Text>
              <Amount paise={tenderedPaise} variant="bodyMedium" />
            </View>
            <View style={[styles.calcRow, styles.calcEmphasis]}>
              {changePaise > 0 ? (
                <>
                  <Text variant="bodyMedium" tone="brand">
                    Change to return
                  </Text>
                  <Amount paise={changePaise} variant="h3" tone="brand" />
                </>
              ) : shortPaise > 0 ? (
                <>
                  <Text variant="bodyMedium" tone="warning">
                    Still due
                  </Text>
                  <Amount paise={shortPaise} variant="h3" tone="warning" />
                </>
              ) : (
                <>
                  <Text variant="bodyMedium" tone="success">
                    Exact amount
                  </Text>
                  <Amount paise={0} variant="h3" tone="success" />
                </>
              )}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.digitalBlock}>
          <Text variant="bodySmall" tone="secondary">
            Record {paymentMethodLabel[method]} for the full bill total.
          </Text>
          <View style={styles.calcCard}>
            <View style={[styles.calcRow, styles.calcEmphasis]}>
              <Text variant="bodyMedium">Amount</Text>
              <Amount paise={totalPaise} variant="h3" />
            </View>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    cashBlock: {
      gap: space[4],
    },
    digitalBlock: {
      gap: space[3],
    },
    calcCard: {
      gap: space[3],
      padding: space[4],
      borderRadius: radius.large,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    calcRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space[3],
    },
    calcEmphasis: {
      paddingTop: space[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
  });
}

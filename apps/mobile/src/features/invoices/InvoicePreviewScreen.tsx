import {
  getFinancialYear,
  paiseToRupeeLabel,
  resolvePlaceOfSupply,
  rupeesTextToPaise,
} from '@invoice-gst/shared';
import type {
  BackupStatus,
  GstConfiguration,
  PaymentMethod,
  PaymentStatus,
  Vendor,
} from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Icon } from '../../components/common/Icon';
import { Screen } from '../../components/common/Screen';
import { SkeletonBlock, SkeletonGroup } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { TextField } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import {
  clearActiveCartAfterFinalize,
  getEditingInvoiceId,
} from '../../services/cart/cartSession';
import { clampInvoiceDiscountPaise, totalsFromDraft } from '../../services/invoice/draftTotals';
import { isCloudBackupEnabled } from '../../services/sync/config';
import { useAppDispatch, useAppSelector } from '../../store';
import { invoiceDraftActions, type InvoiceDraftState } from '../../store/slices/invoiceDraftSlice';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatRupees } from '../../utils/format';
import { haptics } from '../../utils/haptics';
import { waitForModalTeardown } from '../../utils/modalTeardown';
import {
  InvoiceReceiptPaper,
  receiptFromDraft,
} from './components/InvoiceReceiptPaper';
import { PaymentSheet, type PaymentSheetResult } from './components/PaymentSheet';

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

type LoadState = 'loading' | 'ready' | 'error';

type CommitPayment = {
  method: PaymentMethod;
  amountPaise: number;
} | null;

export function InvoicePreviewScreen() {
  const navigation = useNavigation<StackNavigation>();
  const { repos } = useDatabase();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const liveDraft = useAppSelector((state) => state.invoiceDraft);
  const backupStatus = useAppSelector((state) => state.backup.status);
  // After saving, the draft is reset while this screen animates away; keep
  // showing what was saved rather than flashing an empty bill.
  const [savedDraft, setSavedDraft] = useState<InvoiceDraftState | null>(null);
  const draft = savedDraft ?? liveDraft;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [config, setConfig] = useState<GstConfiguration | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [previewNumber, setPreviewNumber] = useState<string>('—');
  const [issuedAt] = useState(() => new Date());
  const [discountText, setDiscountText] = useState(() =>
    paiseFieldText(liveDraft.invoiceDiscountPaise),
  );
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const currentVendor = await repos.vendors.get();
        const currentConfig = currentVendor
          ? await repos.vendors.getGstConfig(currentVendor.id)
          : null;
        const editingId = await getEditingInvoiceId(repos);
        let numberLabel = '—';
        if (editingId) {
          const existing = await repos.invoices.getWithItems(editingId);
          numberLabel = existing?.invoiceNumber ?? '—';
        } else if (currentVendor) {
          numberLabel = await repos.invoices.peekNextInvoiceNumber(
            currentVendor.id,
            currentVendor.invoicePrefix,
            getFinancialYear(),
          );
        }
        if (!active) {
          return;
        }
        setVendor(currentVendor);
        setConfig(currentConfig);
        setEditingInvoiceId(editingId);
        setPreviewNumber(numberLabel);
        setLoadState('ready');
      } catch (error) {
        if (active) {
          setLoadError(errorMessage(error));
          setLoadState('error');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [repos, attempt]);

  const totals = useMemo(() => {
    if (!vendor) {
      return null;
    }
    return totalsFromDraft(draft, vendor, config);
  }, [config, draft, vendor]);

  function onDiscountChange(value: string) {
    setDiscountText(value);
    const parsed = parsePaiseField(value);
    if (parsed == null || !totals) {
      return;
    }
    dispatch(
      invoiceDraftActions.setDiscountPaise(
        clampInvoiceDiscountPaise(parsed, totals.subtotalPaise),
      ),
    );
  }

  async function commitInvoice(payment: CommitPayment) {
    if (!vendor || !totals || draft.lines.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const place = resolvePlaceOfSupply(vendor.stateCode, draft.customerSnapshot.stateCode);
      const paymentStatus: PaymentStatus = !payment
        ? 'unpaid'
        : payment.amountPaise >= totals.totalPaise
          ? 'paid'
          : payment.amountPaise > 0
            ? 'partial'
            : 'unpaid';
      const invoiceBody = {
        customerId: draft.customerId,
        customerSnapshot: draft.customerSnapshot,
        placeOfSupplyStateCode: place.placeOfSupplyStateCode,
        isInterState: place.isInterState,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxablePaise: totals.taxablePaise,
        cgstPaise: totals.cgstPaise,
        sgstPaise: totals.sgstPaise,
        igstPaise: totals.igstPaise,
        roundOffPaise: totals.roundOffPaise,
        totalPaise: totals.totalPaise,
        paymentStatus,
        notes: draft.notes || null,
      };
      const items = draft.lines.map((line, index) => {
        const lineTotals = totals.lines[index];
        return {
          productId: line.productId,
          productNameSnapshot: line.productName,
          localNameSnapshot: line.localName,
          hsnSnapshot: line.hsnCode,
          unitSnapshot: line.unit,
          quantityMilli: line.quantityMilli,
          unitPricePaise: line.unitPricePaise,
          gstRateBps: line.gstRateBps,
          priceInclusive: line.priceInclusive,
          taxablePaise: lineTotals?.taxablePaise ?? 0,
          cgstPaise: lineTotals?.cgstPaise ?? 0,
          sgstPaise: lineTotals?.sgstPaise ?? 0,
          igstPaise: lineTotals?.igstPaise ?? 0,
          lineTotalPaise: lineTotals?.lineTotalPaise ?? 0,
        };
      });
      const paymentRow =
        payment && payment.amountPaise > 0
          ? { method: payment.method, amountPaise: payment.amountPaise }
          : undefined;

      const editingId = await getEditingInvoiceId(repos);
      const invoice = editingId
        ? await repos.invoices.replaceUnpaid(editingId, {
            invoice: invoiceBody,
            items,
            payment: paymentRow,
          })
        : await repos.invoices.finalize({
            vendorId: vendor.id,
            prefix: vendor.invoicePrefix,
            invoice: {
              ...invoiceBody,
              financialYear: getFinancialYear(),
            },
            items,
            payment: paymentRow,
          });
      haptics.success();
      const paidNote =
        paymentStatus === 'paid'
          ? ' · paid'
          : paymentStatus === 'partial'
            ? ' · part-paid'
            : ' · unpaid';
      const successMessage = editingId
        ? `Invoice ${invoice.invoiceNumber} updated${paidNote}`
        : `Invoice ${invoice.invoiceNumber} saved${paidNote}`;
      await maybeNudgeBackup(repos, backupStatus, toast.info);
      setSavedDraft(draft);
      // Close the payment Modal before navigating — Android Fabric crashes if
      // replace() runs while a Modal host still owns the sheet views.
      Keyboard.dismiss();
      setPaymentOpen(false);
      await clearActiveCartAfterFinalize(repos);
      await waitForModalTeardown();
      if (!aliveRef.current) {
        return;
      }
      navigation.replace('InvoiceDetail', { invoiceId: invoice.id });
      toast.success(successMessage);
    } catch (error) {
      haptics.error();
      toast.error(`Couldn't save the invoice. ${errorMessage(error)}`);
    } finally {
      if (aliveRef.current) {
        setSaving(false);
      }
    }
  }

  function onPaymentConfirm(result: PaymentSheetResult) {
    void commitInvoice({ method: result.method, amountPaise: result.amountPaise });
  }

  if (loadState === 'loading') {
    return (
      <Screen>
        <PreviewSkeleton />
      </Screen>
    );
  }

  if (loadState === 'error') {
    return (
      <Screen>
        <ErrorState
          title="Couldn't load your shop profile"
          message={loadError ?? undefined}
          onRetry={() => {
            setLoadState('loading');
            setAttempt((value) => value + 1);
          }}
        />
      </Screen>
    );
  }

  if (!vendor || !totals) {
    return (
      <Screen>
        <EmptyState
          icon="storefront-outline"
          title="Add your shop details first"
          message="Invoices need your business name and state to work out GST."
          action={{
            label: 'Open shop settings',
            onPress: () => navigation.navigate('Tabs', { screen: 'Settings' }),
          }}
        />
      </Screen>
    );
  }

  if (draft.lines.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="basket-outline"
          title="This bill has no items"
          message="Go back and add at least one product to review the invoice."
          action={{ label: 'Back to bill', icon: 'arrow-back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const place = resolvePlaceOfSupply(vendor.stateCode, draft.customerSnapshot.stateCode);

  return (
    <Screen
      keyboard
      gap={space[4]}
      footer={
        <View style={styles.footerActions}>
          <Button
            label={editingInvoiceId ? 'Save unpaid' : 'Save invoice'}
            variant="secondary"
            icon="document-outline"
            size="large"
            onPress={() => void commitInvoice(null)}
            loading={saving && !paymentOpen}
            disabled={saving}
            style={styles.footerSave}
            accessibilityHint="Saves this bill as unpaid"
          />
          <Button
            label="Payment"
            icon="wallet-outline"
            trailingIcon="arrow-forward"
            size="large"
            onPress={() => setPaymentOpen(true)}
            disabled={saving}
            style={styles.footerPay}
            accessibilityHint="Opens payment methods and cash change calculator"
          />
        </View>
      }
    >
      <InvoiceReceiptPaper
        receipt={receiptFromDraft({
          vendor,
          draft,
          totals,
          isInterState: place.isInterState,
          placeOfSupplyStateCode: place.placeOfSupplyStateCode,
          invoiceNumber: previewNumber,
          issuedAt,
        })}
      />

      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View style={styles.fieldIcon}>
            <Text variant="h3" tone="onPrimary">
              %
            </Text>
          </View>
          <View style={styles.fieldCopy}>
            <View style={styles.fieldTitleRow}>
              <Text variant="bodyMedium">Invoice discount</Text>
              <View style={styles.optionalPill}>
                <Text variant="caption" tone="tertiary">
                  Optional
                </Text>
              </View>
            </View>
            <Text variant="caption" tone="secondary">
              Optional amount off the bill before tax is finalised.
            </Text>
          </View>
        </View>
        <TextField
          label="Invoice discount"
          hideLabel
          inset
          optional
          prefix="₹"
          value={discountText}
          onChangeText={onDiscountChange}
          onBlur={() => {
            setDiscountText(paiseFieldText(draft.invoiceDiscountPaise));
          }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          hint={
            draft.invoiceDiscountPaise > 0
              ? `Applied · max ${formatRupees(totals.subtotalPaise)}`
              : undefined
          }
        />
      </View>

      <View style={styles.fieldCard}>
        <View style={styles.fieldHeader}>
          <View style={styles.fieldIcon}>
            <Icon name="document-text-outline" size="medium" tone="onPrimary" />
          </View>
          <View style={styles.fieldCopy}>
            <View style={styles.fieldTitleRow}>
              <Text variant="bodyMedium">Notes</Text>
              <View style={styles.optionalPill}>
                <Text variant="caption" tone="tertiary">
                  Optional
                </Text>
              </View>
            </View>
            <Text variant="caption" tone="secondary">
              Add any additional notes to appear on the invoice.
            </Text>
          </View>
        </View>
        <TextField
          label="Notes"
          hideLabel
          inset
          optional
          multiline
          value={draft.notes}
          onChangeText={(value) => dispatch(invoiceDraftActions.setNotes(value))}
          placeholder="Enter note (optional)..."
        />
      </View>

      <PaymentSheet
        visible={paymentOpen}
        totalPaise={totals.totalPaise}
        initialMethod={draft.paymentMethod}
        confirming={saving}
        onClose={() => {
          if (!saving) {
            setPaymentOpen(false);
          }
        }}
        onConfirm={onPaymentConfirm}
      />
    </Screen>
  );
}

function PreviewSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <SkeletonGroup style={styles.skeleton}>
      <SkeletonBlock height={220} rounded={radius.medium} />
      <SkeletonBlock height={120} rounded={radius.large} />
      <SkeletonBlock height={120} rounded={radius.large} />
    </SkeletonGroup>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    fieldCard: {
      gap: space[4],
      padding: space[4],
      borderRadius: radius.large,
      backgroundColor: colors.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    fieldHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
    },
    fieldIcon: {
      width: 42,
      height: 42,
      borderRadius: radius.medium,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
      paddingTop: 1,
    },
    fieldTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      flexWrap: 'wrap',
    },
    optionalPill: {
      paddingHorizontal: space[2],
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    footerActions: {
      flexDirection: 'row',
      gap: space[3],
    },
    footerSave: {
      flex: 0.95,
    },
    footerPay: {
      flex: 1.15,
    },
    skeleton: {
      gap: space[4],
    },
  });
}

async function maybeNudgeBackup(
  repos: ReturnType<typeof useDatabase>['repos'],
  status: BackupStatus,
  info: (message: string) => void,
) {
  if (!isCloudBackupEnabled()) {
    return;
  }
  if (status !== 'anonymous' && status !== 'paused_auth' && status !== 'paused_network') {
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const last = await repos.appMeta.get('lastBackupNudgeDate');
  if (last === today) {
    return;
  }
  await repos.appMeta.set('lastBackupNudgeDate', today);
  info('Saved on this phone. Sign in to keep a cloud copy.');
}

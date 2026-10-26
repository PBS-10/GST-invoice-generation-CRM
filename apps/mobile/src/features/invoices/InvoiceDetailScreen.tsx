import type { Vendor } from '@invoice-gst/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { ConfirmSheet } from '../../components/common/ConfirmSheet';
import { Divider } from '../../components/common/Divider';
import { Icon } from '../../components/common/Icon';
import { Screen } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SkeletonBlock, SkeletonGroup } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useToast } from '../../components/common/Toast';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { startEditingUnpaidInvoice } from '../../services/cart/cartSession';
import { shareInvoicePdf } from '../../services/pdf/shareInvoicePdf';
import {
  isPrinterConfigured,
  UnsupportedPrinterError,
  unsupportedPrinterPort,
} from '../../services/print/PrinterPort';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatDateTime, paymentMethodLabel } from '../../utils/format';
import { haptics } from '../../utils/haptics';
import {
  InvoiceReceiptPaper,
  receiptFromInvoice,
} from './components/InvoiceReceiptPaper';
import { InvoiceStatusBadge } from './components/InvoiceStatusBadge';

export function InvoiceDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'InvoiceDetail'>) {
  const { repos } = useDatabase();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [invoice, vendor] = await Promise.all([
      repos.invoices.getWithItems(route.params.invoiceId),
      repos.vendors.get(),
    ]);
    return { invoice, vendor };
  }, [repos, route.params.invoiceId]);
  const query = useFocusedQuery(load);
  const invoice = query.data?.invoice ?? null;
  const vendor: Vendor | null = query.data?.vendor ?? null;

  async function onShare() {
    if (!invoice || !vendor) {
      return;
    }
    setSharing(true);
    try {
      await shareInvoicePdf({ vendor, invoice });
    } catch (error) {
      toast.error(`Couldn't share the PDF. ${errorMessage(error)}`);
    } finally {
      setSharing(false);
    }
  }

  async function onPrint() {
    if (!invoice || !vendor) {
      return;
    }
    if (!isPrinterConfigured()) {
      toast.info('Printing needs a shop printer model. Share the PDF for now.');
      return;
    }
    setPrinting(true);
    try {
      await unsupportedPrinterPort.connect();
      await unsupportedPrinterPort.printInvoice({ vendor, invoice });
      await unsupportedPrinterPort.disconnect();
      haptics.success();
      toast.success('Sent to printer');
    } catch (error) {
      if (error instanceof UnsupportedPrinterError) {
        toast.info(error.message);
      } else {
        toast.error(`Couldn't print. ${errorMessage(error)}`);
      }
    } finally {
      setPrinting(false);
    }
  }

  async function onCancel() {
    setCancelling(true);
    try {
      await repos.invoices.cancel(route.params.invoiceId);
      haptics.warning();
      toast.info('Invoice cancelled');
      setConfirmingCancel(false);
      query.reload();
    } catch (error) {
      toast.error(`Couldn't cancel. ${errorMessage(error)}`);
    } finally {
      setCancelling(false);
    }
  }

  async function onEditItems() {
    setEditing(true);
    try {
      await startEditingUnpaidInvoice(repos, route.params.invoiceId);
      navigation.navigate('InvoiceCreate');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setEditing(false);
    }
  }

  if (query.status === 'loading') {
    return (
      <Screen>
        <DetailSkeleton />
      </Screen>
    );
  }

  if (query.status === 'error' && !invoice) {
    return (
      <Screen>
        <ErrorState title="Couldn't open this invoice" message={query.error} onRetry={query.reload} />
      </Screen>
    );
  }

  if (!invoice || !vendor) {
    return (
      <Screen>
        <EmptyState
          icon="document-outline"
          title="Invoice not found"
          message="It may have been removed from this device."
          action={{ label: 'Go back', icon: 'arrow-back', onPress: () => navigation.goBack() }}
        />
      </Screen>
    );
  }

  const cancelled = invoice.status === 'cancelled';
  const canEditItems = invoice.status === 'finalized' && invoice.paymentStatus !== 'paid';
  const receipt = receiptFromInvoice(vendor, invoice);

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button
            label="Share PDF"
            icon="share-outline"
            onPress={() => void onShare()}
            loading={sharing}
            style={styles.primaryAction}
          />
          <Button
            label="Print"
            variant="secondary"
            icon="print-outline"
            onPress={() => void onPrint()}
            loading={printing}
            accessibilityHint="Thermal print when a shop printer is configured"
          />
          {canEditItems ? (
            <Button
              label="Edit items"
              variant="secondary"
              icon="create-outline"
              onPress={() => void onEditItems()}
              loading={editing}
              accessibilityHint="Opens this unpaid bill in the cart so you can add or remove products"
            />
          ) : null}
          {invoice.status === 'finalized' ? (
            <Button
              label="Cancel"
              variant="danger"
              icon="close-circle-outline"
              onPress={() => setConfirmingCancel(true)}
              accessibilityHint="Asks for confirmation before cancelling"
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.statusRow}>
        <InvoiceStatusBadge status={invoice.status} paymentStatus={invoice.paymentStatus} />
      </View>

      {cancelled ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Icon name="ban-outline" size="small" tone="error" />
          <Text variant="bodySmall" tone="error" style={styles.bannerText}>
            This invoice was cancelled. It stays in your ledger for GST records.
          </Text>
        </View>
      ) : null}

      <InvoiceReceiptPaper receipt={receipt} />

      {invoice.payments.length > 0 ? (
        <Section title="Payments">
          <Card>
            {invoice.payments.map((payment, index) => (
              <View key={payment.id}>
                {index > 0 ? <Divider style={styles.itemDivider} /> : null}
                <View style={styles.itemRow}>
                  <Icon name="checkmark-circle-outline" tone="success" />
                  <View style={styles.flex}>
                    <Text variant="bodyMedium">{paymentMethodLabel[payment.method]}</Text>
                    <Text variant="caption" tone="secondary">
                      {formatDateTime(payment.paidAt)}
                    </Text>
                  </View>
                  <Amount paise={payment.amountPaise} variant="bodyMedium" />
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <ConfirmSheet
        visible={confirmingCancel}
        title={`Cancel ${invoice.invoiceNumber}?`}
        message="The invoice will be marked as cancelled and kept in your ledger for GST records. This can't be undone, and the number won't be reused."
        confirmLabel="Cancel invoice"
        destructive
        loading={cancelling}
        onConfirm={() => void onCancel()}
        onCancel={() => setConfirmingCancel(false)}
      />
    </Screen>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonGroup style={skeletonStyles.wrap}>
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock height={280} rounded={radius.large} />
      <SkeletonBlock height={100} rounded={radius.large} />
    </SkeletonGroup>
  );
}

const skeletonStyles = StyleSheet.create({
  wrap: { gap: space[4] },
});

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space[3],
    },
    primaryAction: {
      flexGrow: 1,
      flexBasis: '40%',
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      padding: space[3],
      borderRadius: radius.medium,
      backgroundColor: colors.errorSoft,
    },
    bannerText: {
      flex: 1,
    },
    flex: {
      flex: 1,
      gap: 2,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
    },
    itemDivider: {
      marginBottom: space[3],
    },
  });
}

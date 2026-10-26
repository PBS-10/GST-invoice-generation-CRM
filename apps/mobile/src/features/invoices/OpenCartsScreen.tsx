import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { ConfirmSheet } from '../../components/common/ConfirmSheet';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useToast } from '../../components/common/Toast';
import {
  cartDisplayTitle,
  type OpenCartSummary,
} from '../../database/repositories/cartRepository';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { StackNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { discardCart, resumeCart } from '../../services/cart/cartSession';
import { totalsFromDraft } from '../../services/invoice/draftTotals';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { relativeDayLabel } from '../../utils/format';
import { haptics } from '../../utils/haptics';

export function OpenCartsScreen() {
  const { repos } = useDatabase();
  const navigation = useNavigation<StackNavigation>();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [carts, vendor] = await Promise.all([repos.carts.listOpen(), repos.vendors.get()]);
    const withTotals = await Promise.all(
      carts.map(async (cart) => {
        const full = await repos.carts.get(cart.id);
        let totalPaise = 0;
        if (full && vendor) {
          const totals = totalsFromDraft(
            {
              activeCartId: full.id,
              customerId: full.customerId,
              customerSnapshot: full.customerSnapshot,
              invoiceDiscountPaise: full.invoiceDiscountPaise,
              notes: full.notes ?? '',
              paymentMethod: full.paymentMethod,
              collectPayment: full.collectPayment,
              lines: full.lines,
            },
            vendor,
            null,
          );
          totalPaise = totals.totalPaise;
        }
        return { ...cart, totalPaise };
      }),
    );
    return withTotals;
  }, [repos]);

  const query = useFocusedQuery(load);
  const carts = query.data ?? [];

  async function onResume(cart: OpenCartSummary) {
    setBusy(true);
    try {
      await resumeCart(repos, cart.id);
      haptics.selection();
      navigation.navigate('InvoiceCreate');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onDiscard() {
    if (!discardId) {
      return;
    }
    setBusy(true);
    try {
      await discardCart(repos, discardId);
      setDiscardId(null);
      haptics.success();
      toast.success('Parked bill discarded');
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Parked bills"
        subtitle="Resume a cart or discard it. These stay on this phone only."
      />
      <Section title="Open carts" gap={0}>
        {query.status === 'loading' ? <SkeletonList rows={3} avatar={false} /> : null}
        {query.status === 'error' && !query.data ? (
          <ErrorState compact message={query.error} onRetry={query.reload} />
        ) : null}
        {query.status !== 'loading' && carts.length === 0 ? (
          <EmptyState
            icon="layers-outline"
            title="No parked bills"
            message="On a cart, tap Park to hold a customer’s bill while you serve someone else."
          />
        ) : null}
        {carts.map((cart, index) => (
          <ListItem
            key={cart.id}
            title={cartDisplayTitle(cart)}
            subtitle={`${cart.lineCount} ${cart.lineCount === 1 ? 'item' : 'items'} · ${relativeDayLabel(cart.updatedAt)}`}
            position={groupPosition(index, carts.length)}
            onPress={() => void onResume(cart)}
            trailing={
              <View style={styles.trailing}>
                <Amount paise={cart.totalPaise} variant="bodyMedium" />
                <Button
                  label="Discard"
                  variant="ghost"
                  size="small"
                  disabled={busy}
                  onPress={() => setDiscardId(cart.id)}
                />
              </View>
            }
          />
        ))}
      </Section>
      <ConfirmSheet
        visible={discardId != null}
        title="Discard this parked bill?"
        message="Items in this cart will be removed. This cannot be undone."
        confirmLabel="Discard"
        destructive
        loading={busy}
        onConfirm={() => void onDiscard()}
        onCancel={() => setDiscardId(null)}
      />
    </Screen>
  );
}

function createStyles(_theme: Theme) {
  return StyleSheet.create({
    trailing: {
      alignItems: 'flex-end',
      gap: space[1],
    },
  });
}

import { quantityMilliToText, type BillingMatchFailure } from '@invoice-gst/shared';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/AppText';
import { Avatar } from '../../../components/common/Avatar';
import { Button } from '../../../components/common/Button';
import { ListItem, groupPosition } from '../../../components/common/ListItem';
import { useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../../theme/theme';
import { formatRupees } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';
import { QuantityStepper } from './QuantityStepper';

export function voiceResolveChrome(
  pending: BillingMatchFailure,
  selectedUnit?: string | null,
  selectedName?: string | null,
): { title: string; description: string; noMatch: boolean } {
  const noMatch = pending.reason === 'not_found' || pending.candidates.length === 0;
  const title = noMatch
    ? 'No product matching'
    : pending.reason === 'ambiguous'
      ? `Which “${pending.productText}”?`
      : pending.reason === 'related'
        ? `Did you mean “${pending.productText}”?`
        : pending.reason === 'unit'
          ? 'Check the unit'
          : pending.reason === 'need_quantity'
            ? `How much ${pending.productText}?`
            : 'Could not match';

  const description = noMatch
    ? `Nothing in the catalogue sounds like “${pending.productText}”. Try again or add the product first.`
    : pending.reason === 'ambiguous'
      ? 'More than one product matches. Pick one and confirm the quantity.'
      : pending.reason === 'related'
        ? 'Voice may have misheard. Pick a related product, or cancel and say it again.'
        : pending.reason === 'unit'
          ? `You said ${formatSpokenQty(pending)}, but ${selectedName ?? 'this item'} is sold per ${selectedUnit ?? 'unit'}. Set the quantity in the shop unit.`
          : pending.reason === 'need_quantity'
            ? `Set how many ${selectedUnit ?? 'units'} to add.`
            : `No catalogue match for “${pending.productText}”.`;

  return { title, description, noMatch };
}

/** Selection state for the resolve step — parent keeps one BottomSheet Modal host. */
export function useVoiceResolveSelection(pending: BillingMatchFailure | null) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantityMilli, setQuantityMilli] = useState(1000);

  useEffect(() => {
    if (!pending) {
      setSelectedId(null);
      setQuantityMilli(1000);
      return;
    }
    const first = pending.candidates[0];
    setSelectedId(pending.candidates.length === 1 ? (first?.id ?? null) : null);
    setQuantityMilli(pending.suggestedQuantityMilli);
  }, [pending]);

  const selected = useMemo(() => {
    if (!pending) {
      return null;
    }
    return pending.candidates.find((candidate) => candidate.id === selectedId) ?? null;
  }, [pending, selectedId]);

  const chrome = pending
    ? voiceResolveChrome(pending, selected?.unit, selected?.name)
    : null;

  return {
    selectedId,
    setSelectedId,
    selected,
    quantityMilli,
    setQuantityMilli,
    chrome,
  };
}

/** Product list + empty state for the resolve step (no Modal of its own). */
export function VoiceResolveBody({
  pending,
  selectedId,
  onSelect,
}: {
  pending: BillingMatchFailure;
  selectedId: string | null;
  onSelect: (productId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const noMatch = pending.reason === 'not_found' || pending.candidates.length === 0;

  if (noMatch) {
    return (
      <Text variant="bodySmall" tone="secondary" align="center" style={styles.empty}>
        No related products found for “{pending.productText}”.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {pending.candidates.map((item, index) => {
        const selectedRow = item.id === selectedId;
        return (
          <ListItem
            key={item.id}
            title={item.name}
            subtitle={[item.localName, `${formatRupees(item.sellingPricePaise)} / ${item.unit}`]
              .filter(Boolean)
              .join(' · ')}
            leading={<Avatar name={item.name} shape="square" />}
            chevron={false}
            position={groupPosition(index, pending.candidates.length)}
            trailing={
              selectedRow ? (
                <Text variant="label" tone="brand">
                  Selected
                </Text>
              ) : undefined
            }
            onPress={() => {
              haptics.selection();
              onSelect(item.id);
            }}
          />
        );
      })}
    </View>
  );
}

export function VoiceResolveFooter({
  pending,
  selected,
  quantityMilli,
  queueRemaining = 0,
  onQuantityChange,
  onConfirm,
  onSkip,
}: {
  pending: BillingMatchFailure;
  selected: BillingMatchFailure['candidates'][number] | null;
  quantityMilli: number;
  queueRemaining?: number;
  onQuantityChange: (quantityMilli: number) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const noMatch = pending.reason === 'not_found' || pending.candidates.length === 0;

  return (
    <View style={styles.footer}>
      {!noMatch && selected ? (
        <View style={styles.qtyBlock}>
          <Text variant="label">Quantity ({selected.unit})</Text>
          <QuantityStepper
            quantityMilli={quantityMilli}
            unit={selected.unit}
            productName={selected.name}
            onChange={(next) => onQuantityChange(Math.max(1000, next))}
            onRemove={() => onQuantityChange(1000)}
          />
        </View>
      ) : null}
      {!noMatch ? (
        <Button
          label="Add to cart"
          icon="add"
          disabled={!selected || quantityMilli <= 0}
          onPress={onConfirm}
        />
      ) : null}
      <Button
        label={
          noMatch
            ? queueRemaining > 0
              ? 'OK, next'
              : 'OK'
            : queueRemaining > 0
              ? 'Skip this line'
              : 'Cancel'
        }
        variant={noMatch ? 'secondary' : 'ghost'}
        onPress={onSkip}
      />
      {queueRemaining > 0 ? (
        <Text variant="caption" tone="secondary" align="center">
          {queueRemaining} more line{queueRemaining === 1 ? '' : 's'} waiting
        </Text>
      ) : null}
    </View>
  );
}

function formatSpokenQty(pending: BillingMatchFailure): string {
  if (pending.spokenQuantityMilli == null) {
    return pending.productText;
  }
  const qty = quantityMilliToText(pending.spokenQuantityMilli);
  return pending.spokenUnit ? `${qty} ${pending.spokenUnit}` : qty;
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    list: {
      borderRadius: radius.large,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    footer: {
      gap: space[3],
    },
    qtyBlock: {
      gap: space[2],
    },
    empty: {
      paddingVertical: space[6],
      paddingHorizontal: space[4],
    },
  });
}

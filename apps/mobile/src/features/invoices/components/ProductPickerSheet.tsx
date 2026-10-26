import { quantityMilliToText } from '@invoice-gst/shared';
import type { Product } from '@invoice-gst/types';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/AppText';
import { Avatar } from '../../../components/common/Avatar';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { IconButton } from '../../../components/common/IconButton';
import { SearchField } from '../../../components/common/SearchField';
import { SkeletonList } from '../../../components/common/Skeleton';
import { EmptyState } from '../../../components/common/States';
import { useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../../theme/theme';
import { formatRupees } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';

const STEP_MILLI = 1000;

function matchesProduct(product: Product, needle: string): boolean {
  return (
    product.name.toLowerCase().includes(needle) ||
    Boolean(product.localName?.toLowerCase().includes(needle)) ||
    product.aliases.some((alias) => alias.toLowerCase().includes(needle)) ||
    Boolean(product.sku?.toLowerCase().includes(needle)) ||
    Boolean(product.hsnCode?.toLowerCase().includes(needle))
  );
}

/**
 * Full-height catalogue picker for New Invoice: always-searchable list with
 * per-row quantity steppers so clerks can set qty before closing the sheet.
 */
export function ProductPickerSheet({
  visible,
  products,
  quantityByProductId,
  loading = false,
  onClose,
  onSetQuantity,
  onCreateProduct,
}: {
  visible: boolean;
  products: readonly Product[];
  quantityByProductId: ReadonlyMap<string, number>;
  loading?: boolean;
  onClose: () => void;
  onSetQuantity: (product: Product, quantityMilli: number) => void;
  onCreateProduct: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return products;
    }
    return products.filter((product) => matchesProduct(product, needle));
  }, [products, query]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add products"
      description="Search the catalogue and set quantity for each item."
      fullHeight
      scroll={false}
      footer={
        <Button
          label="Done"
          icon="checkmark"
          size="large"
          onPress={onClose}
          accessibilityHint="Closes the product list and returns to the bill"
        />
      }
    >
      <View style={styles.body}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, alias, SKU or HSN"
          style={styles.search}
        />

        {loading ? <SkeletonList rows={6} /> : null}

        {!loading && products.length === 0 ? (
          <EmptyState
            compact
            icon="cube-outline"
            title="Catalogue is empty"
            message="Add products first, then bill them here."
            action={{
              label: 'Add product',
              icon: 'add',
              onPress: onCreateProduct,
            }}
          />
        ) : null}

        {!loading && products.length > 0 && filtered.length === 0 ? (
          <EmptyState
            compact
            icon="search-outline"
            title="No matching products"
            message="Try another name, alias or SKU."
            action={{ label: 'Clear search', onPress: () => setQuery('') }}
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            initialNumToRender={16}
            renderItem={({ item, index }) => (
              <ProductPickerRow
                product={item}
                quantityMilli={quantityByProductId.get(item.id) ?? 0}
                first={index === 0}
                last={index === filtered.length - 1}
                onSetQuantity={onSetQuantity}
              />
            )}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

function ProductPickerRow({
  product,
  quantityMilli,
  first,
  last,
  onSetQuantity,
}: {
  product: Product;
  quantityMilli: number;
  first: boolean;
  last: boolean;
  onSetQuantity: (product: Product, quantityMilli: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const inCart = quantityMilli > 0;

  return (
    <View style={[styles.row, first && styles.rowFirst, last && styles.rowLast]}>
      <Avatar name={product.name} shape="square" size={40} />
      <View style={styles.rowText}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {product.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1} tabular>
          {formatRupees(product.sellingPricePaise)} / {product.unit}
          {product.localName ? ` · ${product.localName}` : ''}
        </Text>
      </View>
      {inCart ? (
        <View style={styles.stepper}>
          <IconButton
            icon="remove"
            accessibilityLabel={`Decrease ${product.name}`}
            variant="outlined"
            size={36}
            onPress={() => {
              haptics.selection();
              onSetQuantity(product, Math.max(0, quantityMilli - STEP_MILLI));
            }}
          />
          <View style={styles.qtyPill}>
            <Text variant="bodyMedium" tabular>
              {quantityMilliToText(quantityMilli)}
            </Text>
            <Text variant="caption" tone="secondary">
              {product.unit}
            </Text>
          </View>
          <IconButton
            icon="add"
            accessibilityLabel={`Increase ${product.name}`}
            variant="filled"
            size={36}
            onPress={() => {
              haptics.selection();
              onSetQuantity(product, quantityMilli + STEP_MILLI);
            }}
          />
        </View>
      ) : (
        <IconButton
          icon="add"
          accessibilityLabel={`Add ${product.name}`}
          variant="tonal"
          size={40}
          onPress={() => {
            haptics.light();
            onSetQuantity(product, STEP_MILLI);
          }}
        />
      )}
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    body: {
      flex: 1,
      minHeight: 0,
    },
    search: {
      marginBottom: space[3],
      flexShrink: 0,
    },
    list: {
      flex: 1,
      minHeight: 120,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: space[2],
      borderRadius: radius.large,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingHorizontal: space[3],
      paddingVertical: space[3],
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    rowFirst: {
      borderTopLeftRadius: radius.large,
      borderTopRightRadius: radius.large,
    },
    rowLast: {
      borderBottomWidth: 0,
      borderBottomLeftRadius: radius.large,
      borderBottomRightRadius: radius.large,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[1],
    },
    qtyPill: {
      minWidth: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space[2],
      paddingVertical: space[1],
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
    },
  });
}

import type { Product } from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { KeyboardAware } from '../../components/common/KeyboardAware';
import { ScreenHeader, useScreenContentStyle } from '../../components/common/Screen';
import { SearchField } from '../../components/common/SearchField';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { TabScreenNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/theme';

function matches(product: Product, needle: string): boolean {
  return (
    product.name.toLowerCase().includes(needle) ||
    Boolean(product.localName?.toLowerCase().includes(needle)) ||
    product.aliases.some((alias) => alias.toLowerCase().includes(needle)) ||
    Boolean(product.sku?.toLowerCase().includes(needle)) ||
    Boolean(product.hsnCode?.includes(needle))
  );
}

export function ProductListScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const { repos } = useDatabase();
  const { colors } = useTheme();
  const contentStyle = useScreenContentStyle(['top']);
  const [search, setSearch] = useState('');

  const load = useCallback(() => repos.products.list(), [repos]);
  const query = useFocusedQuery(load);
  const products = query.data ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? products.filter((product) => matches(product, needle)) : products;
  }, [products, search]);

  const addProduct = () => navigation.navigate('ProductForm', {});

  let empty = null;
  if (query.status === 'loading') {
    empty = <SkeletonList rows={6} />;
  } else if (query.status === 'error' && !query.data) {
    empty = <ErrorState title="Couldn't load products" message={query.error} onRetry={query.reload} />;
  } else if (products.length === 0) {
    empty = (
      <EmptyState
        icon="cube-outline"
        title="Build your catalogue"
        message="Save each item once with its price, unit and GST rate. Billing then takes a single tap."
        action={{ label: 'Add your first product', icon: 'add', onPress: addProduct }}
      />
    );
  } else {
    empty = (
      <EmptyState
        compact
        icon="search-outline"
        title="No matching products"
        message="Search checks names, local names, aliases, SKU and HSN."
        action={{ label: 'Clear search', onPress: () => setSearch('') }}
      />
    );
  }

  return (
    <KeyboardAware style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              title="Products"
              subtitle={products.length > 0 ? `${products.length} in catalogue` : undefined}
              trailing={<Button label="Add" icon="add" size="small" onPress={addProduct} />}
            />
            {products.length > 0 ? (
              <SearchField value={search} onChangeText={setSearch} placeholder="Search products" />
            ) : null}
          </View>
        }
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <ListItem
            title={item.name}
            subtitle={[item.localName, item.hsnCode ? `HSN ${item.hsnCode}` : null]
              .filter(Boolean)
              .join(' · ') || `Sold per ${item.unit}`}
            leading={<Avatar name={item.name} shape="square" />}
            position={groupPosition(index, filtered.length)}
            dimmed={!item.isActive}
            accessibilityLabel={`${item.name}, edit product`}
            onPress={() => navigation.navigate('ProductForm', { productId: item.id })}
            trailing={
              <>
                <View style={styles.priceRow}>
                  <Amount paise={item.sellingPricePaise} variant="bodyMedium" />
                  <Text variant="caption" tone="tertiary">
                    /{item.unit}
                  </Text>
                </View>
                {item.isActive ? (
                  <Badge label={`${item.gstRateBps / 100}% GST`} tone="neutral" />
                ) : (
                  <Badge label="Inactive" tone="warning" />
                )}
              </>
            }
          />
        )}
      />
    </KeyboardAware>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    gap: space[4],
    marginBottom: space[4],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
});

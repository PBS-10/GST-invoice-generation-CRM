import type { Customer } from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { KeyboardAware } from '../../components/common/KeyboardAware';
import { ScreenHeader, useScreenContentStyle } from '../../components/common/Screen';
import { SearchField } from '../../components/common/SearchField';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { stateLabel } from '../../constants/states';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { TabScreenNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/theme';

function matches(customer: Customer, needle: string): boolean {
  return (
    customer.name.toLowerCase().includes(needle) ||
    Boolean(customer.phone?.includes(needle)) ||
    Boolean(customer.gstin?.toLowerCase().includes(needle)) ||
    Boolean(customer.city?.toLowerCase().includes(needle))
  );
}

export function CustomerListScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const { repos } = useDatabase();
  const { colors } = useTheme();
  const contentStyle = useScreenContentStyle(['top']);
  const [search, setSearch] = useState('');

  const load = useCallback(() => repos.customers.list(), [repos]);
  const query = useFocusedQuery(load);
  const customers = query.data ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? customers.filter((customer) => matches(customer, needle)) : customers;
  }, [customers, search]);

  const addCustomer = () => navigation.navigate('CustomerForm', {});

  let empty = null;
  if (query.status === 'loading') {
    empty = <SkeletonList rows={6} />;
  } else if (query.status === 'error' && !query.data) {
    empty = <ErrorState title="Couldn't load customers" message={query.error} onRetry={query.reload} />;
  } else if (customers.length === 0) {
    empty = (
      <EmptyState
        icon="people-outline"
        title="No saved customers"
        message="Walk-in bills work without one. Save regulars and business buyers to bill them faster and print their GSTIN."
        action={{ label: 'Add a customer', icon: 'person-add-outline', onPress: addCustomer }}
      />
    );
  } else {
    empty = (
      <EmptyState
        compact
        icon="search-outline"
        title="No matching customers"
        message="Search checks name, phone, GSTIN and city."
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
              title="Customers"
              subtitle={customers.length > 0 ? `${customers.length} saved` : undefined}
              trailing={<Button label="Add" icon="add" size="small" onPress={addCustomer} />}
            />
            {customers.length > 0 ? (
              <SearchField value={search} onChangeText={setSearch} placeholder="Search customers" />
            ) : null}
          </View>
        }
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <ListItem
            title={item.name}
            subtitle={[item.phone, item.stateCode ? stateLabel(item.stateCode) : item.city]
              .filter(Boolean)
              .join(' · ') || 'No contact details'}
            leading={<Avatar name={item.name} />}
            position={groupPosition(index, filtered.length)}
            accessibilityLabel={`${item.name}, edit customer`}
            onPress={() => navigation.navigate('CustomerForm', { customerId: item.id })}
            trailing={
              item.customerType === 'b2b' || item.gstin ? <Badge label="B2B" tone="info" /> : null
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
});

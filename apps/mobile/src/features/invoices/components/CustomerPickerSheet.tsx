import type { Customer } from '@invoice-gst/types';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar } from '../../../components/common/Avatar';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { Icon } from '../../../components/common/Icon';
import { ListItem, groupPosition } from '../../../components/common/ListItem';
import { SearchField } from '../../../components/common/SearchField';
import { Text } from '../../../components/common/AppText';
import { EmptyState } from '../../../components/common/States';
import { stateLabel } from '../../../constants/states';
import { space } from '../../../theme/theme';
import { haptics } from '../../../utils/haptics';

/** Above this, browsing the full list is noisy — search becomes the main path. */
const SEARCH_FIRST_THRESHOLD = 8;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function matchesCustomer(customer: Customer, needle: string, needleDigits: string): boolean {
  if (customer.name.toLowerCase().includes(needle)) {
    return true;
  }
  if (customer.gstin?.toLowerCase().includes(needle)) {
    return true;
  }
  if (customer.city?.toLowerCase().includes(needle)) {
    return true;
  }
  if (needleDigits.length >= 2 && customer.phone) {
    const phoneDigits = digitsOnly(customer.phone);
    if (phoneDigits.includes(needleDigits)) {
      return true;
    }
  } else if (customer.phone?.toLowerCase().includes(needle)) {
    return true;
  }
  return false;
}

/**
 * Bill-to picker. With many saved customers, search by name or phone is the
 * primary path — the full directory is not dumped into the sheet.
 */
export function CustomerPickerSheet({
  visible,
  customers,
  selectedId,
  onSelectWalkIn,
  onSelectCustomer,
  onCreateCustomer,
  onClose,
}: {
  visible: boolean;
  customers: readonly Customer[];
  selectedId: string | null;
  onSelectWalkIn: () => void;
  onSelectCustomer: (customer: Customer) => void;
  onCreateCustomer: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const searchFirst = customers.length > SEARCH_FIRST_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const needleDigits = digitsOnly(query);
  const searching = needle.length > 0;

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (!searching) {
      return customers;
    }
    return customers.filter((customer) => matchesCustomer(customer, needle, needleDigits));
  }, [customers, needle, needleDigits, searching]);

  /** When the directory is large and nothing is typed, only show walk-in (+ selected). */
  const listCustomers = useMemo(() => {
    if (searchFirst && !searching) {
      if (!selectedId) {
        return [] as Customer[];
      }
      const selected = customers.find((customer) => customer.id === selectedId);
      return selected ? [selected] : [];
    }
    return filtered;
  }, [customers, filtered, searchFirst, searching, selectedId]);

  function close() {
    setQuery('');
    onClose();
  }

  const showWalkIn = !searching;
  const rows = (showWalkIn ? 1 : 0) + listCustomers.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="Bill to"
      description={
        searchFirst
          ? 'Search by name or phone number. Walk-in needs no details.'
          : 'Walk-in bills need no details. Pick a saved customer to print their name and GSTIN.'
      }
      fullHeight
      scroll={false}
      footer={
        <Button
          label="New customer"
          icon="person-add-outline"
          variant="secondary"
          onPress={() => {
            // Parent closes the sheet and waits for Modal teardown before navigating.
            onCreateCustomer();
          }}
        />
      }
    >
      <View style={styles.body}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or phone"
          autoFocus={searchFirst}
          style={styles.search}
        />

        <FlatList
          data={listCustomers}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            showWalkIn ? (
              <ListItem
                title="Walk-in customer"
                subtitle="No customer details on the invoice"
                leading={<Avatar icon="walk-outline" tone="neutral" />}
                trailing={selectedId == null ? <Icon name="checkmark" tone="primaryText" /> : null}
                chevron={false}
                position={groupPosition(0, Math.max(rows, 1))}
                onPress={() => {
                  haptics.selection();
                  onSelectWalkIn();
                  close();
                }}
              />
            ) : undefined
          }
          ListEmptyComponent={
            searching ? (
              <EmptyState
                compact
                icon="search-outline"
                title="No match"
                message={`No customer matches “${query.trim()}”. Check the name or phone, or add them.`}
                action={{
                  label: 'Add customer',
                  icon: 'person-add-outline',
                  onPress: () => {
                    close();
                    onCreateCustomer();
                  },
                }}
              />
            ) : searchFirst ? (
              <View style={styles.hint}>
                <Text variant="bodySmall" tone="secondary" align="center">
                  Type a name or phone number to find a saved customer.
                </Text>
                <Text variant="caption" tone="tertiary" align="center">
                  {customers.length} customers saved
                </Text>
              </View>
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <ListItem
              title={item.name}
              subtitle={[item.phone, item.gstin ?? stateLabel(item.stateCode)]
                .filter(Boolean)
                .join(' · ')}
              leading={<Avatar name={item.name} />}
              trailing={
                selectedId === item.id ? <Icon name="checkmark" tone="primaryText" /> : null
              }
              chevron={false}
              position={groupPosition(showWalkIn ? index + 1 : index, rows)}
              onPress={() => {
                haptics.selection();
                onSelectCustomer(item);
                close();
              }}
            />
          )}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
  },
  hint: {
    paddingVertical: space[8],
    paddingHorizontal: space[4],
    gap: space[2],
  },
});

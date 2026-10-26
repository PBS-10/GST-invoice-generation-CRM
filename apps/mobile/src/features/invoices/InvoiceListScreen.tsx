import type { Invoice } from '@invoice-gst/types';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Amount } from '../../components/common/Amount';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { ListItem, groupPosition } from '../../components/common/ListItem';
import { KeyboardAware } from '../../components/common/KeyboardAware';
import { ScreenHeader, useScreenContentStyle } from '../../components/common/Screen';
import { SearchField } from '../../components/common/SearchField';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { SkeletonList } from '../../components/common/Skeleton';
import { EmptyState, ErrorState } from '../../components/common/States';
import { useFocusedQuery } from '../../hooks/useFocusedQuery';
import type { TabScreenNavigation } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/theme';
import { dayKey, formatTime, relativeDayLabel } from '../../utils/format';
import { InvoiceStatusBadge } from './components/InvoiceStatusBadge';

type Filter = 'all' | 'unpaid' | 'paid' | 'cancelled';

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

function matchesFilter(invoice: Invoice, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'cancelled':
      return invoice.status === 'cancelled';
    case 'paid':
      return invoice.status !== 'cancelled' && invoice.paymentStatus === 'paid';
    case 'unpaid':
      return invoice.status !== 'cancelled' && invoice.paymentStatus !== 'paid';
  }
}

type DaySection = { key: string; title: string; data: Invoice[] };

function groupByDay(invoices: readonly Invoice[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const invoice of invoices) {
    const key = dayKey(invoice.createdAt);
    const last = sections[sections.length - 1];
    if (last && last.key === key) {
      last.data.push(invoice);
    } else {
      sections.push({ key, title: relativeDayLabel(invoice.createdAt), data: [invoice] });
    }
  }
  return sections;
}

export function InvoiceListScreen() {
  const navigation = useNavigation<TabScreenNavigation>();
  const { repos } = useDatabase();
  const { colors } = useTheme();
  const contentStyle = useScreenContentStyle(['top']);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(() => repos.invoices.list(), [repos]);
  const query = useFocusedQuery(load);
  const invoices = query.data ?? [];

  const sections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = invoices.filter(
      (invoice) =>
        matchesFilter(invoice, filter) &&
        (!needle ||
          invoice.invoiceNumber.toLowerCase().includes(needle) ||
          invoice.customerSnapshot.name.toLowerCase().includes(needle)),
    );
    return groupByDay(filtered);
  }, [invoices, search, filter]);

  function startInvoice() {
    navigation.navigate('InvoiceCreate');
  }

  const hasInvoices = invoices.length > 0;
  const filtersActive = search.trim().length > 0 || filter !== 'all';

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title="Invoices"
        subtitle={hasInvoices ? `${invoices.length} in your ledger` : undefined}
        trailing={<Button label="New" icon="add" size="small" onPress={startInvoice} />}
      />
      {hasInvoices ? (
        <View style={styles.controls}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search number or customer" />
          <SegmentedControl
            accessibilityLabel="Filter invoices"
            segments={FILTERS}
            value={filter}
            onChange={setFilter}
          />
        </View>
      ) : null}
    </View>
  );

  let empty = null;
  if (query.status === 'loading') {
    empty = <SkeletonList rows={6} avatar={false} />;
  } else if (query.status === 'error' && !query.data) {
    empty = <ErrorState title="Couldn't load invoices" message={query.error} onRetry={query.reload} />;
  } else if (!hasInvoices) {
    empty = (
      <EmptyState
        icon="receipt-outline"
        title="No invoices yet"
        message="Bills you create are numbered, GST-calculated and saved on this phone — no internet needed."
        action={{ label: 'Create your first invoice', icon: 'add', onPress: startInvoice }}
      />
    );
  } else if (filtersActive) {
    empty = (
      <EmptyState
        compact
        icon="search-outline"
        title="No matching invoices"
        message="Try a different number, name or filter."
        action={{
          label: 'Clear filters',
          onPress: () => {
            setSearch('');
            setFilter('all');
          },
        }}
      />
    );
  }

  return (
    <KeyboardAware style={[styles.root, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentStyle}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ?? undefined}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={14}
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="secondary" style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        SectionSeparatorComponent={SectionGap}
        renderItem={({ item, index, section }) => (
          <ListItem
            title={item.customerSnapshot.name}
            subtitle={`${item.invoiceNumber} · ${formatTime(item.createdAt)}`}
            position={groupPosition(index, section.data.length)}
            dimmed={item.status === 'cancelled'}
            accessibilityLabel={`${item.customerSnapshot.name}, invoice ${item.invoiceNumber}`}
            onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
            trailing={
              <>
                <Amount
                  paise={item.totalPaise}
                  variant="bodyMedium"
                  strike={item.status === 'cancelled'}
                />
                <InvoiceStatusBadge status={item.status} paymentStatus={item.paymentStatus} />
              </>
            }
          />
        )}
      />
    </KeyboardAware>
  );
}

function SectionGap() {
  return <View style={styles.sectionGap} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    gap: space[4],
    marginBottom: space[3],
  },
  controls: {
    gap: space[3],
  },
  sectionTitle: {
    paddingTop: space[3],
    paddingBottom: space[2],
    paddingHorizontal: space[1],
  },
  sectionGap: {
    height: space[1],
  },
});

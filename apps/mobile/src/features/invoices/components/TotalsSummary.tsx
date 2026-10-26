import { StyleSheet, View } from 'react-native';
import { Amount } from '../../../components/common/Amount';
import { Text } from '../../../components/common/AppText';
import { DashedRule } from '../../../components/common/Divider';
import { space } from '../../../theme/theme';

export type TotalsValues = {
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
};

/**
 * The receipt block. Shows only the tax lines that apply (CGST + SGST within
 * the state, IGST across states) instead of a column of zeroes. The engine's
 * subtotal is gross of inclusive tax, so it is deliberately not shown here.
 */
export function TotalsSummary({
  totals,
  isInterState,
  cancelled = false,
}: {
  totals: TotalsValues;
  isInterState: boolean;
  cancelled?: boolean;
}) {
  const showIgst = isInterState || totals.igstPaise !== 0;
  const showLocalTax = !isInterState || totals.cgstPaise !== 0 || totals.sgstPaise !== 0;

  return (
    <View style={styles.wrap}>
      {totals.discountPaise > 0 ? <Row label="Discount" paise={-totals.discountPaise} /> : null}
      <Row label="Taxable value" paise={totals.taxablePaise} />
      {showLocalTax ? (
        <>
          <Row label="CGST" paise={totals.cgstPaise} />
          <Row label="SGST" paise={totals.sgstPaise} />
        </>
      ) : null}
      {showIgst ? <Row label="IGST" paise={totals.igstPaise} /> : null}
      {totals.roundOffPaise !== 0 ? <Row label="Round off" paise={totals.roundOffPaise} /> : null}
      <DashedRule style={styles.rule} />
      <View style={styles.totalRow}>
        <Text variant="h3">Total</Text>
        <Amount paise={totals.totalPaise} variant="h2" strike={cancelled} />
      </View>
    </View>
  );
}

function Row({ label, paise }: { label: string; paise: number }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySmall" tone="secondary">
        {label}
      </Text>
      <Amount paise={paise} variant="bodySmall" tone="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space[2],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rule: {
    marginVertical: space[2],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
});

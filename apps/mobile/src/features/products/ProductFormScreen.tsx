import { calculateInvoiceTotals, paiseToRupeeLabel, rupeesTextToPaise } from '@invoice-gst/shared';
import { parseAliases, productFormSchema, type ProductFormValues } from '@invoice-gst/validation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { ChipGroup } from '../../components/common/Chip';
import { Icon } from '../../components/common/Icon';
import { Screen } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { SwitchRow } from '../../components/common/SwitchRow';
import { TextField, type TextFieldHandle } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { formatRupees } from '../../utils/format';
import { issuesToFieldErrors, useFieldErrors } from '../../utils/formErrors';
import { haptics } from '../../utils/haptics';
import { waitForModalTeardown } from '../../utils/modalTeardown';

const GST_RATES = ['0', '5', '12', '18', '28'] as const;
const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'packet', 'other'] as const;

const RATE_SEGMENTS = GST_RATES.map((value) => ({ value, label: `${value}%` }));
const UNIT_OPTIONS = UNITS.map((value) => ({ value, label: value }));
const PRICING_SEGMENTS = [
  { value: 'exclusive', label: 'GST extra' },
  { value: 'inclusive', label: 'GST included' },
] as const;

type Field = keyof ProductFormValues;

export function ProductFormScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'ProductForm'>) {
  const { repos } = useDatabase();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const productId = route.params.productId;
  const [name, setName] = useState('');
  const [localName, setLocalName] = useState('');
  const [aliasesText, setAliasesText] = useState('');
  const [sku, setSku] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('kg');
  const [price, setPrice] = useState('');
  const [gstRatePercent, setGstRatePercent] = useState<(typeof GST_RATES)[number]>('5');
  const [priceInclusive, setPriceInclusive] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compositionScheme, setCompositionScheme] = useState(false);
  const { errors, setErrors, clear } = useFieldErrors<Field>();

  const localNameRef = useRef<TextFieldHandle>(null);
  const aliasesRef = useRef<TextFieldHandle>(null);
  const priceRef = useRef<TextFieldHandle>(null);
  const hsnRef = useRef<TextFieldHandle>(null);
  const skuRef = useRef<TextFieldHandle>(null);

  useEffect(() => {
    void repos.vendors.get().then((vendor) => {
      setCompositionScheme(vendor?.gstRegistrationType === 'composition');
    });
  }, [repos]);

  useEffect(() => {
    if (!productId) {
      return;
    }
    void repos.products.get(productId).then((product) => {
      if (!product) {
        return;
      }
      setName(product.name);
      setLocalName(product.localName ?? '');
      setAliasesText(product.aliases.join(', '));
      setSku(product.sku ?? '');
      setHsnCode(product.hsnCode ?? '');
      setUnit(product.unit);
      setPrice(paiseToRupeeLabel(product.sellingPricePaise).replace('₹', ''));
      setGstRatePercent(String(product.gstRateBps / 100) as (typeof GST_RATES)[number]);
      setPriceInclusive(product.priceInclusive);
      setIsActive(product.isActive);
    });
  }, [productId, repos]);

  /** Live breakdown from the same GST engine used for invoices. */
  const breakdown = useMemo(() => {
    if (!/^\d+(\.\d{1,2})?$/.test(price.trim())) {
      return null;
    }
    const line = calculateInvoiceTotals({
      lines: [
        {
          quantityMilli: 1000,
          unitPricePaise: rupeesTextToPaise(price),
          gstRateBps: Number(gstRatePercent) * 100,
          priceInclusive,
          lineDiscountPaise: 0,
        },
      ],
      invoiceDiscountPaise: 0,
      isInterState: false,
      roundingMode: 'nearest',
      compositionScheme: false,
    }).lines[0];
    if (!line) {
      return null;
    }
    return {
      taxable: line.taxablePaise,
      tax: line.cgstPaise + line.sgstPaise + line.igstPaise,
      total: line.lineTotalPaise,
    };
  }, [price, gstRatePercent, priceInclusive]);

  async function onSave() {
    const parsed = productFormSchema.safeParse({
      name,
      localName,
      aliasesText,
      sku,
      hsnCode,
      unit,
      sellingPriceRupees: price,
      gstRatePercent,
      priceInclusive,
      isActive,
    });
    if (!parsed.success) {
      setErrors(issuesToFieldErrors<Field>(parsed.error.issues));
      haptics.error();
      toast.error('Check the highlighted fields');
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const values = {
        name: parsed.data.name,
        localName: parsed.data.localName || null,
        aliases: parseAliases(parsed.data.aliasesText),
        sku: parsed.data.sku || null,
        hsnCode: parsed.data.hsnCode || null,
        unit: parsed.data.unit,
        sellingPricePaise: rupeesTextToPaise(parsed.data.sellingPriceRupees),
        gstRateBps: Number(parsed.data.gstRatePercent) * 100,
        priceInclusive: parsed.data.priceInclusive,
        isActive: parsed.data.isActive,
      };
      if (productId) {
        await repos.products.update(productId, values);
      } else {
        await repos.products.create(values);
      }
      const message = productId ? 'Product updated' : `${values.name} added to catalogue`;
      // Dismiss keyboard and wait before goBack — same-frame dismiss + unmount
      // crashes Android Fabric (addViewAt / child already has a parent).
      Keyboard.dismiss();
      await waitForModalTeardown();
      haptics.success();
      navigation.goBack();
      toast.success(message);
    } catch (error) {
      toast.error(`Couldn't save. ${errorMessage(error)}`);
      setSaving(false);
    }
  }

  return (
    <Screen
      keyboard
      footer={
        <Button
          label={productId ? 'Save changes' : 'Save product'}
          onPress={() => void onSave()}
          loading={saving}
          size="large"
        />
      }
    >
      <Section title="Details">
        <TextField
          label="Name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clear('name');
          }}
          error={errors.name}
          placeholder="e.g. Rice"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => localNameRef.current?.focus()}
        />
        <TextField
          ref={localNameRef}
          label="Local name"
          optional
          value={localName}
          onChangeText={setLocalName}
          error={errors.localName}
          placeholder="e.g. അരി / Ari"
          hint="Printed under the name on invoices."
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => aliasesRef.current?.focus()}
        />
        <TextField
          ref={aliasesRef}
          label="Search aliases"
          optional
          value={aliasesText}
          onChangeText={setAliasesText}
          error={errors.aliasesText}
          placeholder="rice, ari, matta"
          hint="Comma separated. Helps you find it quickly while billing."
          autoCapitalize="none"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => priceRef.current?.focus()}
        />
      </Section>

      <Section title="Price & GST">
        <TextField
          ref={priceRef}
          label={`Selling price per ${unit}`}
          prefix="₹"
          value={price}
          onChangeText={(value) => {
            setPrice(value);
            clear('sellingPriceRupees');
          }}
          error={errors.sellingPriceRupees}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <SegmentedControl
          accessibilityLabel="Is GST included in the price?"
          segments={PRICING_SEGMENTS}
          value={priceInclusive ? 'inclusive' : 'exclusive'}
          onChange={(value) => setPriceInclusive(value === 'inclusive')}
        />
        <View style={styles.fieldGroup}>
          <Text variant="label">GST rate</Text>
          <SegmentedControl
            accessibilityLabel="GST rate"
            segments={RATE_SEGMENTS}
            value={gstRatePercent}
            onChange={setGstRatePercent}
          />
        </View>
        {breakdown && !compositionScheme ? (
          <View style={styles.breakdown} accessibilityLiveRegion="polite">
            <Icon name="calculator-outline" size="small" tone="primaryText" />
            <Text variant="bodySmall" tone="secondary" style={styles.breakdownText} tabular>
              {formatRupees(breakdown.taxable)} + {formatRupees(breakdown.tax)} GST ={' '}
              <Text variant="bodySmall" style={styles.breakdownTotal} tabular>
                {formatRupees(breakdown.total)}
              </Text>{' '}
              per {unit}
            </Text>
          </View>
        ) : null}
        <View style={styles.fieldGroup}>
          <Text variant="label">Sold by</Text>
          <ChipGroup
            accessibilityLabel="Unit"
            options={UNIT_OPTIONS}
            value={unit}
            onChange={setUnit}
          />
        </View>
      </Section>

      <Section title="Availability">
        <SwitchRow
          label="Sold in shop"
          description={
            isActive
              ? 'Shows in the catalogue when adding to a bill.'
              : 'Hidden from Add products. Old bills keep the snapshot.'
          }
          value={isActive}
          onValueChange={setIsActive}
        />
      </Section>

      <Section title="Codes" description="Optional, but HSN is needed on most B2B invoices.">
        <TextField
          ref={hsnRef}
          label="HSN code"
          optional
          value={hsnCode}
          onChangeText={setHsnCode}
          error={errors.hsnCode}
          placeholder="e.g. 1006"
          keyboardType="number-pad"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => skuRef.current?.focus()}
        />
        <TextField
          ref={skuRef}
          label="SKU"
          optional
          value={sku}
          onChangeText={setSku}
          error={errors.sku}
          autoCapitalize="characters"
          returnKeyType="done"
        />
      </Section>
    </Screen>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    fieldGroup: {
      gap: space[2],
    },
    breakdown: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      paddingHorizontal: space[3],
      paddingVertical: space[3],
      borderRadius: radius.medium,
      backgroundColor: colors.primarySoft,
    },
    breakdownText: {
      flex: 1,
    },
    breakdownTotal: {
      fontWeight: '600',
    },
  });
}

import { formatInvoiceNumber, getFinancialYear } from '@invoice-gst/shared';
import type { GstRegistrationType } from '@invoice-gst/types';
import { vendorFormSchema, type VendorFormValues } from '@invoice-gst/validation';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Icon } from '../../components/common/Icon';
import { Screen, ScreenHeader } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { SelectField } from '../../components/common/SelectField';
import { TextField, type TextFieldHandle } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import { GST_STATE_OPTIONS } from '../../constants/states';
import { useDatabase } from '../../providers/DatabaseProvider';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { radius, space, type Theme } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { issuesToFieldErrors, useFieldErrors } from '../../utils/formErrors';
import { haptics } from '../../utils/haptics';

type ProfileValues = {
  businessName: string;
  tradeName: string;
  gstin: string;
  phone: string;
  email: string;
  addressLine1: string;
  city: string;
  stateCode: string;
  pincode: string;
  invoicePrefix: string;
  gstRegistrationType: GstRegistrationType;
};

const EMPTY_PROFILE: ProfileValues = {
  businessName: '',
  tradeName: '',
  gstin: '',
  phone: '',
  email: '',
  addressLine1: '',
  city: '',
  stateCode: '32',
  pincode: '',
  invoicePrefix: 'INV',
  gstRegistrationType: 'regular',
};

const REGISTRATION_SEGMENTS: readonly { value: GstRegistrationType; label: string }[] = [
  { value: 'regular', label: 'Regular' },
  { value: 'composition', label: 'Composition' },
  { value: 'unregistered', label: 'Unregistered' },
];

const REGISTRATION_HINT: Record<GstRegistrationType, string> = {
  regular: 'You charge GST on each invoice and claim input credit.',
  composition: 'You pay tax at a flat rate; no GST is charged on invoices.',
  unregistered: 'You are not registered for GST.',
};

type Field = keyof VendorFormValues;

/** Shop profile editor — opened from Settings → Shop profile. */
export function VendorSettingsScreen() {
  const { repos } = useDatabase();
  const toast = useToast();
  const styles = useThemedStyles(createStyles);
  const [values, setValues] = useState<ProfileValues>(EMPTY_PROFILE);
  const [saved, setSaved] = useState<ProfileValues>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clear } = useFieldErrors<Field>();

  const tradeNameRef = useRef<TextFieldHandle>(null);
  const phoneRef = useRef<TextFieldHandle>(null);
  const emailRef = useRef<TextFieldHandle>(null);
  const cityRef = useRef<TextFieldHandle>(null);
  const pincodeRef = useRef<TextFieldHandle>(null);

  useEffect(() => {
    void repos.vendors.get().then((vendor) => {
      if (!vendor) {
        return;
      }
      const loaded: ProfileValues = {
        businessName: vendor.businessName,
        tradeName: vendor.tradeName ?? '',
        gstin: vendor.gstin ?? '',
        phone: vendor.phone ?? '',
        email: vendor.email ?? '',
        addressLine1: vendor.addressLine1 ?? '',
        city: vendor.city ?? '',
        stateCode: vendor.stateCode,
        pincode: vendor.pincode ?? '',
        invoicePrefix: vendor.invoicePrefix,
        gstRegistrationType: vendor.gstRegistrationType,
      };
      setValues(loaded);
      setSaved(loaded);
    });
  }, [repos]);

  const dirty = (Object.keys(values) as (keyof ProfileValues)[]).some(
    (key) => values[key] !== saved[key],
  );

  function update<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    clear(key);
  }

  async function onSave() {
    const parsed = vendorFormSchema.safeParse({
      ...values,
      addressLine2: '',
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
      await repos.vendors.upsert({
        businessName: parsed.data.businessName,
        tradeName: parsed.data.tradeName || null,
        gstin: parsed.data.gstin || null,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        addressLine1: parsed.data.addressLine1 || null,
        addressLine2: null,
        city: parsed.data.city || null,
        stateCode: parsed.data.stateCode,
        pincode: parsed.data.pincode || null,
        gstRegistrationType: parsed.data.gstRegistrationType,
        invoicePrefix: parsed.data.invoicePrefix.toUpperCase(),
      });
      const normalised = { ...values, invoicePrefix: values.invoicePrefix.toUpperCase() };
      setValues(normalised);
      setSaved(normalised);
      haptics.success();
      toast.success('Shop profile saved on this device');
    } catch (error) {
      toast.error(`Couldn't save. ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  const prefixPreview = /^[A-Za-z0-9]{1,3}$/.test(values.invoicePrefix.trim())
    ? formatInvoiceNumber(values.invoicePrefix.trim().toUpperCase(), 'A', getFinancialYear(), 1)
    : null;

  return (
    <Screen
      keyboard
      footer={
        dirty ? (
          <Button label="Save changes" onPress={() => void onSave()} loading={saving} size="large" />
        ) : undefined
      }
    >
      <ScreenHeader
        title="Shop profile"
        subtitle="Details that appear on every invoice."
      />

      <Section title="Business">
        <TextField
          label="Business name"
          value={values.businessName}
          onChangeText={(value) => update('businessName', value)}
          error={errors.businessName}
          hint="Your legal name, as registered for GST."
          autoCapitalize="words"
          autoComplete="organization"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => tradeNameRef.current?.focus()}
        />
        <TextField
          ref={tradeNameRef}
          label="Trade name"
          optional
          value={values.tradeName}
          onChangeText={(value) => update('tradeName', value)}
          error={errors.tradeName}
          hint="The shop name customers know, if different."
          autoCapitalize="words"
        />
      </Section>

      <Section title="GST">
        <View style={styles.fieldGroup}>
          <Text variant="label">Registration</Text>
          <SegmentedControl
            accessibilityLabel="GST registration type"
            segments={REGISTRATION_SEGMENTS}
            value={values.gstRegistrationType}
            onChange={(value) => update('gstRegistrationType', value)}
          />
          <Text variant="caption" tone="secondary">
            {REGISTRATION_HINT[values.gstRegistrationType]}
          </Text>
        </View>
        <TextField
          label="GSTIN"
          optional
          value={values.gstin}
          onChangeText={(value) => update('gstin', value.toUpperCase())}
          error={errors.gstin}
          placeholder="15 characters, e.g. 32ABCDE1234F1Z5"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
        />
        <SelectField
          label="State"
          sheetTitle="Shop state"
          value={values.stateCode}
          options={GST_STATE_OPTIONS}
          onChange={(value) => update('stateCode', value)}
          error={errors.stateCode}
          hint="Sales to other states are billed with IGST."
        />
      </Section>

      <Section title="Invoice numbering">
        <TextField
          label="Prefix"
          value={values.invoicePrefix}
          onChangeText={(value) => update('invoicePrefix', value)}
          error={errors.invoicePrefix}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={3}
          hint="1–3 characters. Each phone adds a series letter (A, B, …)."
        />
        {prefixPreview ? (
          <View style={styles.preview}>
            <Icon name="document-text-outline" size="small" tone="textSecondary" />
            <Text variant="bodySmall" tone="secondary" style={styles.previewText}>
              Numbers look like{' '}
              <Text variant="bodySmall" tabular style={styles.previewNumber}>
                {prefixPreview}
              </Text>
              , restarting each financial year.
            </Text>
          </View>
        ) : null}
      </Section>

      <Section title="Contact">
        <TextField
          ref={phoneRef}
          label="Phone"
          optional
          value={values.phone}
          onChangeText={(value) => update('phone', value)}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          optional
          value={values.email}
          onChangeText={(value) => update('email', value)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </Section>

      <Section title="Address">
        <TextField
          label="Street address"
          optional
          value={values.addressLine1}
          onChangeText={(value) => update('addressLine1', value)}
          error={errors.addressLine1}
          autoComplete="street-address"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => cityRef.current?.focus()}
        />
        <View style={styles.row}>
          <TextField
            ref={cityRef}
            label="City"
            optional
            value={values.city}
            onChangeText={(value) => update('city', value)}
            error={errors.city}
            containerStyle={styles.rowField}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => pincodeRef.current?.focus()}
          />
          <TextField
            ref={pincodeRef}
            label="PIN"
            optional
            value={values.pincode}
            onChangeText={(value) => update('pincode', value)}
            error={errors.pincode}
            keyboardType="number-pad"
            autoComplete="postal-code"
            maxLength={6}
            containerStyle={styles.rowField}
          />
        </View>
      </Section>
    </Screen>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    fieldGroup: {
      gap: space[2],
    },
    row: {
      flexDirection: 'row',
      gap: space[3],
    },
    rowField: {
      flex: 1,
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      padding: space[3],
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceSecondary,
    },
    previewText: {
      flex: 1,
    },
    previewNumber: {
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
}

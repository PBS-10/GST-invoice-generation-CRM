import type { CustomerType } from '@invoice-gst/types';
import { customerFormSchema, type CustomerFormValues } from '@invoice-gst/validation';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { Text } from '../../components/common/AppText';
import { Button } from '../../components/common/Button';
import { Screen } from '../../components/common/Screen';
import { Section } from '../../components/common/Section';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { SelectField } from '../../components/common/SelectField';
import { TextField, type TextFieldHandle } from '../../components/common/TextField';
import { useToast } from '../../components/common/Toast';
import { GST_STATE_OPTIONS } from '../../constants/states';
import type { RootStackParamList } from '../../navigation/types';
import { useDatabase } from '../../providers/DatabaseProvider';
import { space } from '../../theme/theme';
import { errorMessage } from '../../utils/errors';
import { issuesToFieldErrors, useFieldErrors } from '../../utils/formErrors';
import { haptics } from '../../utils/haptics';
import { waitForModalTeardown } from '../../utils/modalTeardown';

const TYPE_SEGMENTS: readonly { value: CustomerType; label: string }[] = [
  { value: 'b2c', label: 'Consumer' },
  { value: 'b2b', label: 'Business' },
  { value: 'unregistered', label: 'Unregistered' },
];

const TYPE_HINT: Record<CustomerType, string> = {
  b2c: 'An individual buyer (B2C).',
  b2b: 'A GST-registered business (B2B). Add their GSTIN below.',
  unregistered: 'A business without GST registration.',
};

const STATE_OPTIONS = [
  { value: '', label: 'Same as shop', description: 'Intra-state: CGST + SGST' },
  ...GST_STATE_OPTIONS,
];

type Field = keyof CustomerFormValues;

export function CustomerFormScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'CustomerForm'>) {
  const { repos } = useDatabase();
  const toast = useToast();
  const customerId = route.params.customerId;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('b2c');
  const [saving, setSaving] = useState(false);
  const { errors, setErrors, clear } = useFieldErrors<Field>();

  const phoneRef = useRef<TextFieldHandle>(null);
  const emailRef = useRef<TextFieldHandle>(null);
  const cityRef = useRef<TextFieldHandle>(null);
  const pincodeRef = useRef<TextFieldHandle>(null);

  useEffect(() => {
    if (!customerId) {
      return;
    }
    void repos.customers.get(customerId).then((customer) => {
      if (!customer) {
        return;
      }
      setName(customer.name);
      setPhone(customer.phone ?? '');
      setEmail(customer.email ?? '');
      setAddressLine1(customer.addressLine1 ?? '');
      setCity(customer.city ?? '');
      setStateCode(customer.stateCode ?? '');
      setPincode(customer.pincode ?? '');
      setGstin(customer.gstin ?? '');
      setCustomerType(customer.customerType);
    });
  }, [customerId, repos]);

  async function onSave() {
    const parsed = customerFormSchema.safeParse({
      name,
      phone,
      email,
      addressLine1,
      city,
      stateCode,
      pincode,
      gstin,
      customerType,
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
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        addressLine1: parsed.data.addressLine1 || null,
        city: parsed.data.city || null,
        stateCode: parsed.data.stateCode || null,
        pincode: parsed.data.pincode || null,
        gstin: parsed.data.gstin || null,
        customerType: parsed.data.customerType,
      };
      if (customerId) {
        await repos.customers.update(customerId, values);
      } else {
        await repos.customers.create(values);
      }
      const message = customerId ? 'Customer updated' : `${values.name} saved`;
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
          label={customerId ? 'Save changes' : 'Save customer'}
          onPress={() => void onSave()}
          loading={saving}
          size="large"
        />
      }
    >
      <Section title="Customer">
        <TextField
          label="Name"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clear('name');
          }}
          error={errors.name}
          placeholder="Person or business name"
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <View style={styles.fieldGroup}>
          <Text variant="label">Type</Text>
          <SegmentedControl
            accessibilityLabel="Customer type"
            segments={TYPE_SEGMENTS}
            value={customerType}
            onChange={setCustomerType}
          />
          <Text variant="caption" tone="secondary">
            {TYPE_HINT[customerType]}
          </Text>
        </View>
      </Section>

      <Section title="Contact">
        <TextField
          ref={phoneRef}
          label="Phone"
          optional
          value={phone}
          onChangeText={setPhone}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label="Email"
          optional
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clear('email');
          }}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
      </Section>

      <Section title="Tax" description="Decides whether CGST + SGST or IGST applies.">
        <TextField
          label="GSTIN"
          optional
          value={gstin}
          onChangeText={(value) => {
            setGstin(value.toUpperCase());
            clear('gstin');
          }}
          error={errors.gstin}
          placeholder="15 characters, e.g. 32ABCDE1234F1Z5"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={15}
        />
        <SelectField
          label="State"
          sheetTitle="Customer's state"
          value={stateCode}
          options={STATE_OPTIONS}
          onChange={(value) => {
            setStateCode(value);
            clear('stateCode');
          }}
          error={errors.stateCode}
          hint={stateCode ? undefined : 'Leave as shop state for local buyers.'}
        />
      </Section>

      <Section title="Address">
        <TextField
          label="Street address"
          optional
          value={addressLine1}
          onChangeText={setAddressLine1}
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
            value={city}
            onChangeText={setCity}
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
            value={pincode}
            onChangeText={setPincode}
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

const styles = StyleSheet.create({
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
});

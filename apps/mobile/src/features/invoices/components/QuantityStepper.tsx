import { quantityMilliToText, quantityTextToMilli } from '@invoice-gst/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/common/AppText';
import { IconButton } from '../../../components/common/IconButton';
import { useTheme, useThemedStyles } from '../../../theme/ThemeProvider';
import { radius, space, typography, type Theme } from '../../../theme/theme';
import { haptics } from '../../../utils/haptics';

const STEP_MILLI = 1000;

/**
 * Cart quantity control: − | quantity + unit pill | + | trash.
 * Matches the cart line card layout; text field still allows fractional qty.
 */
export function QuantityStepper({
  quantityMilli,
  unit,
  productName,
  onChange,
  onRemove,
}: {
  quantityMilli: number;
  unit: string;
  productName: string;
  onChange: (quantityMilli: number) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [text, setText] = useState(() => quantityMilliToText(quantityMilli));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(quantityMilliToText(quantityMilli));
    }
  }, [quantityMilli, focused]);

  return (
    <View style={styles.wrap}>
      <IconButton
        icon="remove"
        accessibilityLabel={`Decrease ${productName}`}
        variant="outlined"
        size={40}
        onPress={() => {
          haptics.selection();
          if (quantityMilli <= STEP_MILLI) {
            onRemove();
            return;
          }
          onChange(quantityMilli - STEP_MILLI);
        }}
      />
      <View style={styles.valuePill}>
        <TextInput
          value={text}
          onChangeText={(value) => {
            setText(value);
            try {
              onChange(quantityTextToMilli(value || '0'));
            } catch {
              // Leave partial input in the buffer until it parses.
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          selectionColor={colors.primaryText}
          accessibilityLabel={`${productName} quantity in ${unit}`}
          style={styles.input}
          maxLength={9}
        />
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>
          {unit}
        </Text>
      </View>
      <IconButton
        icon="add"
        accessibilityLabel={`Increase ${productName}`}
        variant="filled"
        size={40}
        onPress={() => {
          haptics.selection();
          onChange(quantityMilli + STEP_MILLI);
        }}
      />
      <IconButton
        icon="trash-outline"
        accessibilityLabel={`Remove ${productName}`}
        variant="plain"
        size={40}
        tone="error"
        onPress={() => {
          haptics.selection();
          onRemove();
        }}
      />
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      width: '100%',
    },
    valuePill: {
      flex: 1,
      height: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[2],
      paddingHorizontal: space[4],
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceSecondary,
    },
    input: {
      minWidth: 28,
      maxWidth: 72,
      padding: 0,
      fontSize: typography.bodyMedium.fontSize,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      color: colors.textPrimary,
    },
  });
}

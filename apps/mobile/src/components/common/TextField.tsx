import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { layout, radius, space, typography, type Theme } from '../../theme/theme';
import { Text } from './AppText';
import { Icon } from './Icon';

export type TextFieldHandle = ComponentRef<typeof TextInput>;

export type TextFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  /** Hide the visible label when the surrounding card already titles the field. */
  hideLabel?: boolean;
  /** Darker inset well — for fields sitting on elevated cards. */
  inset?: boolean;
  /** Static text before the value, e.g. "₹". */
  prefix?: string;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextFieldHandle>;
};

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  optional = false,
  hideLabel = false,
  inset = false,
  prefix,
  trailing,
  multiline = false,
  containerStyle,
  onFocus,
  onBlur,
  ref,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {hideLabel ? null : (
        <View style={styles.labelRow}>
          <Text variant="label" tone="primary">
            {label}
          </Text>
          {optional ? (
            <Text variant="caption" tone="tertiary">
              Optional
            </Text>
          ) : null}
        </View>
      )}
      <View
        style={[
          styles.field,
          inset && styles.insetField,
          multiline && styles.multilineField,
          focused && styles.focused,
          hasError && styles.errored,
          focused && hasError && styles.focusedError,
        ]}
      >
        {prefix ? (
          <Text variant="body" tone="secondary" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primaryText}
          cursorColor={colors.primaryText}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.multilineInput]}
          {...inputProps}
        />
        {trailing}
      </View>
      {hasError ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={14} tone="error" />
          <Text variant="caption" tone="error" style={styles.message}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    wrap: {
      gap: space[2],
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    field: {
      minHeight: layout.controlHeight,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      borderRadius: radius.medium,
      paddingHorizontal: space[4],
      gap: space[2],
    },
    insetField: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.border,
    },
    multilineField: {
      alignItems: 'flex-start',
      paddingVertical: space[3],
      minHeight: 96,
    },
    focused: {
      borderColor: colors.primaryText,
      boxShadow: `0px 0px 0px 3px ${colors.primarySoft}`,
    },
    errored: {
      borderColor: colors.error,
    },
    focusedError: {
      boxShadow: `0px 0px 0px 3px ${colors.errorSoft}`,
    },
    prefix: {
      marginRight: -space[1],
    },
    input: {
      fontSize: typography.body.fontSize,
      flex: 1,
      color: colors.textPrimary,
      paddingVertical: space[3],
      minHeight: layout.controlHeight - 2,
    },
    multilineInput: {
      minHeight: 88,
      paddingVertical: 0,
      textAlignVertical: 'top',
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[1],
    },
    message: {
      flex: 1,
    },
  });
}

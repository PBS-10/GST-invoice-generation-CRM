import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../theme/ThemeProvider';
import { layout, radius, space, type Theme } from '../../theme/theme';
import { haptics } from '../../utils/haptics';
import { Text } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { SearchField } from './SearchField';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

const SEARCH_THRESHOLD = 8;

/** A field that opens a bottom-sheet list, for choices too long for chips. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  hint,
  error,
  optional = false,
  sheetTitle,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  sheetTitle?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.description?.toLowerCase().includes(needle),
    );
  }, [options, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="label">{label}</Text>
        {optional ? (
          <Text variant="caption" tone="tertiary">
            Optional
          </Text>
        ) : null}
      </View>
      <PressableScale
        onPress={() => setOpen(true)}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        accessibilityHint={error ?? 'Opens a list of options'}
        style={[styles.field, error ? styles.errored : null]}
        pressedStyle={styles.pressed}
      >
        <Text
          variant="body"
          tone={selected ? 'primary' : 'tertiary'}
          numberOfLines={1}
          style={styles.value}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevron-down" size="small" tone="textTertiary" />
      </PressableScale>
      {error ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={14} tone="error" />
          <Text variant="caption" tone="error">
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      ) : null}

      <BottomSheet
        visible={open}
        onClose={close}
        title={sheetTitle ?? label}
        fullHeight={options.length > SEARCH_THRESHOLD}
      >
        {options.length > SEARCH_THRESHOLD ? (
          <SearchField value={query} onChangeText={setQuery} placeholder={`Search ${label.toLowerCase()}`} />
        ) : null}
        {/* Options ride BottomSheet's own ScrollView — nested ScrollViews crash Fabric. */}
        <View style={styles.list}>
          {filtered.map((option) => {
            const isSelected = option.value === value;
            return (
              <PressableScale
                key={option.value}
                scaleTo={1}
                onPress={() => {
                  haptics.selection();
                  onChange(option.value);
                  close();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={option.label}
                style={[styles.option, isSelected && styles.optionSelected]}
                pressedStyle={styles.pressed}
              >
                <View style={styles.optionText}>
                  <Text variant={isSelected ? 'bodyMedium' : 'body'}>{option.label}</Text>
                  {option.description ? (
                    <Text variant="caption" tone="secondary">
                      {option.description}
                    </Text>
                  ) : null}
                </View>
                {isSelected ? <Icon name="checkmark" tone="primaryText" /> : null}
              </PressableScale>
            );
          })}
          {filtered.length === 0 ? (
            <Text variant="bodySmall" tone="secondary" align="center" style={styles.noMatch}>
              No matches for “{query}”
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

function createStyles({ colors }: Theme) {
  return StyleSheet.create({
    wrap: { gap: space[2] },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    field: {
      minHeight: layout.controlHeight,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[2],
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      borderRadius: radius.medium,
      paddingHorizontal: space[4],
    },
    errored: { borderColor: colors.error },
    pressed: { backgroundColor: colors.surfaceSecondary },
    value: { flex: 1 },
    messageRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
    list: { marginTop: space[2], paddingBottom: space[4], gap: space[1] },
    option: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      paddingHorizontal: space[3],
      paddingVertical: space[2],
      borderRadius: radius.medium,
    },
    optionSelected: { backgroundColor: colors.primarySoft },
    optionText: { flex: 1, gap: 2 },
    noMatch: { paddingVertical: space[6] },
  });
}

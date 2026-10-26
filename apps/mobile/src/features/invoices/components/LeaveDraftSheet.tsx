import { StyleSheet, View } from 'react-native';
import { Text } from '../../../components/common/AppText';
import { BottomSheet } from '../../../components/common/BottomSheet';
import { Button } from '../../../components/common/Button';
import { space } from '../../../theme/theme';

export type LeaveDraftMode = 'new' | 'editing';

/**
 * Shown when leaving New Invoice with a draft in progress.
 * Options depend on whether this is a fresh bill or an unpaid-invoice edit.
 */
export function LeaveDraftSheet({
  visible,
  mode,
  hasItems,
  loading = false,
  onSave,
  onPark,
  onDiscard,
  onCancel,
}: {
  visible: boolean;
  mode: LeaveDraftMode;
  hasItems: boolean;
  loading?: boolean;
  /** Review & save (new) or continue to Review to save unpaid edits. */
  onSave: () => void;
  onPark: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const editing = mode === 'editing';

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      title={editing ? 'Leave unpaid edit?' : 'Leave this bill?'}
      description={
        editing
          ? 'Your changes are only in this cart until you save. Discard keeps the original unpaid invoice.'
          : hasItems
            ? 'This draft has items. Park it for later, save from Review, or discard it.'
            : 'This cart has no items. Discard it, or keep editing to add products.'
      }
      footer={
        <View style={styles.actions}>
          {hasItems ? (
            <Button
              label={editing ? 'Save unpaid' : 'Review & save'}
              icon="checkmark-circle-outline"
              onPress={onSave}
              loading={loading}
              disabled={loading}
            />
          ) : null}
          {!editing && hasItems ? (
            <Button
              label="Park for later"
              icon="pause-circle-outline"
              variant="secondary"
              onPress={onPark}
              disabled={loading}
            />
          ) : null}
          <Button
            label={editing ? 'Discard changes' : 'Discard bill'}
            icon="trash-outline"
            variant="danger"
            onPress={onDiscard}
            disabled={loading}
          />
          <Button
            label="Keep editing"
            variant="ghost"
            onPress={onCancel}
            disabled={loading}
          />
        </View>
      }
    >
      <Text variant="bodySmall" tone="secondary">
        {editing
          ? 'Park is unavailable while editing a saved unpaid invoice.'
          : hasItems
            ? 'Parked bills stay on this phone under Carts.'
            : 'Empty carts (₹0) are not parked or saved.'}
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: space[2],
  },
});

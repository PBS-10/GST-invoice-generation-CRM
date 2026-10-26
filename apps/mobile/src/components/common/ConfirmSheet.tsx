import { Button } from './Button';
import { BottomSheet } from './BottomSheet';
import { Text } from './AppText';

/**
 * Confirmation for irreversible actions only. Built on BottomSheet so it also
 * works on web, where native alerts cannot show buttons.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep it',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button
            label={confirmLabel}
            onPress={onConfirm}
            variant={destructive ? 'dangerSolid' : 'primary'}
            loading={loading}
          />
          <Button label={cancelLabel} onPress={onCancel} variant="ghost" disabled={loading} />
        </>
      }
    >
      <Text variant="body" tone="secondary">
        {message}
      </Text>
    </BottomSheet>
  );
}

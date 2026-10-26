import type { InvoiceStatus, PaymentStatus } from '@invoice-gst/types';
import { Badge, type BadgeTone } from '../../../components/common/Badge';
import { invoiceStatusLabel, paymentStatusLabel } from '../../../utils/format';

const paymentTone: Record<PaymentStatus, BadgeTone> = {
  paid: 'success',
  unpaid: 'warning',
  partial: 'info',
};

/** Cancellation outranks payment state; a draft shows as a draft. */
export function InvoiceStatusBadge({
  status,
  paymentStatus,
}: {
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
}) {
  if (status === 'cancelled') {
    return <Badge label={invoiceStatusLabel.cancelled} tone="neutral" />;
  }
  if (status === 'draft') {
    return <Badge label={invoiceStatusLabel.draft} tone="neutral" />;
  }
  return <Badge label={paymentStatusLabel[paymentStatus]} tone={paymentTone[paymentStatus]} dot />;
}

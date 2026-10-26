import type { InvoiceStatus, PaymentMethod, PaymentStatus } from '@invoice-gst/types';

export type RupeeParts = { sign: string; rupees: string; paise: string };

/** Groups digits the Indian way: 12,34,567. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Display-only formatting. Stored values and PDFs keep using the shared money helpers. */
export function rupeeParts(paise: number): RupeeParts {
  const absolute = Math.abs(paise);
  return {
    sign: paise < 0 ? '-' : '',
    rupees: groupIndian(String(Math.floor(absolute / 100))),
    paise: String(absolute % 100).padStart(2, '0'),
  };
}

export function formatRupees(paise: number): string {
  const { sign, rupees, paise: fraction } = rupeeParts(paise);
  return `${sign}₹${rupees}.${fraction}`;
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const weekdayFormatter = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function formatLongToday(date: Date = new Date()): string {
  return weekdayFormatter.format(date);
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "Today", "Yesterday", or a short date — used for list section headers. */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (localDayKey(date) === localDayKey(now)) {
    return 'Today';
  }
  if (localDayKey(date) === localDayKey(yesterday)) {
    return 'Yesterday';
  }
  return date.getFullYear() === now.getFullYear()
    ? shortDateFormatter.format(date)
    : dateFormatter.format(date);
}

export function dayKey(iso: string): string {
  return localDayKey(new Date(iso));
}

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  finalized: 'Finalised',
  cancelled: 'Cancelled',
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  partial: 'Part-paid',
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  credit: 'Credit',
};

/** e.g. "Paid by Cash" / "Paid by UPI · Cash" — null when there are no payments. */
export function paidByLabel(payments: readonly { method: PaymentMethod }[]): string | null {
  if (payments.length === 0) {
    return null;
  }
  const methods = [
    ...new Set(payments.map((payment) => paymentMethodLabel[payment.method])),
  ];
  if (methods.length === 1) {
    return `Paid by ${methods[0]}`;
  }
  return `Paid by ${methods.join(' · ')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || '?';
}

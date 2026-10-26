export type SyncResultStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected';

const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function clampClientUpdatedAt(clientUpdatedAt: string, now = new Date()): Date {
  const parsed = Date.parse(clientUpdatedAt);
  if (Number.isNaN(parsed)) {
    return now;
  }
  if (parsed > now.getTime() + FUTURE_SKEW_MS) {
    return now;
  }
  return new Date(parsed);
}

export function masterDataDecision(input: {
  exists: boolean;
  serverUpdatedAt: string | null;
  clientUpdatedAt: string;
}): 'apply' | 'duplicate' | 'conflict' {
  if (!input.exists || input.serverUpdatedAt == null) {
    return 'apply';
  }
  const server = Date.parse(input.serverUpdatedAt);
  const client = Date.parse(input.clientUpdatedAt);
  if (Number.isNaN(client) || Number.isNaN(server)) {
    return 'conflict';
  }
  if (client > server) {
    return 'apply';
  }
  if (client === server) {
    return 'duplicate';
  }
  return 'conflict';
}

export function invoiceCreateDecision(input: {
  exists: boolean;
  samePayload: boolean;
  gstOk: boolean;
  /** When true, an existing unpaid finalized invoice may be replaced in place. */
  allowUnpaidReplace?: boolean;
  paymentStatus?: string | null;
  status?: string | null;
}): { status: SyncResultStatus; code?: string } {
  if (input.exists) {
    if (input.samePayload) {
      return { status: 'duplicate' };
    }
    if (
      input.allowUnpaidReplace &&
      input.status === 'finalized' &&
      input.paymentStatus !== 'paid'
    ) {
      if (!input.gstOk) {
        return { status: 'rejected', code: 'GST_MISMATCH' };
      }
      return { status: 'applied', code: 'UNPAID_REPLACE' };
    }
    return { status: 'rejected', code: 'INVOICE_IMMUTABLE' };
  }
  if (!input.gstOk) {
    return { status: 'rejected', code: 'GST_MISMATCH' };
  }
  return { status: 'applied' };
}

export function invoiceCancelDecision(input: {
  exists: boolean;
  status: string | null;
}): { status: SyncResultStatus; code?: string } {
  if (!input.exists) {
    return { status: 'rejected', code: 'NOT_FOUND' };
  }
  if (input.status === 'cancelled') {
    return { status: 'duplicate' };
  }
  if (input.status !== 'finalized') {
    return { status: 'rejected', code: 'INVOICE_STATE' };
  }
  return { status: 'applied' };
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

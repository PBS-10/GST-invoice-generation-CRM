import type {
  Customer,
  CustomerSnapshot,
  CustomerType,
  GstConfiguration,
  GstRegistrationType,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductUnit,
  RoundingMode,
  SyncStatus,
  Vendor,
} from '@invoice-gst/types';
import type { InferSelectModel } from 'drizzle-orm';
import {
  customers,
  gstConfigurations,
  invoiceItems,
  invoices,
  payments,
  products,
  vendors,
} from './schema';

export function mapVendor(row: InferSelectModel<typeof vendors>): Vendor {
  return {
    ...row,
    gstRegistrationType: row.gstRegistrationType as GstRegistrationType,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

export function mapCustomer(row: InferSelectModel<typeof customers>): Customer {
  return {
    ...row,
    customerType: row.customerType as CustomerType,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

export function mapProduct(row: InferSelectModel<typeof products>): Product {
  let aliases: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.aliases);
    aliases = Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    aliases = [];
  }
  return {
    ...row,
    aliases,
    unit: row.unit as ProductUnit,
    // SQLite integers; tolerate boolean/number from drivers.
    priceInclusive: Number(row.priceInclusive) === 1,
    isActive: Number(row.isActive) === 1,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

export function mapInvoice(row: InferSelectModel<typeof invoices>): Invoice {
  return {
    ...row,
    customerSnapshot: JSON.parse(row.customerSnapshot) as CustomerSnapshot,
    isInterState: row.isInterState === 1,
    status: row.status as InvoiceStatus,
    paymentStatus: row.paymentStatus as PaymentStatus,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

export function mapInvoiceItem(row: InferSelectModel<typeof invoiceItems>): InvoiceItem {
  return {
    ...row,
    priceInclusive: row.priceInclusive === 1,
  };
}

export function mapPayment(row: InferSelectModel<typeof payments>): Payment {
  return {
    ...row,
    method: row.method as PaymentMethod,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

export function mapGstConfig(row: InferSelectModel<typeof gstConfigurations>): GstConfiguration {
  return {
    ...row,
    enableIgst: row.enableIgst === 1,
    compositionScheme: row.compositionScheme === 1,
    roundingMode: row.roundingMode as RoundingMode,
    syncStatus: row.syncStatus as SyncStatus,
  };
}

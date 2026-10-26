export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';

export type GstRegistrationType = 'regular' | 'composition' | 'unregistered';

export type CustomerType = 'b2c' | 'b2b' | 'unregistered';

export type ProductUnit = 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'packet' | 'other';

export type InvoiceStatus = 'draft' | 'finalized' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';

export type RoundingMode = 'nearest' | 'up' | 'down';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncEntityType =
  | 'vendor'
  | 'gst_configuration'
  | 'product'
  | 'customer'
  | 'invoice';

export type SyncQueueStatus =
  | 'pending'
  | 'in_flight'
  | 'synced'
  | 'failed'
  | 'conflict';

export type BackupStatus =
  | 'anonymous'
  | 'syncing'
  | 'synced'
  | 'paused_auth'
  | 'paused_network'
  | 'needs_attention';

export type DeviceInfo = {
  id: string;
  label: string;
  platform: string;
  appVersion?: string | null;
  seriesCode: string;
};

export type CustomerSnapshot = {
  name: string;
  phone: string | null;
  gstin: string | null;
  stateCode: string | null;
};

export type Vendor = {
  id: string;
  businessName: string;
  tradeName: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateCode: string;
  pincode: string | null;
  gstRegistrationType: GstRegistrationType;
  invoicePrefix: string;
  logoUri: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  stateCode: string | null;
  pincode: string | null;
  gstin: string | null;
  customerType: CustomerType;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
};

export type Product = {
  id: string;
  name: string;
  localName: string | null;
  aliases: string[];
  sku: string | null;
  hsnCode: string | null;
  unit: ProductUnit;
  sellingPricePaise: number;
  gstRateBps: number;
  priceInclusive: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
};

export type InvoiceItem = {
  id: string;
  invoiceId: string;
  productId: string | null;
  productNameSnapshot: string;
  localNameSnapshot: string | null;
  hsnSnapshot: string | null;
  unitSnapshot: string;
  quantityMilli: number;
  unitPricePaise: number;
  gstRateBps: number;
  priceInclusive: boolean;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
};

export type Payment = {
  id: string;
  invoiceId: string;
  method: PaymentMethod;
  amountPaise: number;
  paidAt: string;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  customerId: string | null;
  customerSnapshot: CustomerSnapshot;
  placeOfSupplyStateCode: string;
  isInterState: boolean;
  status: InvoiceStatus;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  paymentStatus: PaymentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  syncStatus: SyncStatus;
};

export type InvoiceWithItems = Invoice & {
  items: InvoiceItem[];
  payments: Payment[];
};

export type GstConfiguration = {
  id: string;
  vendorId: string;
  defaultGstRateBps: number;
  enableIgst: boolean;
  roundingMode: RoundingMode;
  compositionScheme: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

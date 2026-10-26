import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const vendors = sqliteTable('vendors', {
  id: text('id').primaryKey(),
  businessName: text('businessName').notNull(),
  tradeName: text('tradeName'),
  gstin: text('gstin'),
  phone: text('phone'),
  email: text('email'),
  addressLine1: text('addressLine1'),
  addressLine2: text('addressLine2'),
  city: text('city'),
  stateCode: text('stateCode').notNull(),
  pincode: text('pincode'),
  gstRegistrationType: text('gstRegistrationType').notNull(),
  invoicePrefix: text('invoicePrefix').notNull(),
  logoUri: text('logoUri'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
  deletedAt: text('deletedAt'),
  syncStatus: text('syncStatus').notNull().default('pending'),
});

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    addressLine1: text('addressLine1'),
    city: text('city'),
    stateCode: text('stateCode'),
    pincode: text('pincode'),
    gstin: text('gstin'),
    customerType: text('customerType').notNull(),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    deletedAt: text('deletedAt'),
    syncStatus: text('syncStatus').notNull().default('pending'),
  },
  (table) => [
    index('customers_phone').on(table.phone),
    index('customers_name').on(table.name),
  ],
);

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    localName: text('localName'),
    aliases: text('aliases').notNull(),
    sku: text('sku'),
    hsnCode: text('hsnCode'),
    unit: text('unit').notNull(),
    sellingPricePaise: integer('sellingPricePaise').notNull(),
    gstRateBps: integer('gstRateBps').notNull(),
    priceInclusive: integer('priceInclusive').notNull(),
    isActive: integer('isActive').notNull().default(1),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    deletedAt: text('deletedAt'),
    syncStatus: text('syncStatus').notNull().default('pending'),
  },
  (table) => [
    index('products_name').on(table.name),
    index('products_sku').on(table.sku),
    index('products_active').on(table.isActive),
  ],
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    invoiceNumber: text('invoiceNumber').notNull(),
    financialYear: text('financialYear').notNull(),
    customerId: text('customerId'),
    customerSnapshot: text('customerSnapshot').notNull(),
    placeOfSupplyStateCode: text('placeOfSupplyStateCode').notNull(),
    isInterState: integer('isInterState').notNull(),
    status: text('status').notNull(),
    subtotalPaise: integer('subtotalPaise').notNull(),
    discountPaise: integer('discountPaise').notNull(),
    taxablePaise: integer('taxablePaise').notNull(),
    cgstPaise: integer('cgstPaise').notNull(),
    sgstPaise: integer('sgstPaise').notNull(),
    igstPaise: integer('igstPaise').notNull(),
    roundOffPaise: integer('roundOffPaise').notNull(),
    totalPaise: integer('totalPaise').notNull(),
    paymentStatus: text('paymentStatus').notNull(),
    notes: text('notes'),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    finalizedAt: text('finalizedAt'),
    syncStatus: text('syncStatus').notNull().default('pending'),
  },
  (table) => [
    uniqueIndex('invoices_number_fy').on(table.financialYear, table.invoiceNumber),
    index('invoices_createdAt').on(table.createdAt),
    index('invoices_status').on(table.status),
    index('invoices_customerId').on(table.customerId),
  ],
);

export const invoiceItems = sqliteTable(
  'invoice_items',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoiceId').notNull(),
    productId: text('productId'),
    productNameSnapshot: text('productNameSnapshot').notNull(),
    localNameSnapshot: text('localNameSnapshot'),
    hsnSnapshot: text('hsnSnapshot'),
    unitSnapshot: text('unitSnapshot').notNull(),
    quantityMilli: integer('quantityMilli').notNull(),
    unitPricePaise: integer('unitPricePaise').notNull(),
    gstRateBps: integer('gstRateBps').notNull(),
    priceInclusive: integer('priceInclusive').notNull(),
    taxablePaise: integer('taxablePaise').notNull(),
    cgstPaise: integer('cgstPaise').notNull(),
    sgstPaise: integer('sgstPaise').notNull(),
    igstPaise: integer('igstPaise').notNull(),
    lineTotalPaise: integer('lineTotalPaise').notNull(),
  },
  (table) => [index('invoice_items_invoiceId').on(table.invoiceId)],
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoiceId').notNull(),
    method: text('method').notNull(),
    amountPaise: integer('amountPaise').notNull(),
    paidAt: text('paidAt').notNull(),
    reference: text('reference'),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    syncStatus: text('syncStatus').notNull().default('pending'),
  },
  (table) => [index('payments_invoiceId').on(table.invoiceId)],
);

export const gstConfigurations = sqliteTable(
  'gst_configurations',
  {
    id: text('id').primaryKey(),
    vendorId: text('vendorId').notNull(),
    defaultGstRateBps: integer('defaultGstRateBps').notNull(),
    enableIgst: integer('enableIgst').notNull(),
    roundingMode: text('roundingMode').notNull(),
    compositionScheme: integer('compositionScheme').notNull(),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
    syncStatus: text('syncStatus').notNull().default('pending'),
  },
  (table) => [uniqueIndex('gst_configurations_vendorId').on(table.vendorId)],
);

export const invoiceSequences = sqliteTable(
  'invoice_sequences',
  {
    id: text('id').primaryKey(),
    vendorId: text('vendorId').notNull(),
    financialYear: text('financialYear').notNull(),
    seriesCode: text('seriesCode').notNull().default('A'),
    nextNumber: integer('nextNumber').notNull(),
  },
  (table) => [
    uniqueIndex('invoice_sequences_vendor_series_fy').on(
      table.vendorId,
      table.seriesCode,
      table.financialYear,
    ),
  ],
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Local-only open carts (not synced). */
export const billingCarts = sqliteTable(
  'billing_carts',
  {
    id: text('id').primaryKey(),
    customerId: text('customerId'),
    customerSnapshot: text('customerSnapshot').notNull(),
    invoiceDiscountPaise: integer('invoiceDiscountPaise').notNull().default(0),
    notes: text('notes'),
    paymentMethod: text('paymentMethod').notNull().default('cash'),
    collectPayment: integer('collectPayment').notNull().default(1),
    label: text('label'),
    createdAt: text('createdAt').notNull(),
    updatedAt: text('updatedAt').notNull(),
  },
  (table) => [index('billing_carts_updatedAt').on(table.updatedAt)],
);

export const billingCartLines = sqliteTable(
  'billing_cart_lines',
  {
    id: text('id').primaryKey(),
    cartId: text('cartId')
      .notNull()
      .references(() => billingCarts.id, { onDelete: 'cascade' }),
    productId: text('productId'),
    productName: text('productName').notNull(),
    localName: text('localName'),
    hsnCode: text('hsnCode'),
    unit: text('unit').notNull(),
    quantityMilli: integer('quantityMilli').notNull(),
    unitPricePaise: integer('unitPricePaise').notNull(),
    gstRateBps: integer('gstRateBps').notNull(),
    priceInclusive: integer('priceInclusive').notNull(),
    lineDiscountPaise: integer('lineDiscountPaise').notNull().default(0),
    sortIndex: integer('sortIndex').notNull().default(0),
  },
  (table) => [index('billing_cart_lines_cartId').on(table.cartId)],
);

export const syncQueue = sqliteTable(
  'sync_queue',
  {
    id: text('id').primaryKey(),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    operation: text('operation').notNull(),
    payload: text('payload').notNull(),
    idempotencyKey: text('idempotencyKey').notNull(),
    createdAt: text('createdAt').notNull(),
    retryCount: integer('retryCount').notNull().default(0),
    lastError: text('lastError'),
    status: text('status').notNull(),
  },
  (table) => [
    uniqueIndex('sync_queue_idempotencyKey').on(table.idempotencyKey),
    index('sync_queue_status_createdAt').on(table.status, table.createdAt),
    index('sync_queue_entity').on(table.entityType, table.entityId),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    entityType: text('entityType').notNull(),
    entityId: text('entityId').notNull(),
    action: text('action').notNull(),
    payload: text('payload'),
    createdAt: text('createdAt').notNull(),
  },
  (table) => [index('audit_events_entity').on(table.entityType, table.entityId, table.createdAt)],
);

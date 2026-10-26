CREATE TABLE `vendors` (
  `id` text PRIMARY KEY NOT NULL,
  `businessName` text NOT NULL,
  `tradeName` text,
  `gstin` text,
  `phone` text,
  `email` text,
  `addressLine1` text,
  `addressLine2` text,
  `city` text,
  `stateCode` text NOT NULL,
  `pincode` text,
  `gstRegistrationType` text NOT NULL,
  `invoicePrefix` text NOT NULL,
  `logoUri` text,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `deletedAt` text,
  `syncStatus` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE TABLE `customers` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `phone` text,
  `email` text,
  `addressLine1` text,
  `city` text,
  `stateCode` text,
  `pincode` text,
  `gstin` text,
  `customerType` text NOT NULL,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `deletedAt` text,
  `syncStatus` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE INDEX `customers_phone` ON `customers` (`phone`);
--> statement-breakpoint
CREATE INDEX `customers_name` ON `customers` (`name`);
--> statement-breakpoint
CREATE TABLE `products` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `localName` text,
  `aliases` text NOT NULL,
  `sku` text,
  `hsnCode` text,
  `unit` text NOT NULL,
  `sellingPricePaise` integer NOT NULL,
  `gstRateBps` integer NOT NULL,
  `priceInclusive` integer NOT NULL,
  `isActive` integer NOT NULL DEFAULT 1,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `deletedAt` text,
  `syncStatus` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE INDEX `products_name` ON `products` (`name`);
--> statement-breakpoint
CREATE INDEX `products_sku` ON `products` (`sku`);
--> statement-breakpoint
CREATE INDEX `products_active` ON `products` (`isActive`);
--> statement-breakpoint
CREATE TABLE `invoices` (
  `id` text PRIMARY KEY NOT NULL,
  `invoiceNumber` text NOT NULL,
  `financialYear` text NOT NULL,
  `customerId` text,
  `customerSnapshot` text NOT NULL,
  `placeOfSupplyStateCode` text NOT NULL,
  `isInterState` integer NOT NULL,
  `status` text NOT NULL,
  `subtotalPaise` integer NOT NULL,
  `discountPaise` integer NOT NULL,
  `taxablePaise` integer NOT NULL,
  `cgstPaise` integer NOT NULL,
  `sgstPaise` integer NOT NULL,
  `igstPaise` integer NOT NULL,
  `roundOffPaise` integer NOT NULL,
  `totalPaise` integer NOT NULL,
  `paymentStatus` text NOT NULL,
  `notes` text,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `finalizedAt` text,
  `syncStatus` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_fy` ON `invoices` (`financialYear`, `invoiceNumber`);
--> statement-breakpoint
CREATE INDEX `invoices_createdAt` ON `invoices` (`createdAt`);
--> statement-breakpoint
CREATE INDEX `invoices_status` ON `invoices` (`status`);
--> statement-breakpoint
CREATE INDEX `invoices_customerId` ON `invoices` (`customerId`);
--> statement-breakpoint
CREATE TABLE `invoice_items` (
  `id` text PRIMARY KEY NOT NULL,
  `invoiceId` text NOT NULL,
  `productId` text,
  `productNameSnapshot` text NOT NULL,
  `localNameSnapshot` text,
  `hsnSnapshot` text,
  `unitSnapshot` text NOT NULL,
  `quantityMilli` integer NOT NULL,
  `unitPricePaise` integer NOT NULL,
  `gstRateBps` integer NOT NULL,
  `priceInclusive` integer NOT NULL,
  `taxablePaise` integer NOT NULL,
  `cgstPaise` integer NOT NULL,
  `sgstPaise` integer NOT NULL,
  `igstPaise` integer NOT NULL,
  `lineTotalPaise` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoiceId` ON `invoice_items` (`invoiceId`);
--> statement-breakpoint
CREATE TABLE `payments` (
  `id` text PRIMARY KEY NOT NULL,
  `invoiceId` text NOT NULL,
  `method` text NOT NULL,
  `amountPaise` integer NOT NULL,
  `paidAt` text NOT NULL,
  `reference` text,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `syncStatus` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE INDEX `payments_invoiceId` ON `payments` (`invoiceId`);
--> statement-breakpoint
CREATE TABLE `gst_configurations` (
  `id` text PRIMARY KEY NOT NULL,
  `vendorId` text NOT NULL,
  `defaultGstRateBps` integer NOT NULL,
  `enableIgst` integer NOT NULL,
  `roundingMode` text NOT NULL,
  `compositionScheme` integer NOT NULL,
  `createdAt` text NOT NULL,
  `updatedAt` text NOT NULL,
  `syncStatus` text NOT NULL DEFAULT 'pending'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gst_configurations_vendorId` ON `gst_configurations` (`vendorId`);
--> statement-breakpoint
CREATE TABLE `invoice_sequences` (
  `id` text PRIMARY KEY NOT NULL,
  `vendorId` text NOT NULL,
  `financialYear` text NOT NULL,
  `nextNumber` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_sequences_vendor_fy` ON `invoice_sequences` (`vendorId`, `financialYear`);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
  `id` text PRIMARY KEY NOT NULL,
  `entityType` text NOT NULL,
  `entityId` text NOT NULL,
  `operation` text NOT NULL,
  `payload` text NOT NULL,
  `idempotencyKey` text NOT NULL,
  `createdAt` text NOT NULL,
  `retryCount` integer NOT NULL DEFAULT 0,
  `lastError` text,
  `status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_queue_idempotencyKey` ON `sync_queue` (`idempotencyKey`);
--> statement-breakpoint
CREATE INDEX `sync_queue_status_createdAt` ON `sync_queue` (`status`, `createdAt`);
--> statement-breakpoint
CREATE INDEX `sync_queue_entity` ON `sync_queue` (`entityType`, `entityId`);
--> statement-breakpoint
CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `entityType` text NOT NULL,
  `entityId` text NOT NULL,
  `action` text NOT NULL,
  `payload` text,
  `createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_entity` ON `audit_events` (`entityType`, `entityId`, `createdAt`);

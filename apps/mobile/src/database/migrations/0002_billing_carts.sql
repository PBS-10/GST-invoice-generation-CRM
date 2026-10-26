CREATE TABLE `billing_carts` (
	`id` text PRIMARY KEY NOT NULL,
	`customerId` text,
	`customerSnapshot` text NOT NULL,
	`invoiceDiscountPaise` integer NOT NULL DEFAULT 0,
	`notes` text,
	`paymentMethod` text NOT NULL DEFAULT 'cash',
	`collectPayment` integer NOT NULL DEFAULT 1,
	`label` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `billing_cart_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`cartId` text NOT NULL,
	`productId` text,
	`productName` text NOT NULL,
	`localName` text,
	`hsnCode` text,
	`unit` text NOT NULL,
	`quantityMilli` integer NOT NULL,
	`unitPricePaise` integer NOT NULL,
	`gstRateBps` integer NOT NULL,
	`priceInclusive` integer NOT NULL,
	`lineDiscountPaise` integer NOT NULL DEFAULT 0,
	`sortIndex` integer NOT NULL DEFAULT 0,
	FOREIGN KEY (`cartId`) REFERENCES `billing_carts`(`id`) ON DELETE CASCADE
);--> statement-breakpoint
CREATE INDEX `billing_cart_lines_cartId` ON `billing_cart_lines` (`cartId`);--> statement-breakpoint
CREATE INDEX `billing_carts_updatedAt` ON `billing_carts` (`updatedAt`);

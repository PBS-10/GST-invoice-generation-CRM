CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);--> statement-breakpoint
ALTER TABLE `invoice_sequences` ADD `seriesCode` text DEFAULT 'A' NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `invoice_sequences_vendor_fy`;--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_sequences_vendor_series_fy` ON `invoice_sequences` (`vendorId`,`seriesCode`,`financialYear`);--> statement-breakpoint
UPDATE `vendors` SET `invoicePrefix` = substr(`invoicePrefix`, 1, 3) WHERE length(`invoicePrefix`) > 3;--> statement-breakpoint
INSERT OR IGNORE INTO `app_meta` (`key`, `value`) VALUES ('seriesCode', 'A');

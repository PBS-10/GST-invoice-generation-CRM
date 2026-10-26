-- CreateEnum-like sequence for monotonic server versions across sync entities.
CREATE SEQUENCE IF NOT EXISTS "sync_server_version_seq";

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "seriesCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- Drop legacy refresh tokens (no Device yet) and the unused deviceLabel column.
DELETE FROM "RefreshToken";
ALTER TABLE "RefreshToken" DROP COLUMN IF EXISTS "deviceLabel";
ALTER TABLE "RefreshToken" ADD COLUMN "deviceId" TEXT NOT NULL;
ALTER TABLE "RefreshToken" ADD COLUMN "replacedById" TEXT;

CREATE UNIQUE INDEX "Device_vendorId_seriesCode_key" ON "Device"("vendorId", "seriesCode");
CREATE INDEX "Device_vendorId_idx" ON "Device"("vendorId");
CREATE INDEX "Device_userId_idx" ON "Device"("userId");
CREATE INDEX "RefreshToken_deviceId_idx" ON "RefreshToken"("deviceId");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

ALTER TABLE "Device" ADD CONSTRAINT "Device_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- serverVersion on sync entities
ALTER TABLE "Vendor" ADD COLUMN "serverVersion" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "serverVersion" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "serverVersion" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN "serverVersion" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "GstConfiguration" ADD COLUMN "serverVersion" BIGINT NOT NULL DEFAULT 0;

UPDATE "Vendor" SET "serverVersion" = nextval('sync_server_version_seq') WHERE "serverVersion" = 0;
UPDATE "GstConfiguration" SET "serverVersion" = nextval('sync_server_version_seq') WHERE "serverVersion" = 0;
UPDATE "Customer" SET "serverVersion" = nextval('sync_server_version_seq') WHERE "serverVersion" = 0;
UPDATE "Product" SET "serverVersion" = nextval('sync_server_version_seq') WHERE "serverVersion" = 0;
UPDATE "Invoice" SET "serverVersion" = nextval('sync_server_version_seq') WHERE "serverVersion" = 0;

ALTER TABLE "Vendor" ALTER COLUMN "serverVersion" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "serverVersion" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "serverVersion" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "serverVersion" DROP DEFAULT;
ALTER TABLE "GstConfiguration" ALTER COLUMN "serverVersion" DROP DEFAULT;

CREATE INDEX "Vendor_serverVersion_idx" ON "Vendor"("serverVersion");
CREATE INDEX "Customer_vendorId_serverVersion_idx" ON "Customer"("vendorId", "serverVersion");
CREATE INDEX "Product_vendorId_serverVersion_idx" ON "Product"("vendorId", "serverVersion");
CREATE INDEX "Invoice_vendorId_serverVersion_idx" ON "Invoice"("vendorId", "serverVersion");

-- InvoiceSequence: add seriesCode
ALTER TABLE "InvoiceSequence" ADD COLUMN "seriesCode" TEXT NOT NULL DEFAULT 'A';
ALTER TABLE "InvoiceSequence" DROP CONSTRAINT IF EXISTS "InvoiceSequence_vendorId_financialYear_key";
CREATE UNIQUE INDEX "InvoiceSequence_vendorId_seriesCode_financialYear_key" ON "InvoiceSequence"("vendorId", "seriesCode", "financialYear");

-- Drop StoredFile
DROP TABLE IF EXISTS "StoredFile";

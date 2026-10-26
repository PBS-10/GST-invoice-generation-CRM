# Data Model

SQLite is the on-device source of truth. PostgreSQL is the cloud copy, owned by Prisma in `apps/backend`.

Related docs: [Architecture](./ARCHITECTURE.md) · [Sync](./SYNC.md)

## Conventions

| Rule | Detail |
|---|---|
| Primary keys | UUID text, generated on device |
| Timestamps | ISO-8601 text (`strftime` / JS ISO strings), UTC |
| Soft delete | `deletedAt` nullable. Queries that list live rows filter `deletedAt IS NULL` |
| Sync | `syncStatus`: `pending \| synced \| conflict \| failed`. Cloud worker marks `synced` after push ack |
| Server id | Omitted. Future PostgreSQL uses the same UUID as PK |
| Money | Integer paise (`INTEGER`) |
| Quantity | Integer milli-units (`INTEGER`). `2000` = 2.000 |
| GST rate | Integer basis points (`INTEGER`). `1800` = 18% |
| JSON columns | Text. Validate at the repository boundary with Zod |
| Booleans | Integer `0` / `1` |

Enums below are application-level. Store them as text. Enforce with Zod, not SQLite CHECK constraints (easier migrations).

## Entity relationship

```
vendors 1───1 gst_configurations
vendors 1───* invoice_sequences   (per seriesCode + financialYear)
vendors 1───* invoices
customers 1───* invoices          (invoices.customerId nullable)
products 1───* invoice_items      (invoice_items.productId nullable)
invoices 1───* invoice_items
invoices 1───* payments
* ───* sync_queue                 (by entityType + entityId)
* ───* audit_events
app_meta                          (deviceId, seriesCode, accountEmail, pullCursor, activeCartId, …)
billing_carts 1───* billing_cart_lines   (local-only parked bills; not synced)
```

Typically one `vendors` row on the phone. Cloud PostgreSQL also has `User`, `Device`, and `RefreshToken` (see below).

---

## SQLite tables

### `vendors`

Local business profile.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `businessName` | TEXT NOT NULL | Legal / invoice name |
| `tradeName` | TEXT | Optional display name |
| `gstin` | TEXT | 15 chars when present; empty for unregistered |
| `phone` | TEXT | |
| `email` | TEXT | |
| `addressLine1` | TEXT | |
| `addressLine2` | TEXT | |
| `city` | TEXT | |
| `stateCode` | TEXT NOT NULL | GST 2-digit state code (`32` Kerala) |
| `pincode` | TEXT | |
| `gstRegistrationType` | TEXT NOT NULL | `regular \| composition \| unregistered` |
| `invoicePrefix` | TEXT NOT NULL | 1–3 alphanumeric chars (e.g. `INV`) |
| `logoUri` | TEXT | Local file URI |
| `createdAt` | TEXT NOT NULL | |
| `updatedAt` | TEXT NOT NULL | |
| `deletedAt` | TEXT | |
| `syncStatus` | TEXT NOT NULL | Default `pending` |

Indexes: none required beyond PK in v1.

### `customers`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | |
| `phone` | TEXT | |
| `email` | TEXT | |
| `addressLine1` | TEXT | |
| `city` | TEXT | |
| `stateCode` | TEXT | Required for B2B inter-state detection |
| `pincode` | TEXT | |
| `gstin` | TEXT | |
| `customerType` | TEXT NOT NULL | `b2c \| b2b \| unregistered` |
| `createdAt` | TEXT NOT NULL | |
| `updatedAt` | TEXT NOT NULL | |
| `deletedAt` | TEXT | |
| `syncStatus` | TEXT NOT NULL | Default `pending` |

Indexes:

- `customers_phone` on `phone`
- `customers_name` on `name`

Walk-in: do not insert a customer. Leave `invoices.customerId` null and store `customerSnapshot`.

### `products`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Canonical English / billing name |
| `localName` | TEXT | Regional display name |
| `aliases` | TEXT NOT NULL | JSON array of strings, e.g. `["rice","അരി","ari"]` |
| `sku` | TEXT | |
| `hsnCode` | TEXT | String; 4/6/8 digits depending on turnover |
| `unit` | TEXT NOT NULL | `kg \| g \| l \| ml \| pcs \| packet \| other` |
| `sellingPricePaise` | INTEGER NOT NULL | |
| `gstRateBps` | INTEGER NOT NULL | |
| `priceInclusive` | INTEGER NOT NULL | `0` exclusive, `1` inclusive |
| `isActive` | INTEGER NOT NULL | Default `1` |
| `createdAt` | TEXT NOT NULL | |
| `updatedAt` | TEXT NOT NULL | |
| `deletedAt` | TEXT | |
| `syncStatus` | TEXT NOT NULL | Default `pending` |

Indexes:

- `products_name` on `name`
- `products_sku` on `sku` (unique where `sku IS NOT NULL` and `deletedAt IS NULL` — enforce in repository if SQLite partial unique is awkward)
- `products_active` on `isActive`

`aliases` are the future voice/NLP match key. Keep them normalized (trim, lowercase where script allows) at write time.

### `invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `invoiceNumber` | TEXT NOT NULL | `ABC/25-26/000123` |
| `financialYear` | TEXT NOT NULL | `25-26` (April–March) |
| `customerId` | TEXT | FK `customers.id`, nullable |
| `customerSnapshot` | TEXT NOT NULL | JSON: name, phone, gstin, stateCode |
| `placeOfSupplyStateCode` | TEXT NOT NULL | |
| `isInterState` | INTEGER NOT NULL | |
| `status` | TEXT NOT NULL | `draft \| finalized \| cancelled` |
| `subtotalPaise` | INTEGER NOT NULL | |
| `discountPaise` | INTEGER NOT NULL | Invoice-level discount |
| `taxablePaise` | INTEGER NOT NULL | |
| `cgstPaise` | INTEGER NOT NULL | |
| `sgstPaise` | INTEGER NOT NULL | |
| `igstPaise` | INTEGER NOT NULL | |
| `roundOffPaise` | INTEGER NOT NULL | |
| `totalPaise` | INTEGER NOT NULL | |
| `paymentStatus` | TEXT NOT NULL | `unpaid \| partial \| paid` |
| `notes` | TEXT | |
| `createdAt` | TEXT NOT NULL | |
| `updatedAt` | TEXT NOT NULL | |
| `finalizedAt` | TEXT | Set when status becomes `finalized` |
| `syncStatus` | TEXT NOT NULL | Default `pending` |

Constraints (application + unique index):

- Unique `(financialYear, invoiceNumber)` — v1 single vendor. When `vendorId` is added, unique `(vendorId, financialYear, invoiceNumber)`.
- Paid finalized rows are immutable. Unpaid finalized rows may be replaced via `replaceUnpaid` (same number); paid mutations still throw `InvoiceStateError`.
- Cancel sets `status = cancelled` and writes `audit_events`. Do not delete.

Indexes:

- `invoices_number_fy` unique on `(financialYear, invoiceNumber)`
- `invoices_createdAt` on `createdAt`
- `invoices_status` on `status`
- `invoices_customerId` on `customerId`

### `invoice_items`

Snapshots. Do not join live `products` for historical display or GST reprint.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `invoiceId` | TEXT NOT NULL | FK `invoices.id` |
| `productId` | TEXT | FK `products.id`, nullable for ad-hoc lines |
| `productNameSnapshot` | TEXT NOT NULL | |
| `localNameSnapshot` | TEXT | |
| `hsnSnapshot` | TEXT | |
| `unitSnapshot` | TEXT NOT NULL | |
| `quantityMilli` | INTEGER NOT NULL | |
| `unitPricePaise` | INTEGER NOT NULL | |
| `gstRateBps` | INTEGER NOT NULL | |
| `priceInclusive` | INTEGER NOT NULL | |
| `taxablePaise` | INTEGER NOT NULL | |
| `cgstPaise` | INTEGER NOT NULL | |
| `sgstPaise` | INTEGER NOT NULL | |
| `igstPaise` | INTEGER NOT NULL | |
| `lineTotalPaise` | INTEGER NOT NULL | |

Indexes:

- `invoice_items_invoiceId` on `invoiceId`

No `syncStatus` on items. They sync as part of the parent invoice payload.

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `invoiceId` | TEXT NOT NULL | FK `invoices.id` |
| `method` | TEXT NOT NULL | `cash \| upi \| card \| credit` |
| `amountPaise` | INTEGER NOT NULL | |
| `paidAt` | TEXT NOT NULL | |
| `reference` | TEXT | UPI ref / card last4 |
| `createdAt` | TEXT NOT NULL | |
| `updatedAt` | TEXT NOT NULL | |
| `syncStatus` | TEXT NOT NULL | Default `pending` |

Indexes:

- `payments_invoiceId` on `invoiceId`

`invoices.paymentStatus` is derived when writing payments (sum vs `totalPaise`) and stored denormalized for list queries.

### `gst_configurations`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `vendorId` | TEXT NOT NULL | FK `vendors.id` |
| `defaultGstRateBps` | INTEGER NOT NULL | |
| `enableIgst` | INTEGER NOT NULL | Default `1` |
| `roundingMode` | TEXT NOT NULL | `nearest \| up \| down` |
| `compositionScheme` | INTEGER NOT NULL | Mirrors vendor; Bill of Supply path |
| `createdAt` | TEXT NOT NULL | |
| `updatedAt` | TEXT NOT NULL | |
| `syncStatus` | TEXT NOT NULL | Default `pending` |

Unique: `gst_configurations_vendorId` on `vendorId`.

### `app_meta`

Key/value store for device identity and backup state (not synced as an entity).

| Key | Notes |
|---|---|
| `deviceId` | UUID generated on the phone |
| `seriesCode` | Default `A`; set by server on register/login |
| `accountEmail` | Set when signed in |
| `linkedVendorId` | Cloud vendor id |
| `pullCursor` | Last `serverVersion` pulled |
| `lastSyncAt` | ISO timestamp |
| `lastBackupNudgeDate` | `YYYY-MM-DD` for daily post-invoice toast |
| `activeCartId` | UUID of the cart shown on New invoice |
| `editingInvoiceId` | When set, Review updates this unpaid invoice instead of creating a new number |

### `billing_carts` / `billing_cart_lines`

Local-only open carts for park/resume while billing. Never written to `sync_queue`. Soft cap of 8 open carts. Checkout finalizes a normal invoice, then deletes the cart.

| Cart column | Notes |
|---|---|
| `customerId` / `customerSnapshot` | Same snapshot idea as invoices |
| `invoiceDiscountPaise`, `notes`, `paymentMethod`, `collectPayment` | Carried into Preview |
| `label` | Display name (defaults to customer / Walk-in) |

Lines mirror draft line snapshots (product, qty, unit price, GST rate, inclusive flag).

### `invoice_sequences`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `vendorId` | TEXT NOT NULL | FK `vendors.id` |
| `financialYear` | TEXT NOT NULL | `25-26` |
| `seriesCode` | TEXT NOT NULL | Device series (`A`, `B`, …); default `A` |
| `nextNumber` | INTEGER NOT NULL | Next sequence to allocate |

Unique: `(vendorId, seriesCode, financialYear)`.

Allocate inside the same transaction as invoice insert:

1. Read `nextNumber` for this device series
2. Format `invoiceNumber` with series
3. Insert invoice
4. Increment `nextNumber`

A rollback must not consume a number.

### `sync_queue`

Drained by the mobile sync worker when cloud backup is enabled.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `entityType` | TEXT NOT NULL | `vendor \| customer \| product \| invoice \| gst_configuration` |
| `entityId` | TEXT NOT NULL | |
| `operation` | TEXT NOT NULL | `create \| update \| delete` |
| `payload` | TEXT NOT NULL | JSON snapshot of the entity (invoice includes items + payments) |
| `idempotencyKey` | TEXT NOT NULL | UUID; unique |
| `createdAt` | TEXT NOT NULL | |
| `retryCount` | INTEGER NOT NULL | Default `0` |
| `lastError` | TEXT | |
| `status` | TEXT NOT NULL | `pending \| in_flight \| synced \| failed \| conflict` |

Indexes:

- `sync_queue_status_createdAt` on `(status, createdAt)`
- `sync_queue_idempotencyKey` unique on `idempotencyKey`
- `sync_queue_entity` on `(entityType, entityId)`

Every local write (vendor, GST config, product, customer, invoice) inserts a queue row with a full snapshot in the same transaction.

### `audit_events`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `entityType` | TEXT NOT NULL | Typically `invoice` |
| `entityId` | TEXT NOT NULL | |
| `action` | TEXT NOT NULL | `finalized \| cancelled` |
| `payload` | TEXT | JSON context |
| `createdAt` | TEXT NOT NULL | |

Indexes:

- `audit_events_entity` on `(entityType, entityId, createdAt)`

---

## Snapshot shapes

### `invoices.customerSnapshot`

```json
{
  "name": "Walk-in",
  "phone": null,
  "gstin": null,
  "stateCode": "32"
}
```

For a registered customer, copy fields at finalize time. Later customer edits must not change historical invoices.

### `products.aliases`

```json
["rice", "ari"]
```

Regional names (for example Malayalam "ari") belong in this JSON array together with Latin aliases. Normalize on write.

### Invoice payload on `sync_queue`

One queue row per invoice `create` / `cancel`. Payload includes the invoice row, `invoice_items[]`, and `payments[]`.

---

## Invoice number format

```
{invoicePrefix}{seriesCode}/{financialYear}/{seq:5}
INVA/25-26/00001
```

Max 16 characters (GST Rule 46). Legacy numbers without a series letter are left unchanged. Financial year: 1 April – 31 March. On 1 April, insert a new `invoice_sequences` row for the device series; do not reset the previous year.

---

## PostgreSQL (cloud)

Same UUIDs as the phone. Additional tables:

### `Device`

`id` (phone UUID), `vendorId`, `userId`, `label`, `platform`, `appVersion`, `seriesCode`, `createdAt`, `lastSeenAt`, `lastSyncAt`, `revokedAt`. Unique `(vendorId, seriesCode)`.

### `RefreshToken`

`tokenHash`, `expiresAt`, `revokedAt`, `deviceId` (FK), `replacedById` (rotation / reuse detection).

### `serverVersion`

`BIGINT` from a shared Postgres sequence on `Vendor`, `GstConfiguration`, `Product`, `Customer`, and `Invoice`, set on every server write. Pull cursor is this value. Index `(vendorId, serverVersion)`.

Invoice uniqueness: `(vendorId, financialYear, invoiceNumber)` (series is part of the number).

---

## Inter-state rule

```
isInterState = customer.stateCode != null
  && customer.stateCode !== vendor.stateCode
```

Walk-in or missing customer state: `isInterState = false`, `placeOfSupplyStateCode = vendor.stateCode`.

---

## Drizzle notes (Phase 2)

- Use `drizzle-orm/expo-sqlite`.
- Generate migrations; do not hand-edit production DBs.
- Repositories own transactions. Screens never receive a raw `db` handle.
- Foreign keys: enable SQLite FK enforcement on connection (`PRAGMA foreign_keys = ON`).

Suggested repository surface:

```
VendorRepository.get() / upsert()
CustomerRepository.list() / get() / create() / update() / softDelete()
ProductRepository.listActive() / search() / create() / update() / softDelete()
InvoiceRepository.createDraft() / finalize() / getWithItems() / list() / cancel()
PaymentRepository.add()
SequenceRepository.allocate(vendorId, fy)   // called inside finalize txn
AuditRepository.append()
SyncQueueRepository.enqueue()               // same txn; worker later
```

`finalize()` signature (conceptual):

```
finalize(draft, totals, payments): Invoice
```

Runs `BEGIN` → allocate number → insert invoice + items + payments → audit → enqueue → `COMMIT`.

---

## Appendix — Future PostgreSQL

Implemented only with NestJS. Same UUIDs as client primary keys. No `serverId` mapping table.

Additional tables:

| Table | Purpose |
|---|---|
| `users` | Optional cloud identity: email/phone, `passwordHash`, `vendorId` |
| `refresh_tokens` | Hashed refresh tokens, expiry, device label |
| `idempotency_keys` | Unique `(vendorId, key)`, request hash, response snapshot |
| `files` | S3 key, entity type/id, content type, createdAt |

Mirrored business tables: `vendors`, `customers`, `products`, `invoices`, `invoice_items`, `payments`, `gst_configurations`.

Differences from SQLite:

- Native `TIMESTAMPTZ`, `BOOLEAN`, `JSONB` for snapshots/aliases/payloads
- Money still `BIGINT` paise
- Quantity still `BIGINT` milli-units
- Rates still `INTEGER` bps
- Soft delete + `updatedAt` for incremental pull
- Unique invoice number: `(vendor_id, financial_year, invoice_number)`

Prisma owns this schema when Phase 8 starts. Do not create `apps/backend` or a Prisma project in v1.

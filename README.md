# Invoice GST

**Offline-first GST billing for small shops in India.**

Clerks create tax-correct invoices on a phone without an account or internet. The shop’s catalogue, customers, and bills live in **SQLite on the device**. Optional cloud backup can sync the same shop across phones later — it is never required for day-to-day billing.

## Who it is for

Kirana and similar vendors who need:

- Fast new invoices (type or voice)
- Correct GST (CGST/SGST/IGST, inclusive/exclusive price, composition)
- A simple product and customer catalogue
- PDF share of a receipt-style bill
- Work that keeps going when the network is down

## What the product does

| Area | Capability |
|------|------------|
| **Shop** | Business profile, GSTIN, state, invoice series |
| **Catalogue** | Products (unit, price, GST, aliases, sold/hidden) and customers |
| **Billing** | Cart draft, discounts, walk-in or named customer, payment (paid / partial / unpaid) |
| **Voice** | Speak line items (OS speech). Hindi/Tamil can translate on-device to English for matching; Malayalam learns aliases from clerk picks |
| **History** | Past invoices, unpaid edit, park and resume open carts |
| **Output** | On-screen receipt paper and shareable PDF |
| **Backup** (optional) | Account + NestJS/Postgres sync across devices |

## How it is built

This is a **pnpm monorepo**:

- **`apps/mobile`** — Expo / React Native shop app (source of truth for billing)
- **`apps/backend`** — NestJS API + PostgreSQL for optional cloud backup
- **`packages/shared`** — GST math, billing-line parsing and product match
- **`packages/types`** / **`packages/validation`** — shared types and form schemas

Local data and the GST engine stay on the phone. The backend only supports backup and multi-device merge when you turn that on.

## Setup and docs

- **[SETUP.md](./SETUP.md)** — install and run from scratch  
- [User guide](docs/USER_GUIDE.md) · [Admin guide](docs/ADMIN_GUIDE.md) · [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Sync](docs/SYNC.md)

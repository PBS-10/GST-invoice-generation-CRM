# Development Roadmap

Incremental delivery for the offline-first GST billing app. Do not generate the entire application at once.

v1 is mobile-only and fully offline. NestJS, auth, sync, and ASR ship only when explicitly requested.

Related docs: [Architecture](./ARCHITECTURE.md) · [Data Model](./DATA_MODEL.md) · [Sync](./SYNC.md) · [ML Architecture](./ML_ARCHITECTURE.md)

## Working agreement

Before each major module, write a short note covering:

- What is being built and why
- Files that will be created or modified
- Database changes
- API changes (none in v1)
- Risks

Then implement.

After each module:

1. Lint
2. Typecheck
3. Tests
4. Fix failures
5. Review the change
6. Update the relevant doc

Screens stay thin. Business logic stays in services, repositories, and `packages/shared`.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Architecture docs, data model, sync/ML design, repo hygiene | Done |
| 1 | Expo app, pnpm monorepo, shared packages, TypeScript strict | Done |
| 2 | SQLite, Drizzle, schema, repositories, migrations | Done |
| 3 | Vendor, products, customers | Done |
| 4 | GST engine + unit tests | Done |
| 5 | Manual invoice, history, details | Done |
| 6 | PDF generation | Done |
| 7 | Thermal printer | Blocked on hardware SKU (`PrinterPort` stub + Detail Print CTA) |
| 8 | NestJS backend, auth, sync API | Done |
| 9 | Mobile sync worker, multi-device series, backup UI | Done |
| 12 | Typed billing lines matched to catalogue aliases | Done |
| 10 | `/ml` eval harness: WER, manifest, model runners | Done |
| 11 | Run IndicConformer vs Whisper and record WER | Not run |
| 13 | OS mic → existing extract/match (no custom ML) | Done |
| 14 | On-device ASR model (Sherpa / similar) | Deferred |
| 15 | Hardening (tests, docs, release checklist) | In progress |

---

## Phase 0 — Documentation (current)

**Why:** Lock architecture, schema, and boundaries before scaffolding.

**Deliverables:**

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/DATA_MODEL.md`
- `docs/SYNC.md`
- `docs/ML_ARCHITECTURE.md`
- Root `README.md`, `.gitignore`, `.env.example`

**Not in this phase:** Expo app, NestJS, Prisma, packages source, downloaded models.

---

## Phase 1 — Project setup

**Why:** Independently runnable mobile app and shareable TS packages. No backend package.

**Create:**

```
apps/mobile/                   # Expo + TypeScript
packages/types/
packages/validation/
packages/shared/
pnpm-workspace.yaml
package.json
```

**Do not create:** `apps/backend`, `apps/web`.

**Tooling:**

- pnpm workspaces
- Node 20 LTS
- TypeScript `strict` in every package
- Expo: current stable SDK at scaffold time
- Expo Go is fine until native modules (printer, later ASR)
- Production target: Expo + `expo-dev-client` when those modules appear
- Android-first

**Env:** `.env.example` stays empty of secrets. No required env vars for local billing.

**Risks:** Over-scaffolding unused Turbo/Nx. Only add Turborepo if two or more packages have real build/test scripts.

---

## Phase 2 — Local database

**Why:** SQLite is the source of truth. Every later feature reads and writes through repositories.

**Create:**

- `apps/mobile/src/database/schema/`
- `apps/mobile/src/database/client/`
- `apps/mobile/src/database/migrations/`
- `apps/mobile/src/database/repositories/`

**Stack:** Drizzle ORM + `expo-sqlite`. Pin versions known to work together.

**Schema:** Implement [DATA_MODEL.md](./DATA_MODEL.md) (SQLite section). Include `sync_queue` and `syncStatus` now. Do not implement a sync worker.

**Write path:** Single SQLite transaction per mutation. Set `syncStatus = pending`.

**Tests:** Repository tests against a temp SQLite file.

**Risks:** Drizzle / Expo SQLite driver mismatch; migration strategy on existing installs.

---

## Phase 3 — Vendor, products, customers

**Why:** Master data required before an invoice can be created.

**Vendor:** Local business profile, typically one row. GSTIN, address, `stateCode`, `gstRegistrationType`, `invoicePrefix`.

**Products:** Name, `localName`, `aliases` (JSON array), SKU, HSN, unit, price (paise), GST rate (bps), `priceInclusive`, `isActive`.

Aliases exist for later voice/NLP matching. Treat them as first-class data, not a leftover field.

**Customers:** Name, phone, email, address, GSTIN, `stateCode`, `customerType`. Walk-in invoices remain allowed (`customerId` nullable).

**UI:** Feature modules under `features/vendors`, `features/products`, `features/customers`. Zod schemas in `packages/validation`.

**DB changes:** None beyond Phase 2 tables.

**Risks:** Editing a product after invoices exist — invoices must keep snapshots, not live joins.

---

## Phase 4 — GST engine

**Why:** Tax math must be pure, decimal-safe, and tested before invoice UI exists.

**Create:** `packages/shared` GST module.

```ts
calculateInvoiceTotals(input): InvoiceTotals
```

**Cover in tests:**

- Inclusive and exclusive pricing
- Rates 0 / 5 / 12 / 18 / 28%
- Line and invoice discounts
- Intra-state (CGST+SGST) vs inter-state (IGST)
- Walk-in treated as intra-state
- Composition scheme (no tax split)
- Rounding modes (`nearest`, `up`, `down`)
- Multi-line mixed rates

**Must not:** Import React, SQLite, or network code.

**Risks:** Integer overflow is not a practical issue at invoice scale; off-by-one paise from inclusive back-out is. Tests must lock the rounding rule.

---

## Phase 5 — Manual invoice

**Why:** This is the product. Persist locally before any PDF, print, or future sync.

**Flow:**

```
Create draft (Redux)
  → optional customer or walk-in
  → add product + quantity
  → calculateInvoiceTotals()
  → preview
  → SQLite transaction
  → finalized
```

**Also:** Invoice history and invoice details.

**Rules:**

- Drafts are editable in Redux and/or `status = draft` rows.
- Finalize writes invoice + items + sequence + optional payments in one transaction.
- Finalized invoices are immutable.
- Cancel is a new operation (`status = cancelled`) plus an `audit_events` row.
- Invoice number: `{prefix}/{FY}/{seq}`, FY April–March.
- No HTTP on this path.

**DB changes:** Uses existing invoice, item, payment, sequence, audit tables.

**Risks:** Sequence gaps if finalize rolls back after increment — increment and insert must share the transaction.

---

## Phase 6 — PDF

**Why:** Shareable GST invoice without a printer.

**Create:** `services/pdf/generateInvoicePDF(invoice)`.

**Contents:** Business info, GSTIN, invoice number, date, customer snapshot, lines (HSN, qty, rate, GST), CGST/SGST or IGST, discount, total.

**Fonts:** Bundle an Indic TTF (e.g. Noto Sans Malayalam). Confirm license.

**Must not:** Live inside invoice screens.

**Risks:** Missing glyphs; large font binary size; pdf-lib + RN bundling.

---

## Phase 7 — Thermal printer

**Why:** Shop billing ends with a paper invoice.

**Blocked until:** Exact printer model and transport are known (Bluetooth Classic, BLE, USB, or LAN).

**Create:** `PrinterPort` with `connect`, `printInvoice`, `disconnect`. ESC/POS for 58mm / 80mm.

**Do not:** Pick `react-native-ble-plx` (or any transport library) before the hardware is identified. Do not couple printer code to invoice screens.

**Risks:** Classic SPP vs BLE; Expo Go cannot host Classic native modules; pairing and Android permissions.

---

## Phase 8+ 

Phase 8 is in `apps/backend`. The phone still does not call it. Typed catalogue matching is on the new-invoice screen. The speech comparison lives in `/ml` and has not been run yet. Do not put a microphone or a speech model in the app until that comparison is recorded.

### Phase 8 — NestJS backend

- `apps/backend` with Prisma + PostgreSQL
- Modules: auth, devices, invoices (service), sync, health
- JWT access + hashed refresh tokens bound to `Device`
- Recompute GST on sync push; do not trust the client
- Helmet, CORS allowlist, throttler, Zod env, Dockerfile

### Phase 9 — Offline synchronization (done)

- Drain `sync_queue` from the phone
- `POST /sync/push` and `POST /sync/pull` by `serverVersion`
- Per-device invoice series; Phone 2 restore
- Idempotency, retries/backoff, conflicts, soft deletes
- Tokens in Expo Secure Store only
- See [SYNC.md](./SYNC.md)

### Phase 10 — ASR research (`/ml`)

Harness is in the repo. It does not import the phone app, and the phone app does not import it.

- `ml/evaluation/wer.py` scores word error rate, including Malayalam tokens
- `ml/evaluation/score.py` prints overall and per-language WER from a hypothesis file
- `ml/asr/transcribe.py` runs Whisper or IndicConformer on a local manifest
- Weights are not downloaded unless the command includes `--allow-download`
- `ml/datasets/manifest.example.jsonl` is the file format. Audio is not committed. Place a small slice in `ml/datasets/raw/`

No training from scratch. Do not download IndicVoices, Kathbath, or Common Voice in full.

### Phase 11 — IndicConformer vs Whisper

Not run. After a small audio slice is on disk:

```
python ml/asr/transcribe.py --backend whisper --model tiny --manifest ml/datasets/manifest.example.jsonl --out ml/experiments/runs/whisper.jsonl --allow-download
python ml/asr/transcribe.py --backend indicconformer --manifest ml/datasets/manifest.example.jsonl --out ml/experiments/runs/indicconformer.jsonl --allow-download
python ml/evaluation/score.py --items ml/experiments/runs/whisper.jsonl
```

Fine-tune only if pretrained WER is insufficient.

### Phase 12 — NLP / product matching

Done for typed lines. New invoice → **Add in words** calls `extractBillingText` and `matchBillingLine` in `@invoice-gst/shared`, then adds the line to the on-device draft. A stated price is the amount for that quantity; “at” or “per” is the unit rate. Grams convert into a kilogram product. Unmatched or ambiguous names are not added.

Still deferred: accuracy metrics on a recorded set, and any model. No LLM.

### Phase 13 — Voice-to-invoice (OS STT)

Done without custom ML or backend:

- `expo-speech-recognition` + `expo-dev-client` (mic **not** available in Expo Go)
- `apps/mobile/src/features/voice` wraps the phone OS recognizer
- New invoice mic fills the billing text field; **Add to bill** still calls `extractBillingText` + `matchBillingLine`
- Locales: `en-IN`, `ml-IN`, `hi-IN`, `ta-IN`
- Invoice screens do not import Whisper or `/ml`

### Phase 14 — On-device ASR

- Sherpa-ONNX (or equivalent) only after eval justifies it
- Measure size, latency, and WER on low-end Android
- Replaces or supplements OS STT only if measured need exists

### Phase 15 — Hardening

Checklist for a shop-facing release:

- [x] Draft totals helpers covered (discount clamp, unpaid/partial/paid)
- [x] Printer boundary stubbed without picking a BLE stack early
- [x] User/admin docs match cloud backup, cart, unpaid edit, payment amounts
- [ ] Performance pass on a mid-range Android with a large catalogue
- [ ] Security review of auth tokens (Secure Store) and sync push validation
- [ ] Production API deploy (`DATABASE_URL`, `JWT_SECRET`, TLS, backups)
- [ ] Expo production / Play build with `EXPO_PUBLIC_API_URL` when backup is offered
- [ ] Unblock Phase 7 only after printer model + transport are chosen

---

## Suggested first implementation slice after Phase 0

When implementation is approved, start Phase 1, then Phase 2. Do not skip ahead to invoice UI or voice.

Phase 4 (GST engine + tests) can proceed in parallel with Phase 3 once `packages/shared` exists — it has no UI or SQLite dependency.

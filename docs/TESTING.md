# Testing

This project tests **business logic and rules** with Vitest. Most coverage is **unit tests**. A smaller set of tests exercise **integration-style rules** (multi-step policies, series allocation) without a full UI or device harness.

There is **no** automated screen / E2E suite (Detox, Maestro, Appium) yet. Device flows are verified manually (see [Manual QA](#manual-qa-not-automated)).

---

## Quick start

From the monorepo root (`Projects/invoice-gst`):

```bash
pnpm install
pnpm test          # all packages that define a test script
pnpm typecheck     # TypeScript across the workspace
```

Per package:

```bash
pnpm --filter @invoice-gst/shared test
pnpm --filter @invoice-gst/mobile test
pnpm --filter @invoice-gst/backend test
```

| Package | Runner | Config |
|---------|--------|--------|
| `@invoice-gst/shared` | Vitest | `packages/shared` |
| `@invoice-gst/mobile` | Vitest | `apps/mobile/vitest.config.ts` (`src/**/*.test.ts`) |
| `@invoice-gst/backend` | Vitest | `apps/backend` |

---

## Unit tests

**Unit tests** check one module or pure function in isolation: fixed inputs → expected outputs. No React Native UI, no real microphone, no live Postgres.

### Shared (`packages/shared`)

| File | What it unit-tests |
|------|--------------------|
| `tests/calculateInvoiceTotals.test.ts` | GST engine: line/invoice totals, inclusive vs exclusive, CGST/SGST/IGST, rounding |
| `tests/billingText.test.ts` | Parse typed/spoken lines; match products by name/alias; ambiguous, related, unit, qty failures |
| `tests/financialYear.test.ts` | Indian financial-year helpers |

These are the most important unit tests: tax and catalogue matching bugs are product bugs.

### Mobile (`apps/mobile`)

| File | What it unit-tests |
|------|--------------------|
| `src/features/voice/prepareBillingTranscript.test.ts` | Translate-then-match prep: skip EN/ML; HI when pack ready/missing; cache; errors |
| `src/utils/spokenAlias.test.ts` | Normalize/merge spoken aliases (dedupe, length, cap) |
| `src/services/invoice/draftTotals.test.ts` | Payment status (unpaid/partial/paid); discount clamp |
| `src/services/pdf/generateInvoicePDF.test.ts` | PDF generation helpers / output shape |
| `src/services/print/PrinterPort.test.ts` | Print stub behaviour (no hardware yet) |
| `src/services/sync/syncEngine.test.ts` | Outbox batch selection, backoff |
| `src/services/sync/restore.test.ts` | Post-login restore / replace decisions |
| `src/database/migrationPlan.test.ts` | Migration journal ordering and pending SQL |
| `src/database/repositories/cartRepository.test.ts` | Cart display title; max open carts constant |

Native modules (speech, ML Kit) are **mocked or soft-loaded** in unit tests so CI does not need a device.

### Backend (`apps/backend`)

| File | What it unit-tests |
|------|--------------------|
| `src/sync/policy.test.ts` | Sync conflict / win rules for entities and invoices |
| `src/auth/series.test.ts` | Device series code helpers |
| `src/gst/assertGstMatch.test.ts` | Server-side GST assertion helpers |

---

## Integration tests

**Integration tests** here mean: several collaborating rules or steps are checked together, still under Vitest. They are **not** full HTTP + Postgres E2E unless noted.

| File | Style | What it covers |
|------|--------|----------------|
| `apps/backend/src/auth/series.integration.test.ts` | Integration (rules) | Sequential device series allocation, no reuse of revoked codes, capacity of the series list |
| `apps/backend/src/sync/policy.test.ts` | Unit + multi-case policy | Client/server update ordering, unpaid invoice replace, duplicates — policy as a whole |
| `apps/mobile/.../restore.test.ts` | Decision integration | Combinations of “same shop / other shop / local data” → resume vs replace vs restore |
| `apps/mobile/.../migrationPlan.test.ts` | Plan integration | Journal + SQL file bundle → pending statement list |

### What we do *not* run as automated integration yet

- NestJS HTTP requests against a real Postgres container in CI  
- Expo app launch + SQLite on an emulator  
- Real OS speech recognition or on-device ML Kit downloads  

Those remain manual or future work.

---

## Naming conventions

| Pattern | Meaning |
|---------|---------|
| `*.test.ts` | Default Vitest unit (or small integration) file |
| `*.integration.test.ts` | Explicit multi-step / allocation-style integration suite |

Prefer testing **pure functions** in `packages/shared` and small service helpers. Keep UI screens thin so logic stays unit-testable.

---

## What each layer should own

```text
packages/shared     → unit: GST, money, billing text match
apps/mobile         → unit: voice prep, aliases, draft/sync/PDF helpers
apps/backend        → unit + light integration: sync policy, series
Device / human      → manual: screens, mic, ML Kit packs, release APK
```

---

## Manual QA (not automated)

Use a **development build** or release APK for voice (Expo Go is typed-only).

Suggested smoke checklist:

1. Shop profile → products → customers  
2. New invoice (typed + Add products) → payment → preview → PDF  
3. Park / resume cart; leave-draft sheet  
4. Voice EN / HI / TA / ML (packs in Settings for HI/TA)  
5. Resolve miss → alias learned → second utterance matches  
6. Optional: backup sign-in + sync  

Voice pack matrix: [`apps/mobile/README.md`](../apps/mobile/README.md).

---

## Adding new tests

1. Put logic in a testable function (shared or `src/...` helper).  
2. Add `something.test.ts` next to the code or under `tests/`.  
3. Run `pnpm --filter <package> test`.  
4. For multi-step backend rules, prefer `*.integration.test.ts` and document the scenario in the `describe` title.

**Do not** require a phone or network for unit tests. Mock native modules (same pattern as `prepareBillingTranscript.test.ts`).

---

## Related docs

- [SETUP.md](../SETUP.md) — install and run  
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system layout  
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — GST tests called out before tax-rule changes  
- [ML_ARCHITECTURE.md](./ML_ARCHITECTURE.md) — ASR eval scripts under `/ml` (separate from app Vitest)

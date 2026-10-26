# Setup from scratch

This guide gets **Invoice GST** running on a new machine: monorepo install, mobile app (offline billing), optional voice + on-device translate, and optional cloud backup API.

Workspace root: `Projects/invoice-gst` (this folder).

---

## 1. Prerequisites

| Tool | Version / notes |
|------|-----------------|
| **Node.js** | 22.x LTS recommended (20+ should work) |
| **pnpm** | `10.15.1` (matches `packageManager` in root `package.json`) |
| **Git** | Any recent version |
| **Android** (device build) | Android Studio, SDK, emulator or USB device; JDK 17 |
| **iOS** (Mac only) | Xcode + CocoaPods; physical device preferred for ML Kit |
| **Docker** (optional) | For local Postgres + API |

Install pnpm if needed:

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
```

---

## 2. Clone and install

```bash
cd /path/to/GST-Invoice-CRM/GST-invoice-generation/Projects/invoice-gst
pnpm install
```

This installs the whole workspace (`apps/*`, `packages/*`) including the local Expo module `billing-translate`.

Quick sanity check:

```bash
pnpm typecheck
pnpm test
```

---

## 3. Environment files

Copy examples (do **not** commit real `.env` files):

```bash
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/backend/.env.example apps/backend/.env
```

| File | Required for billing? | Purpose |
|------|----------------------|---------|
| `apps/mobile/.env` | No | `EXPO_PUBLIC_API_URL` — leave empty to hide cloud backup UI |
| `apps/backend/.env` | Only for API | `DATABASE_URL`, `JWT_SECRET` (≥ 32 chars), `PORT` |
| Root `.env` | No | Same keys documented for reference |

**Android emulator → API on your PC:**

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
```

**Physical phone on Wi‑Fi:**

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3000
```

---

## 4. Run the mobile app

Billing works **offline** on the phone. SQLite is the source of truth. No backend is required for day-to-day invoices.

### Option A — Expo Go (typed billing only)

Fastest for UI work. **Mic and on-device translate are not available.**

```bash
pnpm mobile:go
```

Scan the QR with Expo Go.

### Option B — Development build (voice + ML Kit) — recommended

Native modules (`expo-speech-recognition`, `billing-translate`, SQLite, etc.) need a custom binary.

**Android:**

```bash
pnpm mobile:android
# same as: pnpm --filter @invoice-gst/mobile android
```

**iOS (Mac):**

```bash
pnpm --filter @invoice-gst/mobile ios
```

After the native app is installed, start the Metro bundler with the **dev client**:

```bash
pnpm mobile
```

Open the installed “GST Invoice” app (not Expo Go).

### Voice language packs (after first native build)

1. In the app: **Settings → Voice language packs**
2. Download **Hindi** and/or **Tamil** (~30 MB each, Wi‑Fi preferred)
3. On **New Invoice**, pick **HI** / **TA** and speak

**Malayalam (`ML`)** has no ML Kit translate pack; matching uses spoken text and learns aliases when you resolve a product.

More detail: [`apps/mobile/README.md`](./apps/mobile/README.md).

### Web (optional)

```bash
pnpm mobile:web
```

---

## 5. Optional — cloud backup backend

Skip this section if you only need local billing.

### 5.1 Postgres

From `apps/backend`:

```bash
cd apps/backend
docker compose up -d postgres
```

Default URL (also in `.env.example`):

```text
postgresql://invoice:invoice@localhost:5432/invoice_gst
```

### 5.2 Prisma + Nest API

```bash
cd apps/backend   # if not already there
# ensure apps/backend/.env has DATABASE_URL and JWT_SECRET
pnpm --filter @invoice-gst/backend prisma:generate
pnpm --filter @invoice-gst/backend exec prisma migrate deploy
# or during development: prisma migrate dev
pnpm backend
# same as: pnpm --filter @invoice-gst/backend start:dev
```

API listens on `http://localhost:3000` by default.

Full stack with Docker (Postgres + API image):

```bash
cd apps/backend
docker compose up --build
```

### 5.3 Point the mobile app at the API

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`, restart Metro (`pnpm mobile`), then use **Settings → Backup & devices** (or the Home banner) to create/sign in to an account.

### 5.4 Seed catalogue for one shop (optional)

After that shop has registered:

```bash
pnpm --filter @invoice-gst/backend seed:products
# non-interactive:
pnpm --filter @invoice-gst/backend seed:products -- --email shop@example.com --password 'secret'
```

Pull sync on a signed-in phone downloads those products for that shop only.

---

## 6. Monorepo map

```text
invoice-gst/
├── apps/mobile/          Expo React Native shop app (SQLite, voice, PDF)
│   └── modules/billing-translate/   On-device ML Kit (HI/TA → EN)
├── apps/backend/         NestJS + Prisma + Postgres (optional backup)
├── packages/shared/      GST math, billing text match
├── packages/types/       Shared TypeScript types
├── packages/validation/  Zod form schemas
└── docs/                 Architecture, sync, user/admin guides
```

Root scripts:

| Command | What it does |
|---------|----------------|
| `pnpm install` | Install all workspace packages |
| `pnpm test` | Run package tests |
| `pnpm typecheck` | Typecheck all packages that define it |
| `pnpm mobile` | Expo start (dev client) |
| `pnpm mobile:go` | Expo Go |
| `pnpm mobile:android` | Native Android build + run |
| `pnpm mobile:web` | Expo web |
| `pnpm backend` | Nest API in watch mode |

---

## 7. First-run checklist (shop)

1. Open the app → set **Shop profile** (name, state, GST type).
2. Add a few **Products** (name, unit, price, GST %).
3. **New Invoice** → add lines (type or voice) → preview → save/share.
4. (Optional) Download voice packs; try HI/TA speech.
5. (Optional) Enable backup and sign in.

Product docs: [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md).

---

## 8. Common issues

| Problem | Fix |
|---------|-----|
| Mic / translate missing | Use a **dev client** build (`pnpm mobile:android` / `ios`), not Expo Go; then `pnpm mobile`. |
| `billing-translate` Kotlin build error | Rebuild after pulling latest module code; clean if needed: `cd apps/mobile/android && ./gradlew clean`. |
| Android can’t reach API | Use `10.0.2.2` for emulator, or your PC’s LAN IP for a real device; allow firewall on port 3000. |
| `JWT_SECRET` too short | Use at least 32 characters in `apps/backend/.env`. |
| Postgres connection refused | `docker compose up -d postgres` in `apps/backend`; check `DATABASE_URL`. |
| Metro / cache weirdness | `pnpm --filter @invoice-gst/mobile exec expo start -c` |
| iOS ML Kit | Prefer a **physical device**; simulator often lacks ML Kit slices. |

---

## 9. Related docs

- [`README.md`](./README.md) — project overview
- [`apps/mobile/README.md`](./apps/mobile/README.md) — voice translate packs
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/ADMIN_GUIDE.md`](./docs/ADMIN_GUIDE.md) — deploy / env / sync API
- [`docs/SYNC.md`](./docs/SYNC.md)

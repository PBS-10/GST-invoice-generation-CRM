# GST Invoice — Complete Project Summary

This document is a full overview of the **GST Invoice** project: what it is, how it is built from the bottom up, how every major feature works, and how to run and use it.

---

## 1. What this project is

**GST Invoice** is an offline-first billing app for small shops in India (kirana and similar).

- Create GST-correct invoices on a phone **without an account and without internet**.
- Keep products, customers, and bills in a **local SQLite database** on the device.
- Optionally back up to the cloud and use more than one phone for the same shop.
- Add lines by typing, picking products, or **voice** (phone speech recognition).

App display name on the phone: **GST Invoice**.  
Android package id (current): `com.anonymous.invoicegst`.

---

## 2. Who it is for

| Role | What they need |
|------|----------------|
| Shop owner / clerk | Fast bills, correct tax, catalogue, PDF share, works offline |
| Developer / operator | Monorepo: mobile app + optional NestJS/Postgres backup API |

---

## 3. What is in scope vs not

### Included today

- Shop profile (name, GSTIN, state, invoice prefix, GST registration type)
- Products (price, unit, GST %, inclusive/exclusive, aliases, sold/hidden)
- Customers (walk-in or saved; B2C / B2B / unregistered)
- New invoice cart, park/resume carts, leave-draft prompts
- Typed “add in words”, product picker, voice billing
- Hindi/Tamil on-device translate for matching; Malayalam learns aliases
- Discount, unpaid / partial / paid payment
- Invoice history, unpaid edit, cancel
- Receipt-style preview and PDF share
- Optional cloud backup and multi-device series
- Theme: system / light / dark
- Automated unit (and light integration) tests with Vitest

### Not included yet

- Working thermal printer (Print is a stub; share PDF instead)
- Custom on-device ASR models (Whisper etc.)
- e-invoice (IRN) / e-way bill
- Password reset by email
- Credit notes / GSTR filing UI
- Automated UI / E2E device tests

---

## 4. Architecture (bottom → top)

Think of the system as layers. Billing never depends on the network.

```
┌─────────────────────────────────────────────────────────┐
│  Screens (tabs + stacks) — React Native / Expo          │
│  Home · Invoices · Products · Customers · Settings      │
│  New invoice · Preview · Detail · Forms · Backup        │
├─────────────────────────────────────────────────────────┤
│  UI state — Redux (invoice draft cart only)             │
├─────────────────────────────────────────────────────────┤
│  Services / use-cases                                   │
│  Cart session · draft totals · PDF · sync · voice prep  │
├─────────────────────────────────────────────────────────┤
│  Shared business logic                                  │
│  GST engine · billing text parse/match · money (paise)  │
├─────────────────────────────────────────────────────────┤
│  Persistence — SQLite + Drizzle on device               │
│  Vendor · products · customers · invoices · carts       │
│  sync_queue / app_meta for optional backup              │
├─────────────────────────────────────────────────────────┤
│  Native (dev / release build)                           │
│  Mic (OS speech) · ML Kit translate (HI/TA) · Secure    │
│  store · background task hooks                          │
└─────────────────────────────────────────────────────────┘
         optional online path (not required for billing)
┌─────────────────────────────────────────────────────────┐
│  NestJS API + PostgreSQL — cloud backup / multi-device  │
└─────────────────────────────────────────────────────────┘
```

### Design rules that matter

1. **SQLite is the source of truth** for shop data. Redux only holds the unsaved invoice draft.
2. **Money is integer paise**; quantity is milli-units; GST rates are basis points. No float tax math.
3. **Invoice lines are snapshots**. Changing a product later does not rewrite old bills.
4. **Paid** finalized invoices are locked. **Unpaid / partial** can be edited in place (same number). Corrections for paid bills: cancel + new invoice.
5. Local IDs are UUIDs so records can be created offline.
6. Mutations that matter for backup are marked pending for sync when cloud is enabled.

### Monorepo layout (conceptual)

| Part | Role |
|------|------|
| Mobile app | Expo / React Native shop app (main product) |
| Shared package | GST totals, parse/match billing lines, money helpers |
| Types / validation | Shared TypeScript types and Zod form rules |
| Backend | NestJS + Prisma + Postgres for optional backup |
| Local native module | On-device ML Kit translate (Hindi / Tamil → English) |

---

## 5. How GST is calculated (for users and builders)

| Situation | Tax on the invoice |
|-----------|-------------------|
| Shop and customer in the **same** state | CGST + SGST (half each) |
| Customer in a **different** state | IGST only |
| Walk-in, or customer has no state | Treated as same state as the shop |
| Shop GST type is **composition** | No CGST/SGST/IGST split (Bill of Supply style) |

- **Exclusive** price: tax is added on top of the selling price.  
- **Inclusive** price: tax is backed out of the line total.  
- Totals use shop rounding (default: nearest rupee).

**Example (exclusive, same state):** Rice ₹50/kg, 5% GST, qty 2 kg → taxable ₹100, CGST ₹2.50, SGST ₹2.50, total ₹105.

---

## 6. Invoice numbers

Format:

```text
{prefix}{deviceSeries}/{financial-year}/{sequence}
```

Examples: `INV/25-26/000001` on a single phone, or `INVA/25-26/00001` / `INVB/...` when two phones share one cloud shop.

- Financial year: **1 April – 31 March** (Indian FY), shown like `25-26`.
- Sequence advances when an invoice is successfully saved.
- Prefix comes from Shop profile.
- Device series letters are assigned when multi-device backup is used so numbers do not clash.

---

## 7. Status meanings

| Invoice status | Meaning |
|----------------|---------|
| finalized | Saved bill |
| cancelled | Voided; not a sale |

| Payment status | Meaning |
|----------------|---------|
| unpaid | No payment recorded |
| partial | Amount received &lt; total |
| paid | Full amount recorded |

---

## 8. Screens and navigation

### Bottom tabs

| Tab | Purpose |
|-----|---------|
| **Home** | Today’s sales summary, shortcuts (new invoice, product, customer), parked bills hint, backup banner when configured |
| **Invoices** | List of saved invoices; open one or start new |
| **Products** | Catalogue list; add/edit products |
| **Customers** | Customer list; add/edit (walk-in does not need a row) |
| **Settings** | Shop profile, backup & devices, appearance (theme), voice language packs |

### Stack screens

| Screen | Purpose |
|--------|---------|
| New invoice | Customer, lines, Add / voice, park, go to review |
| Parked bills | Resume or discard held carts |
| Review invoice | Discount, payment, GST totals, save / update |
| Invoice detail | View bill; edit items if unpaid; cancel; share PDF |
| Product form | Create or edit one product |
| Customer form | Create or edit one customer |
| Shop profile | Business identity and GST settings |
| Create account / Sign in / Backup & devices | Optional cloud |

---

## 9. How to use each feature

### 9.1 First launch

On first open the app creates a local ledger and a starter shop (example: “My Shop”, Kerala, regular GST, prefix `INV`, sample Rice product).  
**Update Shop profile before real sales.**

### 9.2 Shop profile (Settings → Shop profile)

1. Enter **Business name** (required). Optional: trade name, GSTIN, phone, email, address, city, PIN.  
2. Select **State** (drives intra- vs inter-state tax).  
3. Set **Invoice prefix** (short alphanumeric).  
4. Choose **GST registration**: regular / composition / unregistered.  
5. Save.

GSTIN, if filled, must be a valid 15-character GSTIN. Changing shop details later does **not** rewrite old invoice snapshots (PDF header may show current shop details).

### 9.3 Products (Products tab)

1. Add product.  
2. Fill fields:

| Field | Required | Notes |
|-------|----------|--------|
| Name | Yes | e.g. Rice |
| Local name | No | Printed under name; e.g. അരി |
| Search aliases | No | Comma list: `rice, ari, അരി` — used for type/voice match |
| Selling price | Yes | Per unit, up to 2 decimals |
| GST included / extra | Yes | Inclusive vs exclusive |
| GST rate | Yes | 0 / 5 / 12 / 18 / 28 % |
| Sold by (unit) | Yes | kg, g, l, ml, pcs, packet, other |
| Sold in shop | Yes | Off = hidden from new bills; history kept |
| HSN / SKU | No | Codes for B2B / internal use |

3. Save. Edit from the list anytime. Price/GST changes apply only to **new** bills.

### 9.4 Customers (Customers tab)

Walk-in sales need no customer record.

1. Add customer → name required; optional phone, email, address, GSTIN, state, type (consumer / business / unregistered).  
2. Use a saved customer when you need their details on the bill or another state (IGST).  
3. On New invoice, Bill-to can **search by name or phone**.

### 9.5 New invoice (main sale flow)

1. Home or Invoices → **New invoice**.  
2. Choose **Walk-in** or a customer.  
3. Add lines:
   - **Add products** — search catalogue, set quantity.  
   - **Type / voice** — lines like `2 kg rice 100 rupees` or spoken equivalent.  
4. Adjust quantities; remove lines if needed.  
5. Empty cart (₹0 / no lines) cannot park or save.  
6. Open **Review** when there is at least one line.  
7. On Review: optional discount/notes; then:
   - Save as **unpaid**, or  
   - **Payment** → cash / UPI / card; for cash enter amount given (change or still due); confirm paid or partial.

### 9.6 Park a bill

If another customer needs a quick bill while one cart is open:

1. **Park** — current cart is held (up to 8 on this phone).  
2. Finish the other sale.  
3. Resume from Home “parked bills” or Parked bills screen.

Parked carts are **local only** (not cloud).

### 9.7 Leave New Invoice (back)

If the cart has items (or you are editing an unpaid invoice), back asks what to do: save / park / discard / cancel depending on mode. Empty carts leave quietly.

### 9.8 History and corrections

- **Invoices** tab: newest first.  
- Open a bill: lines, tax, total, payment.  
- **Share PDF**.  
- **Print**: not wired to hardware yet — use PDF.  
- **Unpaid / partial**: Edit items → cart → Review → Update (same invoice number).  
- **Paid**: locked; cancel and create a new bill to correct.  
- **Cancel invoice**: voids the bill; number is not reused.

### 9.9 Voice billing

Needs a **development build or release APK** (not Expo Go).

1. On New invoice open the mic / voice sheet.  
2. Pick language chip:

| Chip | Behaviour |
|------|-----------|
| **EN** | English speech; match English names/aliases |
| **HI** | Hindi speech; if Hindi pack downloaded, translate to English then match |
| **TA** | Tamil speech; same with Tamil pack |
| **ML** | Malayalam speech; **no** ML Kit translate — match spoken text; **learn aliases** when you resolve a miss |

3. Speak continuously; finals are matched into the cart.  
4. If ambiguous / related / wrong unit / no match → resolve sheet → pick product (and qty if needed) → confirm.  
5. On confirm, the **spoken phrase is saved as a product alias** so the next time can match automatically (especially important for Malayalam).

**Voice language packs (Settings → Voice):**

- Download **Hindi** and/or **Tamil** (~30 MB each, Wi‑Fi preferred).  
- After download, translation works offline.  
- Without the pack, HI/TA still bill on spoken text + resolve/alias.  
- Malayalam has no pack in Settings.

### 9.10 Typed “add in words”

Same matching engine as voice, without the mic. Examples:

- `2 kg rice 100` — line total ₹100 for 2 kg  
- `rice at 50 per kg` — unit rate style  
- Malayalam/Hindi unit words are supported in the parser where implemented  

### 9.11 Appearance

Settings → Theme: **System / Light / Dark**.

### 9.12 Cloud backup (optional)

Only visible when the app is built with an API base URL configured.

1. Create account (email + password) while online → uploads this shop.  
2. Same phone sign-in again → resumes backup; does not wipe local data.  
3. Second phone / different shop → confirm **replace** to restore cloud shop; gets another invoice series letter.  
4. Backup & devices: last backup, device list, sign out, remove device.  
5. If backup is paused (session expired / device removed), local bills stay; sign in again to resume.

Uninstalling the app deletes the local ledger unless you restore from cloud later.

---

## 10. How developers run the project

### Prerequisites

- Node.js 20+ (22 LTS recommended)  
- pnpm 10.x  
- For native Android: Android Studio, SDK, JDK 17, emulator or phone  
- For iOS: Mac, Xcode (physical device preferred for ML Kit)  
- Optional: Docker for Postgres  

### Install

```bash
pnpm install
pnpm typecheck
pnpm test
```

### Environment (optional for billing)

- Mobile: `EXPO_PUBLIC_API_URL` — leave empty to hide backup UI.  
  - Android emulator → host: `http://10.0.2.2:3000`  
  - Physical phone: `http://YOUR_LAN_IP:3000`  
- Backend: `DATABASE_URL`, `JWT_SECRET` (≥ 32 chars), `PORT`

### Run mobile

| Goal | Command (from monorepo root) |
|------|------------------------------|
| Expo Go (typed only, no mic/translate) | `pnpm mobile:go` |
| Dev client + Android build | `pnpm mobile:android` |
| Start Metro for installed dev client | `pnpm mobile` |
| Web | `pnpm mobile:web` |

Always target the **mobile package** (root scripts `mobile:*`). Do not run bare `expo` only at the monorepo root or the bundler looks for the wrong `App` entry.

### Windows note

Native CMake builds can fail if the project path is longer than ~260 characters. Keep the repo under a short path (e.g. `C:\gst\`).

### Optional backend

```bash
# Postgres then API
pnpm backend
```

Seed products for one registered shop (when using backup):

```bash
pnpm --filter @invoice-gst/backend seed:products
```

### Release APK

```bash
cd apps/mobile/android
./gradlew assembleRelease    # Windows: gradlew.bat assembleRelease
```

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

Notes:

- Release currently may use debug signing until a production keystore is configured.  
- If minify/R8 is enabled, WorkManager-related startup crashes can occur unless keep rules are added or minify is turned off for internal builds.  
- Uninstall old app before testing a new APK so the icon and native bits refresh.

---

## 11. Testing overview

### Automated (Vitest)

- **Unit tests**: GST engine, billing text match, voice translate prep, spoken aliases, draft payment/discount, PDF helpers, sync helpers, migrations, cart helpers, backend sync policy and series helpers.  
- **Light integration**: multi-step series allocation and restore decision combinations.  
- Run: `pnpm test`  
- No full UI/E2E automation yet.

### Manual smoke checklist

1. Shop profile → products → customers  
2. New invoice typed + Add products → payment → PDF  
3. Park / resume; leave-draft sheet  
4. Voice EN / HI / TA / ML (download HI/TA packs for translate)  
5. Resolve miss → alias → second utterance matches  
6. Optional backup sign-in  
7. Release APK opens and bills offline  

---

## 12. Data and privacy

- Business data lives in SQLite on the phone.  
- No account required for billing.  
- Backup tokens (if used) sit in the phone secure store.  
- Uninstall without cloud backup **deletes** the local ledger.

---

## 13. Common problems and fixes

| Problem | What to do |
|---------|------------|
| Preview / save disabled | Add at least one product line |
| Cannot park empty cart | Add items first |
| Invalid GSTIN / price | Fix format or leave GSTIN blank; price max 2 decimals |
| IGST instead of CGST+SGST | Customer state ≠ shop state — change customer or use Walk-in |
| Composition shop “missing” tax split | Expected — composition does not split GST that way |
| Old invoice shows old price | Expected — line snapshots |
| Mic / translate missing | Use a native/dev or release build, not Expo Go |
| HI/TA not matching English names | Download voice pack in Settings, or resolve once to teach alias |
| Malayalam never auto-translates | Expected — use resolve to learn aliases or set local name/aliases |
| Unable to resolve `../../App` | Start Expo via `pnpm mobile` / `pnpm mobile:android`, not `expo` at repo root |
| Android path longer than 260 chars | Move project to a short folder path |
| Release APK opens then closes | Often R8/minify + WorkManager — check logcat; disable minify or add keep rules |
| Backup paused | Sign in again; local bills remain |
| Sign-in asks to replace data | Only confirm if this phone should become the cloud shop |

---

## 14. Typical daily workflow

```text
First day
  Settings → Shop profile → save
  Products → build catalogue (aliases / local names help voice)
  Optional: Settings → Voice → download Hindi/Tamil packs
  Optional: Customers for B2B buyers

Each sale
  New invoice
    → Walk-in or customer
    → Add products and/or speak/type lines
    → resolve any voice miss (teaches aliases)
    → Review → pay or leave unpaid → save
    → Share PDF if needed

Busy counter
  Park current bill → serve quick customer → resume parked bill

Mistake on unpaid bill
  Open invoice → Edit items → Review → Update

Mistake on paid bill
  Cancel → New invoice
```

---

## 15. One-line summary

**GST Invoice** is a phone-first, offline GST billing system: local SQLite + shared tax/match engine + Expo UI, with optional voice (OS STT + HI/TA on-device translate + Malayalam alias learning) and optional cloud backup — network is never required to sell.

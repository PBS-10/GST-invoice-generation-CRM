# GST Invoice — User Guide

This guide is for shopkeepers and staff who create GST invoices on the **GST Invoice** mobile app.

Billing never needs an account or internet. Everything is saved on the phone. Optional cloud backup keeps a copy and lets another phone restore the shop.

Related docs: [Admin Guide](./ADMIN_GUIDE.md) · [Architecture](./ARCHITECTURE.md) · [Sync](./SYNC.md)

---

## 1. What the app does

GST Invoice is offline-first billing for a small shop:

- Set up the shop profile (name, GSTIN, state, invoice prefix)
- Maintain a product catalog with HSN and GST rate
- Keep a customer list (or bill walk-in buyers)
- Create a GST invoice, preview tax, and save it on the device
- Open past invoices, share a PDF, and cancel a wrong one
- Optional: create a backup account, sync to the cloud, and restore on another phone

**Not in this version yet**

- Working thermal printer (Print button is present; needs a shop printer model)
- Custom on-device speech models (Whisper / similar)
- e-invoice (IRN) or e-way bill
- Password reset by email
- Credit notes / GST return filing

Voice billing uses the **phone’s built-in speech recognition** on a development build. Expo Go still supports typing a billing line.

---

## 2. First launch

On first open the app creates a local ledger and seeds a starter shop:

| Item | Starter value |
|---|---|
| Shop name | My Shop |
| State | Kerala (`32`) |
| GST type | Regular |
| Invoice prefix | `INV` |
| Sample product | Rice (Ari) — ₹50.00 / kg, 5% GST, exclusive |

Open **Settings → Shop profile** and update your business details before you bill real customers.

---

## 3. Screens

The bottom tabs are:

| Tab | What you do there |
|---|---|
| **Home** | Today’s sales, invoice count, shortcuts to a new invoice or a new product |
| **Invoices** | All saved invoices. Open one or start a new one |
| **Products** | Catalog. Add or edit products |
| **Customers** | Saved buyers. Walk-in billing works without this list |
| **Settings** | Hub for shop profile, backup & devices, and appearance |

Stack screens (opened from those tabs):

| Screen | Purpose |
|---|---|
| New invoice (cart) | Customer, cart lines, Add / voice, Park, Review |
| Parked bills | Resume or discard held carts |
| Preview | Discount, payment, GST totals, save invoice |
| Invoice | View a saved invoice; edit items if unpaid; cancel if finalized |
| Product | Create or edit one product |
| Customer | Create or edit one customer |
| Shop profile | Business name, GSTIN, state, invoice prefix, contact, address |
| Backup & devices | Optional cloud account and other phones |

---

## 4. Daily workflows

### 4.1 Set up the shop (do this first)

1. Open **Settings → Shop profile**.
2. Enter **Business name** (required). Optional: trade name, GSTIN, phone, email, address, city, PIN.
3. Select **State**. This decides intra-state vs inter-state GST.
4. Set **Invoice prefix** (1–3 letters/numbers, e.g. `INV`). Numbers look like `INVA/25-26/00001`.
5. Choose **GST registration**:
   - **regular** — CGST + SGST (same state) or IGST (other state)
   - **composition** — no CGST/SGST/IGST split (Bill of Supply style totals)
   - **unregistered** — treat like a regular shop for tax math unless you later change GST config
6. Tap **Save changes**.

GSTIN, if entered, must be a valid 15-character GSTIN.

Changing the shop name or GSTIN later does **not** rewrite old invoices. Those keep the values that were saved at the time.

### 4.2 Add a product

1. Open **Products** → **Add product**, or Home → **Add product**.
2. Fill the form:

| Field | Required | Notes |
|---|---|---|
| Name | Yes | Billing name, e.g. `Rice` |
| Local name | No | Display name, e.g. `Ari` |
| Aliases | No | Comma-separated: `rice, ari`. Used when you type a line on a new invoice |
| SKU | No | Your item code |
| HSN | No | HSN/SAC, e.g. `1006` |
| Price (₹) | Yes | Rupees with up to 2 decimals |
| Unit | Yes | `kg`, `g`, `l`, `ml`, `pcs`, `packet`, `other` |
| GST % | Yes | `0`, `5`, `12`, `18`, or `28` |
| exclusive / inclusive | Yes | Exclusive = tax added on top. Inclusive = tax already in the price |
| Sold in shop | Yes | Off = inactive. Hidden from Add products; still visible (dimmed) in Products. Old bills keep the snapshot |

3. Tap **Save product**.

Tap a product in the list to edit it. Price or GST changes apply only to **new** invoices. Old invoices keep the old price and tax. Turn off **Sold in shop** to stop offering an item on new bills without deleting history.

### 4.3 Add a customer

Walk-in sales do not need a customer record.

1. Open **Customers** → **Add customer**.
2. Enter **Name** (required). Optional: phone, email, address, city, PIN, GSTIN.
3. Select **State** if the buyer is in another GST state. If you leave it empty, the app treats the sale as **same state as the shop**.
4. Tap **Save customer**.

Use a saved customer when:

- You need their name / GSTIN on the invoice
- They are in another state (IGST instead of CGST+SGST)

### 4.4 Create an invoice (cart)

1. Home or Invoices → **New invoice** (opens a cart).
2. Tap the customer chip for **Walk-in** or a saved customer.
3. Add lines:
   - **Add** — search and tap products from the catalogue.
   - **Mic** — type or speak a line like `2 kg rice 100 rupees`, then **Add to cart**. Voice needs a development build; typing works everywhere.
4. Change quantities on each line; remove a line if needed.
5. Tap **Review** (needs at least one line). On Preview set optional discount/notes, then:
   - **Save invoice** — stores the bill as **unpaid**.
   - **Payment** — opens a sheet to pick cash / UPI / card. For **cash**, enter amount given; the app shows **change to return** (or still due if short). Confirm to save as **paid** or **partial**.

The invoice is finalized immediately and gets a number.

**Unpaid / part-paid invoices:** open the invoice → **Edit items** to load it into a cart, add or remove products, then **Review → Update invoice**. The invoice number stays the same. Fully **paid** invoices stay locked — cancel and create a new bill instead.

### 4.4.1 Park a bill (serve another customer)

If a long bill is in progress and another customer needs a quick invoice:

1. Tap **Park** — the current cart is saved on this phone and a new empty cart opens.
2. Finish the second customer (Review → Save).
3. Home shows **N parked bills**, or open **Carts** from the cart screen → resume the first cart and keep adding.

Parked carts stay on this phone only (not cloud backup). You can hold up to 8 at once.

### 4.5 View invoices

- **Invoices** lists newest first: number, customer, status, total.
- Tap a row to open details: lines, taxable, CGST/SGST/IGST, total, payment status.
- Tap **Share PDF** to download or share a PDF of that invoice. On a phone this opens the system share sheet. In the browser it downloads the file.
- **Print** is shown for a future counter printer. Until a printer model is configured, the app asks you to share the PDF instead.
- The PDF uses the **current** shop profile (name, GSTIN, address) together with the saved invoice lines. Changing the shop later does not change stored totals, but the next PDF shows the updated shop details.
- Home shows **today’s finalized total** and how many non-cancelled invoices are in the ledger.

### 4.6 Cancel an invoice

1. Open the invoice.
2. If status is **finalized**, tap **Cancel invoice**.
3. Status becomes **cancelled**. The number is not reused.

You cannot cancel an invoice that is already cancelled. Paid finalized invoices cannot be edited; unpaid ones can via **Edit items**.

---

## 5. How GST is decided (for users)

| Situation | Tax on the invoice |
|---|---|
| Shop and customer in the same state | CGST + SGST (half each) |
| Customer in a different state | IGST only |
| Walk-in, or customer has no state | Treated as same state as the shop |
| Shop GST type is **composition** | No CGST/SGST/IGST split |

**Exclusive price example:** Rice ₹50.00 / kg, 5% GST, qty 2 → taxable ₹100.00, CGST ₹2.50, SGST ₹2.50, total ₹105.00 (same state).

**Inclusive price:** the selling price already includes GST. The app backs tax out of the line.

Invoice totals are rounded to the nearest rupee using the shop GST setting (default: nearest rupee).

---

## 6. Invoice numbers

Format:

```
{prefix}/{financial-year}/{sequence}
INV/25-26/000001
```

- Financial year is **1 April – 31 March** (Indian FY), shown as `25-26`.
- Sequence starts at `000001` each FY and only advances when an invoice is successfully saved.
- Prefix comes from **Settings → Shop profile**.

---

## 7. Status meanings

| Invoice status | Meaning |
|---|---|
| finalized | Saved (paid bills are locked; unpaid/part-paid can edit items) |
| cancelled | Voided; do not treat as a sale |

| Payment status | Meaning |
|---|---|
| paid | Full amount recorded (Preview default) |
| unpaid | Payment received turned off |
| partial | Amount received is less than the bill total |

---

## 8. Backup, restore, and devices

Cloud backup appears only when the app is built with an API URL. Billing still works if it is not.

1. **Protect your shop data** — Home banner when you have no account. Tap to create one (email + password) while online.
2. **Create account (Phone 1)** — Uploads this shop’s data. This phone keeps series **A** on invoice numbers (for example `INVA/25-26/00001`).
3. **Sign in again on the same phone** — Backup resumes and uploads anything you added while signed out (products, customers, bills). Data is not wiped.
4. **Sign in (Phone 2 / another shop)** — If this phone’s shop is different from the cloud account, the app asks to **replace this phone’s data**. After restore, Phone 2 gets series **B** so both phones can bill at once without clashing numbers.
5. **Backup & devices** — Settings → Backup & devices: see last backup, list phones, sign out this phone, or remove another device. Shop details stay under Settings → Shop profile.
6. **Backup paused** — If the session expired or a device was removed, Home says backup is paused. Bills on the phone stay safe; tap to sign in again.

Uninstalling the app still deletes the local ledger. Sign in on a new phone to restore from the cloud when backup was enabled.

## 9. Data and privacy

- All data lives in a SQLite file on the device (`invoice-gst.db`).
- No account is required for billing. Internet is only needed for optional backup.
- Tokens for backup (when used) are stored in the phone’s secure store, not in SQLite.
- Uninstalling without a cloud account **deletes** the ledger.

---

## 10. Common problems

| Problem | What to do |
|---|---|
| Preview is disabled | Add at least one product line |
| “Check shop profile” / invalid GSTIN | Fix GSTIN format or leave it blank |
| “Check product” / invalid price | Use digits and at most two decimals (`50` or `50.50`) |
| Tax looks like IGST instead of CGST+SGST | Customer state differs from shop state. Change customer state or use Walk-in |
| Composition shop still expected tax split | Composition shops do not split GST. Switch Settings → Shop profile → GST registration if that is wrong |
| Old invoice has the old price | That is expected. Line items are snapshots |
| Need to correct a saved invoice | Cancel it, then create a new one |
| Backup paused | Tap the Home banner and sign in again. Local bills are unchanged |
| Sign in asks to replace data | Only continue if this phone should become a copy of the cloud shop |

---

## 11. User workflow map

```
First day
  Settings → Shop profile → save
  Products → add catalog
  Customers → add regular B2B buyers (optional)

Each sale
  New invoice
    → Walk-in or customer
    → add products + quantity
    → optional discount
    → Preview
    → Save to this device
    → Invoice details
    → Share PDF

Mistake
  Invoice details → Cancel invoice → New invoice
```

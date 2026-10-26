import { parseInvoiceSequence } from '@invoice-gst/shared';
import type { AppDatabase } from '../../database/client';
import type { Repositories } from '../../database/repositories';
import {
  auditEvents,
  customers,
  gstConfigurations,
  invoiceItems,
  invoiceSequences,
  invoices,
  payments,
  products,
  syncQueue,
  vendors,
} from '../../database/schema';
import { createId } from '../../utils/id';
import { runSync } from './syncEngine';

export { choosePostLoginAction, type PostLoginAction } from './postLogin';

type SyncDeps = {
  db: AppDatabase;
  repos: Repositories;
};

/** Resume backup after signing back into the same shop — never clears local data. */
export async function resumeBackupAfterLogin(deps: SyncDeps): Promise<void> {
  await runSync(deps);
}

/**
 * Replace local shop data with a full cloud pull (Phone 2 / different shop).
 * Pass `force: true` after the user confirms replace so a pending outbox can be wiped.
 */
export async function restoreFromCloud(
  deps: SyncDeps,
  options: { force?: boolean } = {},
): Promise<void> {
  const pending = await deps.repos.syncQueue.pendingCount();
  if (pending > 0 && !options.force) {
    throw new Error(
      'This phone has changes that are not backed up yet. Confirm replace before restoring from cloud.',
    );
  }
  await clearBusinessData(deps.db);
  await deps.repos.appMeta.set('pullCursor', '0');
  await runSync(deps);
  await rebuildSequences(deps);
}

async function clearBusinessData(db: AppDatabase) {
  await db.transaction(async (tx) => {
    await tx.delete(invoiceItems);
    await tx.delete(payments);
    await tx.delete(invoices);
    await tx.delete(invoiceSequences);
    await tx.delete(products);
    await tx.delete(customers);
    await tx.delete(gstConfigurations);
    await tx.delete(vendors);
    await tx.delete(syncQueue);
    await tx.delete(auditEvents);
  });
}

async function rebuildSequences(deps: SyncDeps) {
  const vendor = await deps.repos.vendors.get();
  if (!vendor) {
    return;
  }
  const seriesCode = await deps.repos.appMeta.getSeriesCode();
  const all = await deps.repos.invoices.list();
  const byFy = new Map<string, number>();
  for (const invoice of all) {
    const sequence = parseInvoiceSequence(invoice.invoiceNumber, vendor.invoicePrefix, seriesCode);
    if (sequence == null) {
      continue;
    }
    const prior = byFy.get(invoice.financialYear) ?? 0;
    if (sequence > prior) {
      byFy.set(invoice.financialYear, sequence);
    }
  }
  for (const [financialYear, maxSeq] of byFy) {
    await deps.db.insert(invoiceSequences).values({
      id: createId(),
      vendorId: vendor.id,
      financialYear,
      seriesCode,
      nextNumber: maxSeq + 1,
    });
  }
}

/** @deprecated Prefer localHasUnsyncedOrBusinessData */
export async function localHasBusinessInvoices(repos: Repositories): Promise<boolean> {
  const invoicesList = await repos.invoices.list();
  return invoicesList.some((invoice) => invoice.status !== 'cancelled');
}

export async function localHasUnsyncedOrBusinessData(repos: Repositories): Promise<boolean> {
  const pending = await repos.syncQueue.pendingCount();
  if (pending > 0) {
    return true;
  }
  const [productList, customerList, invoiceList] = await Promise.all([
    repos.products.list(),
    repos.customers.list(),
    repos.invoices.list(),
  ]);
  if (productList.length > 0 || customerList.length > 0) {
    return true;
  }
  return invoiceList.some((invoice) => invoice.status !== 'cancelled');
}

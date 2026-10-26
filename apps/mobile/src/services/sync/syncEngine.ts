import type { BackupStatus, SyncEntityType } from '@invoice-gst/types';
import { eq } from 'drizzle-orm';
import type { Repositories } from '../../database/repositories';
import type { AppDatabase } from '../../database/client';
import {
  customers,
  gstConfigurations,
  invoiceItems,
  invoices,
  payments,
  products,
  vendors,
} from '../../database/schema';
import { nowIso } from '../../utils/clock';
import { apiRequest } from './apiClient';
import { selectBatch } from './batch';
import { AuthExpiredError, DeviceRevokedError, NetworkError } from './errors';
import { getAccessToken } from './tokenStore';

type SyncEngineDeps = {
  db: AppDatabase;
  repos: Repositories;
};

type SyncOutcome = {
  status: BackupStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  lastError: string | null;
  accountEmail: string | null;
};

type PushResult = {
  idempotencyKey: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  code?: string;
};

let running: Promise<SyncOutcome> | null = null;

export async function runSync(deps: SyncEngineDeps): Promise<SyncOutcome> {
  if (running) {
    return running;
  }
  running = performSync(deps).finally(() => {
    running = null;
  });
  return running;
}

async function performSync(deps: SyncEngineDeps): Promise<SyncOutcome> {
  const { repos } = deps;
  const accountEmail = await repos.appMeta.get('accountEmail');
  const pendingCount = await repos.syncQueue.pendingCount();

  if (!(await getAccessToken())) {
    return {
      status: accountEmail ? 'paused_auth' : 'anonymous',
      lastSyncAt: await repos.appMeta.get('lastSyncAt'),
      pendingCount,
      lastError: null,
      accountEmail,
    };
  }

  const deviceId = await repos.appMeta.ensureDeviceId();
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await repos.syncQueue.reclaimStaleInFlight(staleBefore);

  try {
    const pending = await repos.syncQueue.listPending(200);
    const batch = selectBatch(pending);
    if (batch.length > 0) {
      await repos.syncQueue.markInFlight(batch.map((row) => row.id));
      const response = await apiRequest<{ results: PushResult[] }>('/sync/push', {
        deviceId,
        body: {
          changes: batch.map((row) => ({
            idempotencyKey: row.idempotencyKey,
            entityType: row.entityType as SyncEntityType,
            entityId: row.entityId,
            operation: row.operation,
            clientUpdatedAt: row.createdAt,
            payload: JSON.parse(row.payload) as unknown,
          })),
        },
      });
      const byKey = new Map(response.results.map((result) => [result.idempotencyKey, result]));
      for (const row of batch) {
        const result = byKey.get(row.idempotencyKey);
        if (!result) {
          await repos.syncQueue.bumpRetry(row.id, 'Missing server result');
          continue;
        }
        if (result.status === 'applied' || result.status === 'duplicate') {
          await repos.syncQueue.markResult(row.id, 'synced');
          await markEntitySynced(deps.db, row.entityType as SyncEntityType, row.entityId);
        } else if (result.status === 'conflict') {
          await repos.syncQueue.markResult(row.id, 'conflict', result.code ?? 'conflict');
        } else {
          await repos.syncQueue.markResult(row.id, 'failed', result.code ?? 'rejected');
        }
      }
    }

    let cursor = (await repos.appMeta.get('pullCursor')) ?? '0';
    let hasMore = true;
    while (hasMore) {
      const page = await apiRequest<{
        vendor: Record<string, unknown> | null;
        gstConfiguration: Record<string, unknown> | null;
        products: Array<Record<string, unknown>>;
        customers: Array<Record<string, unknown>>;
        invoices: Array<Record<string, unknown>>;
        nextCursor: string;
        hasMore: boolean;
      }>('/sync/pull', {
        deviceId,
        body: { cursor, limit: 100 },
      });
      await applyPullPage(deps, page);
      cursor = page.nextCursor;
      await repos.appMeta.set('pullCursor', cursor);
      hasMore = page.hasMore;
    }

    const syncedAt = nowIso();
    await repos.appMeta.set('lastSyncAt', syncedAt);
    return {
      status: 'synced',
      lastSyncAt: syncedAt,
      pendingCount: await repos.syncQueue.pendingCount(),
      lastError: null,
      accountEmail,
    };
  } catch (error) {
    if (error instanceof AuthExpiredError || error instanceof DeviceRevokedError) {
      return {
        status: 'paused_auth',
        lastSyncAt: await repos.appMeta.get('lastSyncAt'),
        pendingCount: await repos.syncQueue.pendingCount(),
        lastError: error.message,
        accountEmail,
      };
    }
    if (error instanceof NetworkError) {
      return {
        status: 'paused_network',
        lastSyncAt: await repos.appMeta.get('lastSyncAt'),
        pendingCount: await repos.syncQueue.pendingCount(),
        lastError: error.message,
        accountEmail,
      };
    }
    return {
      status: 'needs_attention',
      lastSyncAt: await repos.appMeta.get('lastSyncAt'),
      pendingCount: await repos.syncQueue.pendingCount(),
      lastError: error instanceof Error ? error.message : 'Sync failed',
      accountEmail,
    };
  }
}

async function markEntitySynced(db: AppDatabase, entityType: SyncEntityType, entityId: string) {
  if (entityType === 'product') {
    await db.update(products).set({ syncStatus: 'synced' }).where(eq(products.id, entityId));
  } else if (entityType === 'customer') {
    await db.update(customers).set({ syncStatus: 'synced' }).where(eq(customers.id, entityId));
  } else if (entityType === 'vendor') {
    await db.update(vendors).set({ syncStatus: 'synced' }).where(eq(vendors.id, entityId));
  } else if (entityType === 'gst_configuration') {
    await db
      .update(gstConfigurations)
      .set({ syncStatus: 'synced' })
      .where(eq(gstConfigurations.id, entityId));
  } else if (entityType === 'invoice') {
    await db.update(invoices).set({ syncStatus: 'synced' }).where(eq(invoices.id, entityId));
  }
}

async function applyPullPage(
  deps: SyncEngineDeps,
  page: {
    vendor: Record<string, unknown> | null;
    gstConfiguration: Record<string, unknown> | null;
    products: Array<Record<string, unknown>>;
    customers: Array<Record<string, unknown>>;
    invoices: Array<Record<string, unknown>>;
  },
) {
  const pending = await deps.repos.syncQueue.listPending(500);
  const dirty = new Set(pending.map((row) => `${row.entityType}:${row.entityId}`));

  await deps.db.transaction(async (tx) => {
    if (page.vendor && !dirty.has(`vendor:${String(page.vendor.id)}`)) {
      const vendor = page.vendor;
      await tx
        .insert(vendors)
        .values({
          id: String(vendor.id),
          businessName: String(vendor.businessName),
          tradeName: (vendor.tradeName as string | null) ?? null,
          gstin: (vendor.gstin as string | null) ?? null,
          phone: (vendor.phone as string | null) ?? null,
          email: (vendor.email as string | null) ?? null,
          addressLine1: (vendor.addressLine1 as string | null) ?? null,
          addressLine2: (vendor.addressLine2 as string | null) ?? null,
          city: (vendor.city as string | null) ?? null,
          stateCode: String(vendor.stateCode),
          pincode: (vendor.pincode as string | null) ?? null,
          gstRegistrationType: String(vendor.gstRegistrationType),
          invoicePrefix: String(vendor.invoicePrefix).slice(0, 3),
          logoUri: (vendor.logoUri as string | null) ?? null,
          createdAt: String(vendor.createdAt),
          updatedAt: String(vendor.updatedAt),
          deletedAt: (vendor.deletedAt as string | null) ?? null,
          syncStatus: 'synced',
        })
        .onConflictDoUpdate({
          target: vendors.id,
          set: {
            businessName: String(vendor.businessName),
            tradeName: (vendor.tradeName as string | null) ?? null,
            gstin: (vendor.gstin as string | null) ?? null,
            phone: (vendor.phone as string | null) ?? null,
            email: (vendor.email as string | null) ?? null,
            addressLine1: (vendor.addressLine1 as string | null) ?? null,
            addressLine2: (vendor.addressLine2 as string | null) ?? null,
            city: (vendor.city as string | null) ?? null,
            stateCode: String(vendor.stateCode),
            pincode: (vendor.pincode as string | null) ?? null,
            gstRegistrationType: String(vendor.gstRegistrationType),
            invoicePrefix: String(vendor.invoicePrefix).slice(0, 3),
            updatedAt: String(vendor.updatedAt),
            deletedAt: (vendor.deletedAt as string | null) ?? null,
            syncStatus: 'synced',
          },
        });
    }

    if (page.gstConfiguration && !dirty.has(`gst_configuration:${String(page.gstConfiguration.id)}`)) {
      const gst = page.gstConfiguration;
      await tx
        .insert(gstConfigurations)
        .values({
          id: String(gst.id),
          vendorId: String(gst.vendorId),
          defaultGstRateBps: Number(gst.defaultGstRateBps),
          enableIgst: gst.enableIgst ? 1 : 0,
          roundingMode: String(gst.roundingMode),
          compositionScheme: gst.compositionScheme ? 1 : 0,
          createdAt: String(gst.createdAt),
          updatedAt: String(gst.updatedAt),
          syncStatus: 'synced',
        })
        .onConflictDoUpdate({
          target: gstConfigurations.id,
          set: {
            defaultGstRateBps: Number(gst.defaultGstRateBps),
            enableIgst: gst.enableIgst ? 1 : 0,
            roundingMode: String(gst.roundingMode),
            compositionScheme: gst.compositionScheme ? 1 : 0,
            updatedAt: String(gst.updatedAt),
            syncStatus: 'synced',
          },
        });
    }

    for (const product of page.products) {
      if (dirty.has(`product:${String(product.id)}`)) {
        continue;
      }
      await tx
        .insert(products)
        .values({
          id: String(product.id),
          name: String(product.name),
          localName: (product.localName as string | null) ?? null,
          aliases: JSON.stringify(product.aliases ?? []),
          sku: (product.sku as string | null) ?? null,
          hsnCode: (product.hsnCode as string | null) ?? null,
          unit: String(product.unit),
          sellingPricePaise: Number(product.sellingPricePaise),
          gstRateBps: Number(product.gstRateBps),
          priceInclusive: product.priceInclusive ? 1 : 0,
          isActive: product.isActive === false ? 0 : 1,
          createdAt: String(product.createdAt),
          updatedAt: String(product.updatedAt),
          deletedAt: (product.deletedAt as string | null) ?? null,
          syncStatus: 'synced',
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            name: String(product.name),
            localName: (product.localName as string | null) ?? null,
            aliases: JSON.stringify(product.aliases ?? []),
            sku: (product.sku as string | null) ?? null,
            hsnCode: (product.hsnCode as string | null) ?? null,
            unit: String(product.unit),
            sellingPricePaise: Number(product.sellingPricePaise),
            gstRateBps: Number(product.gstRateBps),
            priceInclusive: product.priceInclusive ? 1 : 0,
            isActive: product.isActive === false ? 0 : 1,
            updatedAt: String(product.updatedAt),
            deletedAt: (product.deletedAt as string | null) ?? null,
            syncStatus: 'synced',
          },
        });
    }

    for (const customer of page.customers) {
      if (dirty.has(`customer:${String(customer.id)}`)) {
        continue;
      }
      await tx
        .insert(customers)
        .values({
          id: String(customer.id),
          name: String(customer.name),
          phone: (customer.phone as string | null) ?? null,
          email: (customer.email as string | null) ?? null,
          addressLine1: (customer.addressLine1 as string | null) ?? null,
          city: (customer.city as string | null) ?? null,
          stateCode: (customer.stateCode as string | null) ?? null,
          pincode: (customer.pincode as string | null) ?? null,
          gstin: (customer.gstin as string | null) ?? null,
          customerType: String(customer.customerType),
          createdAt: String(customer.createdAt),
          updatedAt: String(customer.updatedAt),
          deletedAt: (customer.deletedAt as string | null) ?? null,
          syncStatus: 'synced',
        })
        .onConflictDoUpdate({
          target: customers.id,
          set: {
            name: String(customer.name),
            phone: (customer.phone as string | null) ?? null,
            email: (customer.email as string | null) ?? null,
            addressLine1: (customer.addressLine1 as string | null) ?? null,
            city: (customer.city as string | null) ?? null,
            stateCode: (customer.stateCode as string | null) ?? null,
            pincode: (customer.pincode as string | null) ?? null,
            gstin: (customer.gstin as string | null) ?? null,
            customerType: String(customer.customerType),
            updatedAt: String(customer.updatedAt),
            deletedAt: (customer.deletedAt as string | null) ?? null,
            syncStatus: 'synced',
          },
        });
    }

    for (const invoice of page.invoices) {
      const id = String(invoice.id);
      if (dirty.has(`invoice:${id}`)) {
        continue;
      }
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.delete(payments).where(eq(payments.invoiceId, id));
      await tx
        .insert(invoices)
        .values({
          id,
          invoiceNumber: String(invoice.invoiceNumber),
          financialYear: String(invoice.financialYear),
          customerId: (invoice.customerId as string | null) ?? null,
          customerSnapshot: JSON.stringify(invoice.customerSnapshot ?? {}),
          placeOfSupplyStateCode: String(invoice.placeOfSupplyStateCode),
          isInterState: invoice.isInterState ? 1 : 0,
          status: String(invoice.status),
          subtotalPaise: Number(invoice.subtotalPaise),
          discountPaise: Number(invoice.discountPaise),
          taxablePaise: Number(invoice.taxablePaise),
          cgstPaise: Number(invoice.cgstPaise),
          sgstPaise: Number(invoice.sgstPaise),
          igstPaise: Number(invoice.igstPaise),
          roundOffPaise: Number(invoice.roundOffPaise),
          totalPaise: Number(invoice.totalPaise),
          paymentStatus: String(invoice.paymentStatus),
          notes: (invoice.notes as string | null) ?? null,
          createdAt: String(invoice.createdAt),
          updatedAt: String(invoice.updatedAt),
          finalizedAt: (invoice.finalizedAt as string | null) ?? null,
          syncStatus: 'synced',
        })
        .onConflictDoUpdate({
          target: invoices.id,
          set: {
            customerId: (invoice.customerId as string | null) ?? null,
            customerSnapshot: JSON.stringify(invoice.customerSnapshot ?? {}),
            placeOfSupplyStateCode: String(invoice.placeOfSupplyStateCode),
            isInterState: invoice.isInterState ? 1 : 0,
            status: String(invoice.status),
            subtotalPaise: Number(invoice.subtotalPaise),
            discountPaise: Number(invoice.discountPaise),
            taxablePaise: Number(invoice.taxablePaise),
            cgstPaise: Number(invoice.cgstPaise),
            sgstPaise: Number(invoice.sgstPaise),
            igstPaise: Number(invoice.igstPaise),
            roundOffPaise: Number(invoice.roundOffPaise),
            totalPaise: Number(invoice.totalPaise),
            paymentStatus: String(invoice.paymentStatus),
            notes: (invoice.notes as string | null) ?? null,
            updatedAt: String(invoice.updatedAt),
            finalizedAt: (invoice.finalizedAt as string | null) ?? null,
            syncStatus: 'synced',
          },
        });

      const items = (invoice.items as Array<Record<string, unknown>> | undefined) ?? [];
      for (const item of items) {
        await tx.insert(invoiceItems).values({
          id: String(item.id),
          invoiceId: id,
          productId: (item.productId as string | null) ?? null,
          productNameSnapshot: String(item.productNameSnapshot),
          localNameSnapshot: (item.localNameSnapshot as string | null) ?? null,
          hsnSnapshot: (item.hsnSnapshot as string | null) ?? null,
          unitSnapshot: String(item.unitSnapshot),
          quantityMilli: Number(item.quantityMilli),
          unitPricePaise: Number(item.unitPricePaise),
          gstRateBps: Number(item.gstRateBps),
          priceInclusive: item.priceInclusive ? 1 : 0,
          taxablePaise: Number(item.taxablePaise),
          cgstPaise: Number(item.cgstPaise),
          sgstPaise: Number(item.sgstPaise),
          igstPaise: Number(item.igstPaise),
          lineTotalPaise: Number(item.lineTotalPaise),
        });
      }
      const pays = (invoice.payments as Array<Record<string, unknown>> | undefined) ?? [];
      for (const payment of pays) {
        await tx.insert(payments).values({
          id: String(payment.id),
          invoiceId: id,
          method: String(payment.method),
          amountPaise: Number(payment.amountPaise),
          paidAt: String(payment.paidAt),
          reference: (payment.reference as string | null) ?? null,
          createdAt: String(payment.createdAt ?? payment.paidAt),
          updatedAt: String(payment.updatedAt ?? payment.paidAt),
          syncStatus: 'synced',
        });
      }
    }
  });
}

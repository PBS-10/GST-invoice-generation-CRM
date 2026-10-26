import type { GstConfiguration, Vendor } from '@invoice-gst/types';
import { eq } from 'drizzle-orm';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { mapGstConfig, mapVendor } from '../mappers';
import { gstConfigurations, vendors } from '../schema';
import { createSyncQueueRepository } from './syncQueueRepository';

export function createVendorRepository(db: AppDatabase) {
  const queue = createSyncQueueRepository(db);

  return {
    async get(): Promise<Vendor | null> {
      const rows = await db.select().from(vendors).limit(1);
      const row = rows[0];
      return row ? mapVendor(row) : null;
    },

    async getGstConfig(vendorId: string): Promise<GstConfiguration | null> {
      const rows = await db
        .select()
        .from(gstConfigurations)
        .where(eq(gstConfigurations.vendorId, vendorId))
        .limit(1);
      const row = rows[0];
      return row ? mapGstConfig(row) : null;
    },

    async upsert(
      input: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus' | 'logoUri'> & {
        id?: string;
        logoUri?: string | null;
      },
    ): Promise<Vendor> {
      const existing = await this.get();
      const timestamp = nowIso();
      const prefix = input.invoicePrefix.slice(0, 3).toUpperCase();

      if (existing) {
        await db.transaction(async (tx) => {
          await tx
            .update(vendors)
            .set({
              ...input,
              invoicePrefix: prefix,
              logoUri: input.logoUri ?? existing.logoUri,
              updatedAt: timestamp,
              syncStatus: 'pending',
            })
            .where(eq(vendors.id, existing.id));

          const compositionScheme = input.gstRegistrationType === 'composition' ? 1 : 0;
          await tx
            .update(gstConfigurations)
            .set({
              compositionScheme,
              updatedAt: timestamp,
              syncStatus: 'pending',
            })
            .where(eq(gstConfigurations.vendorId, existing.id));

          const vendorSnapshot = {
            ...existing,
            ...input,
            invoicePrefix: prefix,
            logoUri: input.logoUri ?? existing.logoUri,
            updatedAt: timestamp,
            syncStatus: 'pending' as const,
          };
          await queue.enqueue(tx, 'vendor', existing.id, 'update', vendorSnapshot);
          const gst = await this.getGstConfig(existing.id);
          if (gst) {
            await queue.enqueue(tx, 'gst_configuration', gst.id, 'update', {
              ...gst,
              compositionScheme: input.gstRegistrationType === 'composition',
              updatedAt: timestamp,
              syncStatus: 'pending',
            });
          }
        });

        const updated = await this.get();
        if (!updated) {
          throw new Error('Vendor update failed');
        }
        return updated;
      }

      const id = input.id ?? createId();
      const gstId = createId();
      await db.transaction(async (tx) => {
        await tx.insert(vendors).values({
          ...input,
          invoicePrefix: prefix,
          id,
          logoUri: input.logoUri ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending',
        });

        await tx.insert(gstConfigurations).values({
          id: gstId,
          vendorId: id,
          defaultGstRateBps: 1800,
          enableIgst: 1,
          roundingMode: 'nearest',
          compositionScheme: input.gstRegistrationType === 'composition' ? 1 : 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
        });

        await queue.enqueue(tx, 'vendor', id, 'create', {
          ...input,
          invoicePrefix: prefix,
          id,
          logoUri: input.logoUri ?? null,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending',
        });
        await queue.enqueue(tx, 'gst_configuration', gstId, 'create', {
          id: gstId,
          vendorId: id,
          defaultGstRateBps: 1800,
          enableIgst: true,
          roundingMode: 'nearest',
          compositionScheme: input.gstRegistrationType === 'composition',
          createdAt: timestamp,
          updatedAt: timestamp,
          syncStatus: 'pending',
        });
      });

      const created = await this.get();
      if (!created) {
        throw new Error('Vendor create failed');
      }
      return created;
    },
  };
}

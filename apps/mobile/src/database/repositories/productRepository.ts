import type { Product } from '@invoice-gst/types';
import { and, eq, isNull } from 'drizzle-orm';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';
import { mergeSpokenAlias } from '../../utils/spokenAlias';
import type { AppDatabase } from '../client';
import { mapProduct } from '../mappers';
import { products } from '../schema';
import { createSyncQueueRepository } from './syncQueueRepository';

function toRow(product: Pick<Product, 'aliases' | 'priceInclusive' | 'isActive'>) {
  return {
    aliases: JSON.stringify(product.aliases),
    priceInclusive: product.priceInclusive ? 1 : 0,
    isActive: product.isActive ? 1 : 0,
  };
}

export function createProductRepository(db: AppDatabase) {
  const queue = createSyncQueueRepository(db);

  return {
    async listActive(): Promise<Product[]> {
      // Filter in JS after map so driver quirks on integer/boolean isActive
      // cannot hide catalogue rows from the New Invoice picker.
      const rows = await db
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
        .orderBy(products.name);
      return rows.map(mapProduct).filter((product) => product.isActive);
    },

    async list(): Promise<Product[]> {
      const rows = await db
        .select()
        .from(products)
        .where(isNull(products.deletedAt))
        .orderBy(products.name);
      return rows.map(mapProduct);
    },

    async get(id: string): Promise<Product | null> {
      const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
      const row = rows[0];
      return row && row.deletedAt == null ? mapProduct(row) : null;
    },

    async create(
      input: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Product> {
      const timestamp = nowIso();
      const id = createId();
      const row = toRow(input);
      await db.transaction(async (tx) => {
        // Explicit columns — never spread boolean/array Product fields into SQLite.
        await tx.insert(products).values({
          id,
          name: input.name,
          localName: input.localName,
          aliases: row.aliases,
          sku: input.sku,
          hsnCode: input.hsnCode,
          unit: input.unit,
          sellingPricePaise: input.sellingPricePaise,
          gstRateBps: input.gstRateBps,
          priceInclusive: row.priceInclusive,
          isActive: row.isActive,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending',
        });
        const created = {
          ...input,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending' as const,
        };
        await queue.enqueue(tx, 'product', id, 'create', created);
      });
      const created = await this.get(id);
      if (!created) {
        throw new Error('Product create failed');
      }
      return created;
    },

    async update(
      id: string,
      input: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Product> {
      const timestamp = nowIso();
      const row = toRow(input);
      await db.transaction(async (tx) => {
        await tx
          .update(products)
          .set({
            name: input.name,
            localName: input.localName,
            aliases: row.aliases,
            sku: input.sku,
            hsnCode: input.hsnCode,
            unit: input.unit,
            sellingPricePaise: input.sellingPricePaise,
            gstRateBps: input.gstRateBps,
            priceInclusive: row.priceInclusive,
            isActive: row.isActive,
            updatedAt: timestamp,
            syncStatus: 'pending',
          })
          .where(and(eq(products.id, id), isNull(products.deletedAt)));
        const snapshot = {
          ...input,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending' as const,
        };
        await queue.enqueue(tx, 'product', id, 'update', snapshot);
      });
      const updated = await this.get(id);
      if (!updated) {
        throw new Error('Product update failed');
      }
      return updated;
    },

    async softDelete(id: string): Promise<void> {
      const timestamp = nowIso();
      await db.transaction(async (tx) => {
        await tx
          .update(products)
          .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending', isActive: 0 })
          .where(eq(products.id, id));
        await queue.enqueue(tx, 'product', id, 'delete', { id, deletedAt: timestamp });
      });
    },

    /**
     * Learn a spoken phrase as a search alias after voice resolve.
     * No-op when already known. Never throws to the UI path — callers may ignore.
     */
    async addSpokenAlias(id: string, spoken: string): Promise<boolean> {
      const product = await this.get(id);
      if (!product) {
        return false;
      }
      const { aliases, added } = mergeSpokenAlias({
        name: product.name,
        localName: product.localName,
        aliases: product.aliases,
        spoken,
      });
      if (!added) {
        return false;
      }
      await this.update(id, {
        name: product.name,
        localName: product.localName,
        aliases,
        sku: product.sku,
        hsnCode: product.hsnCode,
        unit: product.unit,
        sellingPricePaise: product.sellingPricePaise,
        gstRateBps: product.gstRateBps,
        priceInclusive: product.priceInclusive,
        isActive: product.isActive,
      });
      return true;
    },
  };
}

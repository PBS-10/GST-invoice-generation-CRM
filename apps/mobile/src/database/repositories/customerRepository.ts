import type { Customer } from '@invoice-gst/types';
import { and, eq, isNull } from 'drizzle-orm';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { mapCustomer } from '../mappers';
import { customers } from '../schema';
import { createSyncQueueRepository } from './syncQueueRepository';

export function createCustomerRepository(db: AppDatabase) {
  const queue = createSyncQueueRepository(db);

  return {
    async list(): Promise<Customer[]> {
      const rows = await db
        .select()
        .from(customers)
        .where(isNull(customers.deletedAt))
        .orderBy(customers.name);
      return rows.map(mapCustomer);
    },

    async get(id: string): Promise<Customer | null> {
      const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      const row = rows[0];
      return row && row.deletedAt == null ? mapCustomer(row) : null;
    },

    async create(
      input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Customer> {
      const timestamp = nowIso();
      const id = createId();
      await db.transaction(async (tx) => {
        await tx.insert(customers).values({
          ...input,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending',
        });
        await queue.enqueue(tx, 'customer', id, 'create', {
          ...input,
          id,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending',
        });
      });
      const created = await this.get(id);
      if (!created) {
        throw new Error('Customer create failed');
      }
      return created;
    },

    async update(
      id: string,
      input: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'syncStatus'>,
    ): Promise<Customer> {
      const timestamp = nowIso();
      await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ ...input, updatedAt: timestamp, syncStatus: 'pending' })
          .where(and(eq(customers.id, id), isNull(customers.deletedAt)));
        await queue.enqueue(tx, 'customer', id, 'update', {
          ...input,
          id,
          updatedAt: timestamp,
          deletedAt: null,
          syncStatus: 'pending',
        });
      });
      const updated = await this.get(id);
      if (!updated) {
        throw new Error('Customer update failed');
      }
      return updated;
    },

    async softDelete(id: string): Promise<void> {
      const timestamp = nowIso();
      await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ deletedAt: timestamp, updatedAt: timestamp, syncStatus: 'pending' })
          .where(eq(customers.id, id));
        await queue.enqueue(tx, 'customer', id, 'delete', { id, deletedAt: timestamp });
      });
    },
  };
}

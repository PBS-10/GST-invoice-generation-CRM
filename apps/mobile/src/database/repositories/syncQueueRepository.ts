import type { SyncEntityType, SyncOperation } from '@invoice-gst/types';
import { and, asc, eq, inArray, lt } from 'drizzle-orm';
import { notifyLocalWrite } from '../../services/sync/syncNotify';
import { nowIso } from '../../utils/clock';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { syncQueue } from '../schema';

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];

export function createSyncQueueRepository(db: AppDatabase) {
  return {
    async enqueue(
      tx: Tx,
      entityType: SyncEntityType,
      entityId: string,
      operation: SyncOperation,
      snapshot: unknown,
    ): Promise<void> {
      await tx.insert(syncQueue).values({
        id: createId(),
        entityType,
        entityId,
        operation,
        payload: JSON.stringify(snapshot),
        idempotencyKey: createId(),
        createdAt: nowIso(),
        retryCount: 0,
        lastError: null,
        status: 'pending',
      });
      // Debounced sync runs after the surrounding transaction commits.
      notifyLocalWrite();
    },

    async listPending(limit = 100) {
      return db
        .select()
        .from(syncQueue)
        .where(eq(syncQueue.status, 'pending'))
        .orderBy(asc(syncQueue.createdAt))
        .limit(limit);
    },

    async markInFlight(ids: string[]) {
      if (ids.length === 0) {
        return;
      }
      await db
        .update(syncQueue)
        .set({ status: 'in_flight' })
        .where(inArray(syncQueue.id, ids));
    },

    async markResult(
      id: string,
      status: 'synced' | 'failed' | 'conflict' | 'pending',
      lastError?: string | null,
    ) {
      await db
        .update(syncQueue)
        .set({
          status,
          lastError: lastError ?? null,
          retryCount: status === 'pending' || status === 'failed' ? undefined : undefined,
        })
        .where(eq(syncQueue.id, id));
    },

    async bumpRetry(id: string, lastError: string) {
      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id)).limit(1);
      const row = rows[0];
      if (!row) {
        return;
      }
      await db
        .update(syncQueue)
        .set({
          status: 'pending',
          retryCount: row.retryCount + 1,
          lastError,
        })
        .where(eq(syncQueue.id, id));
    },

    async reclaimStaleInFlight(olderThanIso: string) {
      await db
        .update(syncQueue)
        .set({ status: 'pending' })
        .where(and(eq(syncQueue.status, 'in_flight'), lt(syncQueue.createdAt, olderThanIso)));
    },

    async pendingCount() {
      const rows = await db.select().from(syncQueue).where(eq(syncQueue.status, 'pending'));
      return rows.length;
    },
  };
}

export type SyncQueueRepository = ReturnType<typeof createSyncQueueRepository>;

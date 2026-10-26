import { eq } from 'drizzle-orm';
import { createId } from '../../utils/id';
import type { AppDatabase } from '../client';
import { appMeta } from '../schema';

const KEYS = {
  deviceId: 'deviceId',
  seriesCode: 'seriesCode',
  accountEmail: 'accountEmail',
  linkedVendorId: 'linkedVendorId',
  pullCursor: 'pullCursor',
  lastSyncAt: 'lastSyncAt',
  lastBackupNudgeDate: 'lastBackupNudgeDate',
  activeCartId: 'activeCartId',
  editingInvoiceId: 'editingInvoiceId',
} as const;

export type AppMetaKey = (typeof KEYS)[keyof typeof KEYS];

export function createAppMetaRepository(db: AppDatabase) {
  return {
    keys: KEYS,

    async get(key: AppMetaKey): Promise<string | null> {
      const rows = await db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1);
      return rows[0]?.value ?? null;
    },

    async set(key: AppMetaKey, value: string): Promise<void> {
      const existing = await this.get(key);
      if (existing == null) {
        await db.insert(appMeta).values({ key, value });
        return;
      }
      await db.update(appMeta).set({ value }).where(eq(appMeta.key, key));
    },

    async delete(key: AppMetaKey): Promise<void> {
      await db.delete(appMeta).where(eq(appMeta.key, key));
    },

    async ensureDeviceId(): Promise<string> {
      const existing = await this.get(KEYS.deviceId);
      if (existing) {
        return existing;
      }
      const id = createId();
      await this.set(KEYS.deviceId, id);
      return id;
    },

    async getSeriesCode(): Promise<string> {
      return (await this.get(KEYS.seriesCode)) ?? 'A';
    },
  };
}

export type AppMetaRepository = ReturnType<typeof createAppMetaRepository>;

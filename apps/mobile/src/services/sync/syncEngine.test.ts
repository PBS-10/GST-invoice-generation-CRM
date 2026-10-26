import { describe, expect, it } from 'vitest';
import { nextBackoffMs, shouldSkipDirtyPull } from './backoff';
import { selectBatch } from './batch';

describe('selectBatch', () => {
  it('keeps only the newest pending row per master-data entity', () => {
    const batch = selectBatch([
      {
        id: '1',
        entityType: 'product',
        entityId: 'p1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '2',
        entityType: 'product',
        entityId: 'p1',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: '3',
        entityType: 'invoice',
        entityId: 'i1',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '4',
        entityType: 'invoice',
        entityId: 'i2',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(batch.map((row) => row.id).sort()).toEqual(['2', '3', '4']);
  });

  it('caps the batch at 100', () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({
      id: String(index),
      entityType: 'invoice',
      entityId: `i${index}`,
      createdAt: '2026-01-01T00:00:00.000Z',
    }));
    expect(selectBatch(rows)).toHaveLength(100);
  });
});

describe('backoff', () => {
  it('caps at 30 minutes', () => {
    expect(nextBackoffMs(20, () => 1)).toBeLessThanOrEqual(30 * 60_000);
  });

  it('grows with retry count', () => {
    expect(nextBackoffMs(0, () => 1)).toBeLessThan(nextBackoffMs(5, () => 1));
  });
});

describe('shouldSkipDirtyPull', () => {
  it('skips master-data rows that still have local changes', () => {
    const dirty = new Set(['product:p1']);
    expect(shouldSkipDirtyPull(dirty, 'product', 'p1')).toBe(true);
    expect(shouldSkipDirtyPull(dirty, 'product', 'p2')).toBe(false);
  });
});

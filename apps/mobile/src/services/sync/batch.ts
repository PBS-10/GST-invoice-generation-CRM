/** Keep newest pending row per master-data entity; include all invoices; cap at 100. */
export function selectBatch<
  T extends {
    id: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  },
>(rows: T[]): T[] {
  const master = new Map<string, T>();
  const invoices: T[] = [];
  for (const row of rows) {
    if (row.entityType === 'invoice') {
      invoices.push(row);
      continue;
    }
    const key = `${row.entityType}:${row.entityId}`;
    const prior = master.get(key);
    if (!prior || prior.createdAt < row.createdAt) {
      master.set(key, row);
    }
  }
  return [...master.values(), ...invoices].slice(0, 100);
}

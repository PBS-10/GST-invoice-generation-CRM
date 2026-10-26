import type { PrismaService } from '../prisma.service';

/** Allocate the next monotonic serverVersion from the shared Postgres sequence. */
export async function nextServerVersion(prisma: PrismaService | { $queryRaw: PrismaService['$queryRaw'] }): Promise<bigint> {
  const rows = await prisma.$queryRaw<Array<{ nextval: bigint | number | string }>>`
    SELECT nextval('sync_server_version_seq') AS nextval
  `;
  const value = rows[0]?.nextval;
  if (value == null) {
    throw new Error('Failed to allocate serverVersion');
  }
  return BigInt(value);
}

export function hashVendorLockKey(vendorId: string): bigint {
  let hash = 0n;
  for (let index = 0; index < vendorId.length; index += 1) {
    hash = (hash * 131n + BigInt(vendorId.charCodeAt(index))) & 0x7fffffffffffffffn;
  }
  return hash === 0n ? 1n : hash;
}

import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATION_JOURNAL_SQL, pendingMigrationStatements, type MigrationBundle } from './migrationPlan';

export async function applyMigrations(sqlite: SQLiteDatabase, bundle: MigrationBundle): Promise<void> {
  await sqlite.execAsync(MIGRATION_JOURNAL_SQL);
  const applied = await sqlite.getAllAsync<{ created_at: number | null }>(
    'SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
  );
  const latest = applied[0]?.created_at;
  const lastCreatedAt = latest === undefined || latest === null ? null : Number(latest);
  const pending = pendingMigrationStatements(bundle, lastCreatedAt);
  if (pending.length === 0) {
    return;
  }

  await sqlite.withTransactionAsync(async () => {
    for (const migration of pending) {
      for (const statement of migration.statements) {
        await sqlite.execAsync(statement);
      }
      await sqlite.runAsync(
        'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)',
        '',
        migration.createdAt,
      );
    }
  });
}

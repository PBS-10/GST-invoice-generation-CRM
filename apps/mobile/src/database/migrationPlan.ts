/**
 * Drizzle's own migrator creates `__drizzle_migrations` with `id SERIAL PRIMARY KEY`.
 * Android SQLite accepts SERIAL as a type name. The browser build (wa-sqlite) rejects it,
 * so the web app never gets past database init. INTEGER PRIMARY KEY is valid on both.
 */

export const MIGRATION_JOURNAL_SQL = `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id INTEGER PRIMARY KEY,
  hash text NOT NULL,
  created_at numeric
)`;

export type MigrationBundle = {
  journal: {
    entries: { idx: number; when: number; tag: string }[];
  };
  migrations: Record<string, string>;
};

export function pendingMigrationStatements(
  bundle: MigrationBundle,
  lastCreatedAt: number | null,
): { createdAt: number; statements: string[] }[] {
  const pending = bundle.journal.entries.filter(
    (entry) => lastCreatedAt === null || entry.when > lastCreatedAt,
  );
  return pending.map((entry) => {
    const key = `m${String(entry.idx).padStart(4, '0')}`;
    const sql = bundle.migrations[key];
    if (!sql) {
      throw new Error(`Missing migration: ${entry.tag}`);
    }
    const statements = sql
      .split('--> statement-breakpoint')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return { createdAt: entry.when, statements };
  });
}

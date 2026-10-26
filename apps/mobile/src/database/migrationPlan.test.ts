import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MIGRATION_JOURNAL_SQL, pendingMigrationStatements } from './migrationPlan';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

describe('migration journal', () => {
  it('uses INTEGER PRIMARY KEY so the web SQLite build can create the table', () => {
    expect(MIGRATION_JOURNAL_SQL).toContain('INTEGER PRIMARY KEY');
    expect(MIGRATION_JOURNAL_SQL.toUpperCase()).not.toContain('SERIAL');
  });

  it('includes the sync migration with app_meta and seriesCode', () => {
    const journal = JSON.parse(
      readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };
    expect(journal.entries.some((entry) => entry.tag === '0001_sync')).toBe(true);
    const sql = readFileSync(join(migrationsDir, '0001_sync.sql'), 'utf8');
    expect(sql).toContain('app_meta');
    expect(sql).toContain('seriesCode');
  });

  it('includes billing carts migration', () => {
    const journal = JSON.parse(
      readFileSync(join(migrationsDir, 'meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ tag: string }> };
    expect(journal.entries.some((entry) => entry.tag === '0002_billing_carts')).toBe(true);
    const sql = readFileSync(join(migrationsDir, '0002_billing_carts.sql'), 'utf8');
    expect(sql).toContain('billing_carts');
    expect(sql).toContain('billing_cart_lines');
  });
});

describe('pendingMigrationStatements', () => {
  const bundle = {
    journal: {
      entries: [
        { idx: 0, when: 100, tag: '0000_init' },
        { idx: 1, when: 200, tag: '0001_next' },
      ],
    },
    migrations: {
      m0000: 'CREATE TABLE a (id text);\n--> statement-breakpoint\nCREATE INDEX a_id ON a (id);',
      m0001: 'ALTER TABLE a ADD COLUMN note text;',
    },
  };

  it('runs every statement when the journal is empty', () => {
    expect(pendingMigrationStatements(bundle, null)).toEqual([
      {
        createdAt: 100,
        statements: ['CREATE TABLE a (id text);', 'CREATE INDEX a_id ON a (id);'],
      },
      {
        createdAt: 200,
        statements: ['ALTER TABLE a ADD COLUMN note text;'],
      },
    ]);
  });

  it('skips migrations already recorded', () => {
    expect(pendingMigrationStatements(bundle, 100).map((entry) => entry.createdAt)).toEqual([200]);
  });

  it('throws when a journal entry has no SQL file', () => {
    expect(() =>
      pendingMigrationStatements(
        { ...bundle, migrations: { m0000: 'SELECT 1;' } },
        null,
      ),
    ).toThrow(/0001_next/);
  });
});

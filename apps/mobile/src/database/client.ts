import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

export function createDb(sqlite: SQLiteDatabase): AppDatabase {
  return drizzle(sqlite, { schema });
}

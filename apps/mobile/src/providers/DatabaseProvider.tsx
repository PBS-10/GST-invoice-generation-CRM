import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '../components/common/AppText';
import { Icon } from '../components/common/Icon';
import { ErrorState } from '../components/common/States';
import { applyMigrations } from '../database/applyMigrations';
import { createDb, type AppDatabase } from '../database/client';
import migrations from '../database/migrations/migrations';
import { createRepositories, type Repositories } from '../database/repositories';
import { seedIfEmpty } from '../database/seed';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/theme';
import { errorMessage } from '../utils/errors';
import { logger } from '../utils/logger';

type DatabaseContextValue = {
  db: AppDatabase;
  repos: Repositories;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

/** Stable — SQLiteProvider remounts (and closes the DB) if `options` identity changes. */
const SQLITE_OPEN_OPTIONS = { enableChangeListener: false };

export function useDatabase(): DatabaseContextValue {
  const value = useContext(DatabaseContext);
  if (!value) {
    throw new Error('useDatabase must be used inside DatabaseProvider');
  }
  return value;
}

function DatabaseReady({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => createDb(sqlite), [sqlite]);
  const repos = useMemo(() => createRepositories(db), [db]);
  return (
    <DatabaseContext.Provider value={{ db, repos }}>{children}</DatabaseContext.Provider>
  );
}

async function initializeDatabase(sqlite: SQLiteDatabase): Promise<void> {
  await sqlite.execAsync('PRAGMA foreign_keys = ON;');
  await applyMigrations(sqlite, migrations);
  const db = createDb(sqlite);
  await seedIfEmpty(db);
  logger.info('database_ready');
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  // Must be stable: expo-sqlite's SQLiteProvider tears down + closeAsync() whenever
  // onInit / options change, which surfaces as "Access to closed resource" on screens.
  const onInit = useCallback(async (sqlite: SQLiteDatabase) => {
    try {
      await initializeDatabase(sqlite);
    } catch (initError) {
      logger.error('database_init_failed', { message: errorMessage(initError) });
      setError(errorMessage(initError));
      throw initError;
    }
  }, []);

  if (error) {
    return <DatabaseError message={error} />;
  }

  return (
    <SQLiteProvider databaseName="invoice-gst.db" options={SQLITE_OPEN_OPTIONS} onInit={onInit}>
      <DatabaseReady>{children}</DatabaseReady>
    </SQLiteProvider>
  );
}

function DatabaseError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.centre, { backgroundColor: colors.background }]}>
      <ErrorState
        title="Couldn't open your ledger"
        message={`Close and reopen the app to try again.\n\nDetails: ${message}`}
      />
    </View>
  );
}

/** Branded launch state while the local database opens and migrates. */
export function DatabaseFallback() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.centre, { backgroundColor: colors.background }]}
      accessibilityLabel="Opening your ledger"
    >
      <View style={[styles.mark, { backgroundColor: colors.hero }]}>
        <Icon name="receipt-outline" size={30} color={colors.onHero} />
      </View>
      <Text variant="h3">GST Invoice</Text>
      <View style={styles.status}>
        <ActivityIndicator color={colors.textSecondary} size="small" />
        <Text variant="bodySmall" tone="secondary">
          Opening your ledger…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[3],
    padding: space[6],
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.large + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});

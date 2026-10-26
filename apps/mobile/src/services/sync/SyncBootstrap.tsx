import { useEffect } from 'react';
import { useDatabase } from '../../providers/DatabaseProvider';
import { registerBackgroundSync, setBackgroundSyncDeps } from './backgroundTask';
import { isCloudBackupEnabled } from './config';
import { setSyncWriteListener } from './syncNotify';
import { scheduleSyncSoon, startSyncScheduler } from './syncScheduler';

/** Starts cloud backup sync when EXPO_PUBLIC_API_URL is set. Billing screens do not import this. */
export function SyncBootstrap() {
  const { db, repos } = useDatabase();

  useEffect(() => {
    if (!isCloudBackupEnabled()) {
      return;
    }
    const deps = { db, repos };
    setBackgroundSyncDeps(deps);
    void registerBackgroundSync();
    const stop = startSyncScheduler(deps);
    setSyncWriteListener(() => scheduleSyncSoon(deps));
    return () => {
      stop?.();
      setSyncWriteListener(null);
      setBackgroundSyncDeps(null);
    };
  }, [db, repos]);

  return null;
}

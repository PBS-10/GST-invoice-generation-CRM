import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import type { AppDatabase } from '../../database/client';
import type { Repositories } from '../../database/repositories';
import { store } from '../../store';
import { backupActions } from '../../store/slices/backupSlice';
import { nextBackoffMs } from './backoff';
import { isCloudBackupEnabled } from './config';
import { runSync } from './syncEngine';

type Deps = { db: AppDatabase; repos: Repositories };

let started = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let failCount = 0;

export function startSyncScheduler(deps: Deps) {
  if (started || !isCloudBackupEnabled()) {
    return;
  }
  started = true;

  void refreshBackupState(deps);

  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') {
      void refreshBackupState(deps);
    }
  };
  const appSub = AppState.addEventListener('change', onAppState);

  const netSub = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void refreshBackupState(deps);
      return;
    }
    const current = store.getState().backup;
    store.dispatch(
      backupActions.setBackupState({
        status: current.accountEmail ? 'paused_network' : 'anonymous',
        lastSyncAt: current.lastSyncAt,
        pendingCount: current.pendingCount,
        lastError: current.lastError,
        accountEmail: current.accountEmail,
      }),
    );
  });

  intervalTimer = setInterval(() => {
    void refreshBackupState(deps);
  }, 120_000);

  return () => {
    started = false;
    appSub.remove();
    netSub();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (intervalTimer) {
      clearInterval(intervalTimer);
    }
    if (backoffTimer) {
      clearTimeout(backoffTimer);
    }
  };
}

export function scheduleSyncSoon(deps: Deps) {
  if (!isCloudBackupEnabled()) {
    return;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    void refreshBackupState(deps);
  }, 5_000);
}

export async function refreshBackupState(deps: Deps) {
  if (!isCloudBackupEnabled()) {
    store.dispatch(
      backupActions.setBackupState({
        status: 'anonymous',
        lastSyncAt: null,
        pendingCount: 0,
        lastError: null,
        accountEmail: null,
      }),
    );
    return;
  }
  store.dispatch(backupActions.setSyncing());
  const outcome = await runSync(deps);
  store.dispatch(backupActions.setBackupState(outcome));
  if (
    outcome.status === 'paused_network' ||
    outcome.status === 'needs_attention'
  ) {
    failCount += 1;
    if (backoffTimer) {
      clearTimeout(backoffTimer);
    }
    backoffTimer = setTimeout(() => {
      void refreshBackupState(deps);
    }, nextBackoffMs(failCount));
  } else if (outcome.status === 'synced') {
    failCount = 0;
  }
}

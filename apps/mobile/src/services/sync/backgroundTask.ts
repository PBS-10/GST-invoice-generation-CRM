import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { AppDatabase } from '../../database/client';
import type { Repositories } from '../../database/repositories';
import { isCloudBackupEnabled } from './config';
import { runSync } from './syncEngine';

export const BACKGROUND_SYNC_TASK = 'gst-invoice-background-sync';

let deps: { db: AppDatabase; repos: Repositories } | null = null;

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  if (!deps || !isCloudBackupEnabled()) {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
  try {
    await runSync(deps);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export function setBackgroundSyncDeps(next: { db: AppDatabase; repos: Repositories } | null) {
  deps = next;
}

export async function registerBackgroundSync(): Promise<void> {
  if (!isCloudBackupEnabled() || Platform.OS === 'web') {
    return;
  }
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    return;
  }
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (!isRegistered) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15,
    });
  }
}

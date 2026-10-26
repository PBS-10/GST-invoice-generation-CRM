import type { BackupStatus } from '@invoice-gst/types';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type BackupState = {
  status: BackupStatus;
  lastSyncAt: string | null;
  pendingCount: number;
  lastError: string | null;
  accountEmail: string | null;
  bannerDismissedDate: string | null;
};

const initialState: BackupState = {
  status: 'anonymous',
  lastSyncAt: null,
  pendingCount: 0,
  lastError: null,
  accountEmail: null,
  bannerDismissedDate: null,
};

const backupSlice = createSlice({
  name: 'backup',
  initialState,
  reducers: {
    setBackupState(state, action: PayloadAction<Omit<BackupState, 'bannerDismissedDate'>>) {
      state.status = action.payload.status;
      state.lastSyncAt = action.payload.lastSyncAt;
      state.pendingCount = action.payload.pendingCount;
      state.lastError = action.payload.lastError;
      state.accountEmail = action.payload.accountEmail;
    },
    setSyncing(state) {
      state.status = 'syncing';
    },
    dismissBannerForToday(state) {
      state.bannerDismissedDate = new Date().toISOString().slice(0, 10);
    },
  },
});

export const backupActions = backupSlice.actions;
export const backupReducer = backupSlice.reducer;

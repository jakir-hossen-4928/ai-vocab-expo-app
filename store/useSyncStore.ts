import { syncOrchestrator, type SyncProgress, type SyncStatus } from '@/services/syncService';
import { create } from 'zustand';

interface SyncState {
  isActive: boolean;
  isOffline: boolean;
  lastSyncTime: number;
  nextScheduledSync: number;
  pendingChanges: number;
  vocabularyProgress: SyncProgress | undefined;
  resourceProgress: SyncProgress | undefined;
  showSyncModal: boolean;
  
  // Actions
  setSyncStatus: (status: SyncStatus) => void;
  setVocabularyProgress: (progress: SyncProgress | undefined) => void;
  setResourceProgress: (progress: SyncProgress | undefined) => void;
  setShowSyncModal: (show: boolean) => void;
  startSync: () => Promise<void>;
  startDeltaSync: () => Promise<void>;
  cancelSync: () => Promise<void>;
  updateFromOrchestrator: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isActive: false,
  isOffline: false,
  lastSyncTime: 0,
  nextScheduledSync: 0,
  pendingChanges: 0,
  vocabularyProgress: undefined,
  resourceProgress: undefined,
  showSyncModal: false,

  setSyncStatus: (status) => set({
    isActive: status.isActive,
    isOffline: status.isOffline,
    lastSyncTime: status.lastSyncTime,
    nextScheduledSync: status.nextScheduledSync,
    pendingChanges: status.pendingChanges,
  }),

  setVocabularyProgress: (vocabularyProgress) => set({ vocabularyProgress }),
  setResourceProgress: (resourceProgress) => set({ resourceProgress }),
  setShowSyncModal: (showSyncModal) => set({ showSyncModal }),

  startSync: async () => {
    try {
      await syncOrchestrator.startFullSync((progress) => {
        if (progress.collection === 'vocabularies') {
          set({ vocabularyProgress: progress });
        } else if (progress.collection === 'resources') {
          set({ resourceProgress: progress });
        }
      });
    } catch (error) {
      console.error('Error starting sync:', error);
    }
  },

  startDeltaSync: async () => {
    try {
      await syncOrchestrator.startDeltaSync();
    } catch (error) {
      console.error('Error starting delta sync:', error);
    }
  },

  cancelSync: async () => {
    try {
      await syncOrchestrator.cancelAllSyncs();
    } catch (error) {
      console.error('Error cancelling sync:', error);
    }
  },

  updateFromOrchestrator: () => {
    const status = syncOrchestrator.getSyncStatus();
    set({
      isActive: status.isActive,
      isOffline: status.isOffline,
      lastSyncTime: status.lastSyncTime,
      nextScheduledSync: status.nextScheduledSync,
      pendingChanges: status.pendingChanges,
      vocabularyProgress: syncOrchestrator.getProgress('vocabularies'),
      resourceProgress: syncOrchestrator.getProgress('resources'),
    });
  },
}));

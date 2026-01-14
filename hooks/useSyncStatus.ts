
import { useSyncStore } from '@/store/useSyncStore';

export function useSyncStatus() {
    const {
        isActive,
        isOffline,
        lastSyncTime,
        nextScheduledSync,
        pendingChanges,
        vocabularyProgress,
        resourceProgress,
        startSync,
        startDeltaSync,
        cancelSync
    } = useSyncStore();

    return {
        isActive,
        isOffline,
        lastSyncTime,
        nextScheduledSync,
        pendingChanges,
        vocabularyProgress,
        resourceProgress,
        allProgress: [], // Legacy compat
        startSync,
        startDeltaSync,
        cancelSync
    };
}

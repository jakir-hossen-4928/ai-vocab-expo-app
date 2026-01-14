import { subscribeToDataChanges } from '@/services/api';
import { initDatabase } from '@/services/offlineStorage';
import { getInitialSyncDone, migrateSecureStoreData } from '@/services/storage';
import { syncOrchestrator } from '@/services/syncService';
import * as SplashScreen from 'expo-splash-screen';
import { create } from 'zustand';
import { useSyncStore } from './useSyncStore';

interface AppState {
  isReady: boolean;
  
  // Actions
  setIsReady: (isReady: boolean) => void;
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  isReady: false,
  
  setIsReady: (isReady) => set({ isReady }),
  
  initialize: async () => {
    try {
      console.log("🏗️ APP INITIALIZING...");
      
      // Hide native splash screen almost immediately to show our custom JS-based splash/loading
      // We wait 200ms to ensure the first frame of LoadingScreen is rendered
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 200);

      // Initialize offline-first SQLite database
      await initDatabase();
      
      // Migrate legacy favorites/bookmarks
      await migrateSecureStoreData();

      // Initialize sync orchestrator
      await syncOrchestrator.initialize();

      // Check if initial sync is needed
      const isInitialSyncDone = await getInitialSyncDone();
      const syncStore = useSyncStore.getState();

      if (!isInitialSyncDone) {
        console.log("🔄 First launch - starting initial sync...");
        
        // Start full sync in the background (don't await fully yet)
        syncStore.startSync();

        // Wait for at least 200 vocabularies to be synced OR completion
        // to show the Home screen faster
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 30000); // 30s safety timeout
          
          const unsubscribe = useSyncStore.subscribe((state) => {
            const vocabSynced = state.vocabularyProgress?.syncedItems || 0;
            const isComplete = state.vocabularyProgress?.isComplete || false;
            
            if (vocabSynced >= 200 || isComplete) {
              console.log(`✅ Initial batch ready or complete: ${vocabSynced} items. Revealing app.`);
              clearTimeout(timeout);
              unsubscribe();
              resolve();
            }
          });
        });
      } else {
        console.log("✅ App already synced - starting background delta sync...");
        syncStore.startDeltaSync().catch((e) => console.warn("Background sync error:", e));
      }

      // Start real-time sync listeners
      subscribeToDataChanges();
      
    } catch (e) {
      console.warn("Error initializing app:", e);
    } finally {
      set({ isReady: true });
    }
  },
}));

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
} from "firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { AppState, AppStateStatus } from "react-native";
import { db } from "./firebaseConfig";
import {
  cacheResources,
  cacheVocabularies,
  getLatestUpdatedTimestamp,
  isCacheEmpty,
} from "./offlineStorage";
import * as Storage from "./storage";
import { queryClient } from "./queryClient";
import type { Resource, Vocabulary } from "@/types";

// ===== TYPES =====

export interface SyncProgress {
  collection: string;
  totalItems: number;
  syncedItems: number;
  currentChunk: number;
  totalChunks: number;
  isComplete: boolean;
  error?: string;
  startTime?: number;
  estimatedTimeRemaining?: number;
}

export interface SyncStatus {
  isActive: boolean;
  collections: Map<string, SyncProgress>;
  lastSyncTime: number;
  nextScheduledSync: number;
  pendingChanges: number;
  isOffline: boolean;
}

export interface SyncOptions {
  chunkSize?: number;
  initialBatchOnly?: boolean;
  onProgress?: (progress: SyncProgress) => void;
  forceFullSync?: boolean;
}

type SyncCollection = "vocabularies" | "resources";

// ===== SYNC ORCHESTRATOR =====

class SyncOrchestrator {
  private activeSyncs: Map<string, boolean> = new Map();
  private syncProgress: Map<string, SyncProgress> = new Map();
  private lastSyncTimes: Map<string, number> = new Map();
  private syncTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private isOffline = false;
  private appState: AppStateStatus = "active";
  private progressCallbacks: Map<string, ((progress: SyncProgress) => void)[]> =
    new Map();

  // Configuration
  private readonly SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly DEFAULT_CHUNK_SIZE = 200;
  private readonly MAX_RETRY_COUNT = 3;

  constructor() {
    this.setupNetworkListener();
    this.setupAppStateListener();
  }

  // ===== INITIALIZATION =====

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("🔧 Initializing Sync Orchestrator...");

    // Load last sync times from storage
    const vocabLastSync = await Storage.getLastSyncTime("vocabularies");
    const resourceLastSync = await Storage.getLastSyncTime("resources");

    if (vocabLastSync) this.lastSyncTimes.set("vocabularies", vocabLastSync);
    if (resourceLastSync) this.lastSyncTimes.set("resources", resourceLastSync);

    this.isInitialized = true;
    console.log("✅ Sync Orchestrator initialized");
  }

  // ===== NETWORK & APP STATE MONITORING =====

  private setupNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = this.isOffline;
      this.isOffline = !state.isConnected;

      if (wasOffline && !this.isOffline) {
        console.log("📡 Network restored, triggering delta sync...");
        this.startDeltaSync().catch((e) =>
          console.warn("Auto-sync after network restore failed:", e)
        );
      }
    });
  }

  private setupAppStateListener(): void {
    AppState.addEventListener("change", (nextAppState) => {
      const wasBackground = this.appState === "background";
      this.appState = nextAppState;

      if (wasBackground && nextAppState === "active") {
        console.log("📱 App returned to foreground, checking for updates...");
        this.startDeltaSync().catch((e) =>
          console.warn("Auto-sync on foreground failed:", e)
        );
      }
    });
  }

  // ===== SYNC ORCHESTRATION =====

  async startFullSync(
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    if (this.isOffline) {
      console.warn("⚠️ Cannot start full sync: Device is offline");
      throw new Error("Device is offline");
    }

    console.log("🔄 Starting full sync...");

    // Sync vocabularies first (higher priority)
    await this.syncCollection("vocabularies", {
      chunkSize: this.DEFAULT_CHUNK_SIZE,
      onProgress,
      forceFullSync: true,
    });

    // Then sync resources
    await this.syncCollection("resources", {
      chunkSize: this.DEFAULT_CHUNK_SIZE,
      onProgress,
      forceFullSync: true,
    });

    // Mark initial sync as complete
    await Storage.setInitialSyncDone(true);

    // Start background sync scheduler
    this.startBackgroundSync();

    console.log("✅ Full sync complete");
  }

  async startDeltaSync(): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    if (this.isOffline) {
      console.log("⚠️ Skipping delta sync: Device is offline");
      return;
    }

    const isInitialSyncDone = await Storage.getInitialSyncDone();
    if (!isInitialSyncDone) {
      console.log("⚠️ Initial sync not done, skipping delta sync");
      return;
    }

    console.log("🔄 Starting delta sync...");

    // Sync both collections in parallel
    await Promise.all([
      this.syncCollection("vocabularies", { forceFullSync: false }),
      this.syncCollection("resources", { forceFullSync: false }),
    ]);

    console.log("✅ Delta sync complete");
  }

  async syncCollection(
    collectionName: SyncCollection,
    options: SyncOptions = {}
  ): Promise<number> {
    // Prevent concurrent syncs of the same collection
    if (this.activeSyncs.get(collectionName)) {
      console.log(`⏸️ Sync already in progress for ${collectionName}`);
      return 0;
    }

    this.activeSyncs.set(collectionName, true);

    try {
      const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
      const forceFullSync = options.forceFullSync || false;

      // Register progress callback
      if (options.onProgress) {
        this.addProgressCallback(collectionName, options.onProgress);
      }

      // Initialize progress
      const progress: SyncProgress = {
        collection: collectionName,
        totalItems: 0,
        syncedItems: 0,
        currentChunk: 0,
        totalChunks: 0,
        isComplete: false,
        startTime: Date.now(),
      };
      this.syncProgress.set(collectionName, progress);
      this.emitProgress(collectionName, progress);

      let totalSynced = 0;

      if (forceFullSync) {
        // Full sync with chunking
        totalSynced = await this.performFullSync(collectionName, chunkSize);
      } else {
        // Delta sync (only new/updated items)
        totalSynced = await this.performDeltaSync(collectionName);
      }

      // Update completion status
      progress.isComplete = true;
      progress.syncedItems = totalSynced;
      progress.totalItems = totalSynced;
      this.syncProgress.set(collectionName, progress);
      this.emitProgress(collectionName, progress);

      // Update last sync time
      const now = Date.now();
      this.lastSyncTimes.set(collectionName, now);
      await Storage.setLastSyncTime(collectionName, now);

      return totalSynced;
    } catch (error) {
      console.error(`❌ Sync error for ${collectionName}:`, error);

      const progress = this.syncProgress.get(collectionName);
      if (progress) {
        progress.error =
          error instanceof Error ? error.message : "Unknown error";
        progress.isComplete = true;
        this.emitProgress(collectionName, progress);
      }

      throw error;
    } finally {
      this.activeSyncs.set(collectionName, false);
      this.removeProgressCallbacks(collectionName);
    }
  }

  // ===== FULL SYNC (CHUNKED) =====

  private async performFullSync(
    collectionName: SyncCollection,
    chunkSize: number
  ): Promise<number> {
    console.log(
      `📦 Starting chunked full sync for ${collectionName} (chunk size: ${chunkSize})`
    );

    const firestoreCollection =
      collectionName === "vocabularies" ? "vocabularies" : "grammar_images";
    const collectionRef = collection(db, firestoreCollection);

    let totalFetched = 0;
    let lastDocSnapshot: any = null;
    let chunkNumber = 0;

    while (true) {
      chunkNumber++;

      // Build query
      const queryConstraints: any[] = [
        orderBy("createdAt", "desc"),
        limit(chunkSize),
      ];

      if (lastDocSnapshot) {
        queryConstraints.push(startAfter(lastDocSnapshot));
      }

      const q = query(collectionRef, ...queryConstraints);

      // Fetch chunk
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (queryError: any) {
        console.warn(
          `⚠️ Query failed for ${collectionName}, trying fallback...`,
          queryError?.message
        );

        // Fallback: unordered query
        if (!lastDocSnapshot) {
          const fallbackQ = query(collectionRef, limit(chunkSize));
          snapshot = await getDocs(fallbackQ);
        } else {
          break; // Can't continue pagination without order
        }
      }

      if (snapshot.empty) {
        console.log(
          `✅ Completed full sync for ${collectionName} (${totalFetched} items)`
        );
        break;
      }

      // Process and cache chunk
      await this.processAndCacheChunk(collectionName, snapshot.docs);

      totalFetched += snapshot.size;
      lastDocSnapshot = snapshot.docs[snapshot.docs.length - 1];

      // Update progress
      const progress = this.syncProgress.get(collectionName);
      if (progress) {
        progress.syncedItems = totalFetched;
        progress.currentChunk = chunkNumber;
        progress.estimatedTimeRemaining = this.calculateETA(progress);
        this.emitProgress(collectionName, progress);
      }

      console.log(
        `📦 Synced chunk ${chunkNumber} for ${collectionName} (${totalFetched} items total)`
      );

      // Yield to UI thread
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return totalFetched;
  }

  // ===== DELTA SYNC =====

  private async performDeltaSync(
    collectionName: SyncCollection
  ): Promise<number> {
    const latestTs = await getLatestUpdatedTimestamp(collectionName);

    if (!latestTs) {
      console.log(
        `⚠️ No timestamp found for ${collectionName}, skipping delta sync`
      );
      return 0;
    }

    console.log(
      `🔄 Delta sync for ${collectionName} since:`,
      new Date(latestTs).toISOString()
    );

    const firestoreCollection =
      collectionName === "vocabularies" ? "vocabularies" : "grammar_images";
    const collectionRef = collection(db, firestoreCollection);
    const lastDate = new Date(latestTs);

    // Query for items updated after last sync
    const q = query(
      collectionRef,
      where("updated_at", ">", Timestamp.fromDate(lastDate)),
      orderBy("updated_at", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`✅ ${collectionName} already up to date`);
      return 0;
    }

    console.log(`☁️ Found ${snapshot.size} new/updated ${collectionName}`);

    // Process and cache
    await this.processAndCacheChunk(collectionName, snapshot.docs);

    return snapshot.size;
  }

  // ===== DATA PROCESSING =====

  private async processAndCacheChunk(
    collectionName: SyncCollection,
    docs: any[]
  ): Promise<void> {
    if (collectionName === "vocabularies") {
      const items = docs
        .map((doc) => this.mapVocabularyDoc(doc))
        .filter((item) => item.english && item.bangla);
      if (items.length > 0) {
        await cacheVocabularies(items);
        queryClient.invalidateQueries({ queryKey: ["vocabularies"] });
      }
    } else {
      const items = docs.map((doc) => this.mapResourceDoc(doc));
      if (items.length > 0) {
        await cacheResources(items);
        queryClient.invalidateQueries({ queryKey: ["resources"] });
      }
    }
  }

  private mapVocabularyDoc(doc: any): Vocabulary {
    const data = doc.data();
    const createdAt = data.created_at?.toDate?.()
      ? data.created_at.toDate().toISOString()
      : data.created_at || data.createdAt || new Date().toISOString();
    const updatedAt = data.updated_at?.toDate?.()
      ? data.updated_at.toDate().toISOString()
      : data.updated_at || data.updatedAt || new Date().toISOString();

    return {
      id: doc.id,
      ...data,
      english: data.english || "",
      bangla: data.bangla || "",
      partOfSpeech: (
        data.part_of_speech ||
        data.partOfSpeech ||
        "noun"
      ).toLowerCase(),
      examples: Array.isArray(data.examples)
        ? data.examples
        : typeof data.examples === "string"
        ? JSON.parse(data.examples)
        : [],
      createdAt,
      updatedAt,
    } as Vocabulary;
  }

  private mapResourceDoc(doc: any): Resource {
    const data = doc.data();
    const createdAt = data.created_at?.toDate?.()
      ? data.created_at.toDate().toISOString()
      : data.created_at || data.createdAt || new Date().toISOString();
    const updatedAt = data.updated_at?.toDate?.()
      ? data.updated_at.toDate().toISOString()
      : data.updated_at || data.updatedAt || new Date().toISOString();

    return {
      id: doc.id,
      ...data,
      title: data.title || "",
      description: data.description || "",
      imageUrl: data.imageUrl || data.url || "",
      slug: data.slug || doc.id,
      createdAt,
      updatedAt,
    } as Resource;
  }

  // ===== BACKGROUND SYNC =====

  startBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    console.log(
      `⏰ Starting background sync (every ${
        this.SYNC_INTERVAL_MS / 1000 / 60
      } minutes)`
    );

    this.syncTimer = setInterval(() => {
      if (this.appState === "active" && !this.isOffline) {
        console.log("⏰ Background sync triggered");
        this.startDeltaSync().catch((e) =>
          console.warn("Background sync failed:", e)
        );
      }
    }, this.SYNC_INTERVAL_MS);
  }

  stopBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log("⏸️ Background sync stopped");
    }
  }

  // ===== PROGRESS TRACKING =====

  private addProgressCallback(
    collection: string,
    callback: (progress: SyncProgress) => void
  ): void {
    const callbacks = this.progressCallbacks.get(collection) || [];
    callbacks.push(callback);
    this.progressCallbacks.set(collection, callbacks);
  }

  private removeProgressCallbacks(collection: string): void {
    this.progressCallbacks.delete(collection);
  }

  private emitProgress(collection: string, progress: SyncProgress): void {
    const callbacks = this.progressCallbacks.get(collection) || [];
    callbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.error("Error in progress callback:", error);
      }
    });
  }

  private calculateETA(progress: SyncProgress): number {
    if (!progress.startTime || progress.syncedItems === 0) return 0;

    const elapsed = Date.now() - progress.startTime;
    const itemsPerMs = progress.syncedItems / elapsed;
    const remainingItems = progress.totalItems - progress.syncedItems;

    return remainingItems / itemsPerMs;
  }

  // ===== STATUS & CONTROL =====

  getSyncStatus(): SyncStatus {
    return {
      isActive: Array.from(this.activeSyncs.values()).some((active) => active),
      collections: new Map(this.syncProgress),
      lastSyncTime: Math.max(...Array.from(this.lastSyncTimes.values()), 0),
      nextScheduledSync: this.syncTimer
        ? Date.now() + this.SYNC_INTERVAL_MS
        : 0,
      pendingChanges: 0, // TODO: Implement pending changes queue
      isOffline: this.isOffline,
    };
  }

  async cancelAllSyncs(): Promise<void> {
    console.log("🛑 Cancelling all syncs...");
    this.activeSyncs.clear();
    this.syncProgress.clear();
    this.stopBackgroundSync();
  }

  getProgress(collection: string): SyncProgress | undefined {
    return this.syncProgress.get(collection);
  }
}

// ===== SINGLETON INSTANCE =====

export const syncOrchestrator = new SyncOrchestrator();

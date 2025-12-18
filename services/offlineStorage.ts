import type { Resource as ResourceType, Vocabulary as VocabularyType } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import Realm from 'realm';
import { FlashcardActivity, getRealm, LearningProgress, Resource, SearchCache, SyncMetadata, Vocabulary } from './realm';

let realmInstance: Realm | null = null;
let initPromise: Promise<void> | null = null;

// Cache expiry: 30 minutes (aligned with web app for better sync)
const CACHE_EXPIRY_MS = 1000 * 60 * 30;

export const initDatabase = async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            realmInstance = await getRealm();

            // 1. Perform Legacy Data Migration (SQLite -> Realm)
            await performLegacyMigration();

            // 2. Force one-time resync to fix transition if needed (already handled by migration v5 marker)
            const resyncCheck = realmInstance.objectForPrimaryKey(SyncMetadata, 'vocabularies_resync_v5');
            if (!resyncCheck) {
                console.log('🔄 Realm Transition: Clearing local cache for a fresh deep sync...');
                realmInstance.write(() => {
                    realmInstance!.delete(realmInstance!.objects(Vocabulary));
                    realmInstance!.delete(realmInstance!.objects(SyncMetadata));
                    realmInstance!.create(SyncMetadata, {
                        collection: 'vocabularies_resync_v5',
                        lastSync: Date.now(),
                        itemCount: 0
                    });
                });
            }

            console.log('✅ Realm Database initialized with offline-first schemas');
        } catch (error) {
            console.error('❌ Error initializing Realm database:', error);
            initPromise = null;
            throw error;
        }
    })();

    return initPromise;
};

const performLegacyMigration = async () => {
    const MIGRATION_KEY = 'sqlite_to_realm_migration_v1';
    const isMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (isMigrated === 'true') return;

    console.log('📦 Starting Legacy Data Migration (SQLite -> Realm)...');
    let legacyDb: SQLite.SQLiteDatabase | null = null;

    try {
        legacyDb = await SQLite.openDatabaseAsync('vocab.db');

        // --- 1. Migrate Favorites ---
        const favorites: any[] = await legacyDb.getAllAsync('SELECT vocabulary_id FROM favorites');
        if (favorites.length > 0) {
            console.log(`⭐ Migrating ${favorites.length} favorites...`);
            realmInstance!.write(() => {
                favorites.forEach(fav => {
                    const vocab = realmInstance!.objectForPrimaryKey(Vocabulary, fav.vocabulary_id);
                    if (vocab) vocab.isFavorite = true;
                });
            });
        }

        // --- 2. Migrate Bookmarks ---
        const bookmarks: any[] = await legacyDb.getAllAsync('SELECT resource_id FROM bookmarks');
        if (bookmarks.length > 0) {
            console.log(`🔖 Migrating ${bookmarks.length} bookmarks...`);
            realmInstance!.write(() => {
                bookmarks.forEach(bm => {
                    const res = realmInstance!.objectForPrimaryKey(Resource, bm.resource_id);
                    if (res) res.isBookmarked = true;
                });
            });
        }

        // --- 3. Migrate Learning Progress (SRS) ---
        const progress: any[] = await legacyDb.getAllAsync('SELECT * FROM vocabulary_learning_progress');
        if (progress.length > 0) {
            console.log(`📈 Migrating ${progress.length} SRS progress records...`);
            realmInstance!.write(() => {
                progress.forEach(p => {
                    realmInstance!.create(LearningProgress, {
                        vocabularyId: p.vocabulary_id,
                        status: p.status,
                        nextReview: p.next_review,
                        interval: p.interval,
                        easeFactor: p.ease_factor,
                        repetitions: p.repetitions,
                        lastReviewed: p.last_reviewed,
                        isDifficult: p.is_difficult === 1
                    }, Realm.UpdateMode.Modified);
                });
            });
        }

        // --- 4. Migrate Flashcard Activity ---
        const activity: any[] = await legacyDb.getAllAsync('SELECT * FROM flashcard_activity');
        if (activity.length > 0) {
            console.log(`⏱️ Migrating ${activity.length} activity logs...`);
            realmInstance!.write(() => {
                activity.forEach(a => {
                    realmInstance!.create(FlashcardActivity, {
                        id: Math.floor(a.timestamp + Math.random() * 1000), // Ensure unique integer ID
                        vocabularyId: a.vocabulary_id,
                        action: a.action,
                        timestamp: a.timestamp
                    }, Realm.UpdateMode.Modified);
                });
            });
        }

        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
        console.log('✅ Legacy migration completed successfully.');
    } catch (error) {
        console.warn('⚠️ Legacy migration skipped or failed (likely no old DB):', error);
        // We still mark as migrated to avoid repeated failed attempts
        await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    }
};

// Queue for database write operations
let writeQueue: Promise<any> = Promise.resolve();

const queueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
    const currentQueue = writeQueue;
    const nextTask = (async () => {
        try {
            await currentQueue.catch(() => { });
            return await operation();
        } catch (error) {
            throw error;
        }
    })();

    writeQueue = nextTask.catch(() => { });
    return nextTask;
};

// ===== VOCABULARIES =====

export const cacheVocabularies = async (vocabularies: VocabularyType[]) => {
    if (!realmInstance) await initDatabase();
};

export const getCachedVocabularies = async (options?: { partOfSpeech?: string; search?: string; onlyFavorites?: boolean }): Promise<{ data: VocabularyType[], isStale: boolean }> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return { data: [], isStale: true };

    try {
        const metadata = realmInstance.objectForPrimaryKey(SyncMetadata, 'vocabularies');
        const isStale = !metadata || (Date.now() - metadata.lastSync > CACHE_EXPIRY_MS);

        // Diagnostic: Log total count
        const totalCount = realmInstance.objects(Vocabulary).length;
        console.log(`📊 Realm Database: ${totalCount} vocabularies found in cache.`);

        let results = realmInstance.objects(Vocabulary);

        if (options?.onlyFavorites) {
            results = results.filtered('isFavorite == true');
        }

        if (options?.partOfSpeech && options.partOfSpeech !== 'all') {
            results = results.filtered('partOfSpeech == $0', options.partOfSpeech.toLowerCase());
        }

        if (options?.search) {
            const searchTerm = options.search.trim().toLowerCase();
            results = results.filtered('english CONTAINS[c] $0 OR bangla CONTAINS[c] $0', searchTerm);
            console.log(`🔍 Realm Searching for: "${searchTerm}"`);
        }

        // Sorting
        const sortedResults = options?.onlyFavorites
            ? results.sorted('updatedAtTs', true)
            : results.sorted([['updatedAtTs', true], ['id', true]]);

        const data = sortedResults.map(v => JSON.parse(v.data) as VocabularyType);

        return { data, isStale };
    } catch (error) {
        console.error('❌ Error getting cached vocabularies from Realm:', error);
        return { data: [], isStale: true };
    }
};

// ===== RESOURCES =====

export const cacheResources = async (resources: ResourceType[]) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();

            realmInstance!.write(() => {
                for (const resourceData of resources) {
                    const updatedAt = new Date(resourceData.createdAt || resourceData.created_at || 0).getTime();
                    realmInstance!.create('Resource', {
                        id: resourceData.id,
                        title: resourceData.title || null,
                        description: resourceData.description || null,
                        data: JSON.stringify(resourceData),
                        cachedAt: now,
                        updatedAtTs: updatedAt
                    }, Realm.UpdateMode.Modified);
                }
                // Update sync metadata
                realmInstance!.create(SyncMetadata, {
                    collection: 'grammar_images',
                    lastSync: now,
                    itemCount: resources.length
                }, Realm.UpdateMode.Modified);
            });

            console.log(`✅ Realm: Cached ${resources.length} grammar images`);
        } catch (error) {
            console.error('❌ Error caching grammar images in Realm:', error);
            throw error;
        }
    });
};

export const getCachedResources = async (options?: { search?: string; onlyBookmarks?: boolean }): Promise<{ data: ResourceType[], isStale: boolean }> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return { data: [], isStale: true };

    try {
        const metadata = realmInstance.objectForPrimaryKey(SyncMetadata, 'grammar_images');
        const isStale = !metadata || (Date.now() - metadata.lastSync > CACHE_EXPIRY_MS);

        let results = realmInstance.objects(Resource);

        if (options?.onlyBookmarks) {
            results = results.filtered('isBookmarked == true');
        }

        if (options?.search) {
            const searchTerm = options.search.trim().toLowerCase();
            results = results.filtered('title CONTAINS[c] $0 OR description CONTAINS[c] $0', searchTerm);
            console.log(`🔍 Realm: Searching resources for: "${searchTerm}"`);
        }

        // Sorting
        const sortedResults = options?.onlyBookmarks
            ? results.sorted('updatedAtTs', true)
            : results.sorted([['updatedAtTs', true], ['id', true]]);

        const data = sortedResults.map(r => JSON.parse(r.data) as ResourceType);

        return { data, isStale };
    } catch (error) {
        console.error('❌ Error getting cached grammar images from Realm:', error);
        return { data: [], isStale: true };
    }
};

export const getVocabularyByIdFromCache = async (id: string): Promise<VocabularyType | null> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        const vocab = realmInstance.objectForPrimaryKey(Vocabulary, id);
        return vocab ? JSON.parse(vocab.data) : null;
    } catch (error) {
        console.error('❌ Error getting vocabulary from Realm:', error);
        return null;
    }
};

export const getResourceByIdFromCache = async (id: string): Promise<ResourceType | null> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        const resource = realmInstance.objectForPrimaryKey(Resource, id);
        return resource ? JSON.parse(resource.data) : null;
    } catch (error) {
        console.error('❌ Error getting resource from Realm:', error);
        return null;
    }
};

// Redundant functions removed - use cacheResources / getCachedResources instead

// ===== SEARCH CACHE =====

export const cacheSearchResult = async (query: string, result: any) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        try {
            realmInstance!.write(() => {
                realmInstance!.create('SearchCache', {
                    query,
                    result: JSON.stringify(result),
                    updatedAt: Date.now()
                }, Realm.UpdateMode.Modified);
            });
        } catch (error) {
            console.error('Error caching search result in Realm:', error);
        }
    });
};

// ===== SYNC METADATA =====

export const getCollectionMetadata = async (collection: string) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        const metadata = realmInstance.objectForPrimaryKey(SyncMetadata, collection);
        return metadata ? { lastSync: metadata.lastSync, itemCount: metadata.itemCount } : null;
    } catch (error) {
        console.error(`❌ Error getting ${collection} metadata from Realm:`, error);
        return null;
    }
};

export const updateLastSyncMetadata = async (collection: string, itemCount: number) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        try {
            realmInstance!.write(() => {
                realmInstance!.create('SyncMetadata', {
                    collection,
                    lastSync: Date.now(),
                    itemCount
                }, Realm.UpdateMode.Modified);
            });
        } catch (error) {
            console.error(`❌ Error updating ${collection} metadata in Realm:`, error);
        }
    });
};

export const getLatestUpdatedTimestamp = async (collectionName: string): Promise<string | null> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        const latest = collectionName === 'vocabularies'
            ? realmInstance.objects(Vocabulary).sorted('updatedAtTs', true)[0]
            : realmInstance.objects(Resource).sorted('updatedAtTs', true)[0];

        if (!latest) return null;
        return new Date(latest.updatedAtTs).toISOString();
    } catch (error) {
        console.error('❌ Error getting latest updated timestamp from Realm:', error);
        return null;
    }
};

export const getOldestUpdatedTimestamp = async (collectionName: string): Promise<string | null> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        const oldest = collectionName === 'vocabularies'
            ? realmInstance.objects(Vocabulary).sorted('updatedAtTs', false)[0]
            : realmInstance.objects(Resource).sorted('updatedAtTs', false)[0];

        if (!oldest) return null;
        return new Date(oldest.updatedAtTs).toISOString();
    } catch (error) {
        console.error('❌ Error getting oldest updated timestamp from Realm:', error);
        return null;
    }
};

export const isCacheEmpty = async (collectionName: string): Promise<boolean> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return true;

    try {
        const count = collectionName === 'vocabularies'
            ? realmInstance.objects(Vocabulary).length
            : realmInstance.objects(Resource).length;
        return count === 0;
    } catch (error) {
        console.error(`❌ Error checking if ${collectionName} cache is empty in Realm:`, error);
        return true;
    }
};

export const getCachedSearchResult = async (query: string) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        const result = realmInstance.objectForPrimaryKey(SearchCache, query);
        return result ? JSON.parse(result.result) : null;
    } catch (error) {
        console.error('Error getting cached search result from Realm:', error);
        return null;
    }
};

// ===== FAVORITES / BOOKMARKS =====

export const addFavoriteVocab = async (vocabId: string) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        const vocab = realmInstance!.objectForPrimaryKey(Vocabulary, vocabId);
        if (vocab) {
            realmInstance!.write(() => {
                vocab.isFavorite = true;
                vocab.updatedAtTs = Date.now(); // Mark as updated for sorting
            });
        }
    });
};

export const removeFavoriteVocab = async (vocabId: string) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        const vocab = realmInstance!.objectForPrimaryKey(Vocabulary, vocabId);
        if (vocab) {
            realmInstance!.write(() => {
                vocab.isFavorite = false;
            });
        }
    });
};

export const isVocabFavorited = async (vocabId: string): Promise<boolean> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return false;

    const vocab = realmInstance.objectForPrimaryKey(Vocabulary, vocabId);
    return vocab?.isFavorite || false;
};

export const getFavoriteVocabIds = async (): Promise<string[]> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return [];

    const favs = realmInstance.objects(Vocabulary).filtered('isFavorite == true');
    return favs.map(v => v.id);
};

export const addBookmarkResource = async (resourceId: string) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        const resource = realmInstance!.objectForPrimaryKey(Resource, resourceId);
        if (resource) {
            realmInstance!.write(() => {
                resource.isBookmarked = true;
                resource.updatedAtTs = Date.now();
            });
        }
    });
};

export const removeBookmarkResource = async (resourceId: string) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        const resource = realmInstance!.objectForPrimaryKey(Resource, resourceId);
        if (resource) {
            realmInstance!.write(() => {
                resource.isBookmarked = false;
            });
        }
    });
};

export const isResourceBookmarked = async (resourceId: string): Promise<boolean> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return false;

    const resource = realmInstance.objectForPrimaryKey(Resource, resourceId);
    return resource?.isBookmarked || false;
};

export const getBookmarkResourceIds = async (): Promise<string[]> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return [];

    const bookmarks = realmInstance.objects(Resource).filtered('isBookmarked == true');
    return bookmarks.map(r => r.id);
};


// ===== LEARNING / FLASHCARD PROGRESS (SRS) =====

export const getVocabulariesForSession = async (limit: number = 50, mode: 'mixed' | 'new' | 'review' | 'hardest' = 'mixed'): Promise<VocabularyType[]> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return [];

    try {
        const now = Date.now();
        let results: Realm.Results<Vocabulary>;

        if (mode === 'review') {
            const progressIds = realmInstance.objects(LearningProgress)
                .filtered('nextReview <= $0', now)
                .sorted('nextReview', false)
                .slice(0, limit)
                .map(p => p.vocabularyId);

            results = realmInstance.objects(Vocabulary).filtered('id IN $0', progressIds);
        } else if (mode === 'new') {
            const progressIds = realmInstance.objects(LearningProgress).map(p => p.vocabularyId);
            results = realmInstance.objects(Vocabulary).filtered('NOT (id IN $0 OR partOfSpeech == null)', progressIds);
            // Randomization is tricky in Realm, so we'll just slice. 
            // In a real app we might use a random seed or index.
        } else if (mode === 'hardest') {
            const progressIds = realmInstance.objects(LearningProgress)
                .filtered('isDifficult == true OR easeFactor < 2.0')
                .sorted('easeFactor', false)
                .slice(0, limit)
                .map(p => p.vocabularyId);

            results = realmInstance.objects(Vocabulary).filtered('id IN $0', progressIds);
        } else {
            // Mixed
            const dueIds = realmInstance.objects(LearningProgress)
                .filtered('nextReview <= $0', now)
                .sorted('nextReview', false)
                .slice(0, Math.floor(limit / 2))
                .map(p => p.vocabularyId);

            const progressIds = realmInstance.objects(LearningProgress).map(p => p.vocabularyId);
            const newVocabs = realmInstance.objects(Vocabulary)
                .filtered('NOT (id IN $0 OR partOfSpeech == null)', progressIds)
                .slice(0, limit - dueIds.length);

            const allIds = [...dueIds, ...newVocabs.map(v => v.id)];
            results = realmInstance.objects(Vocabulary).filtered('id IN $0', allIds);
        }

        return results.slice(0, limit).map(v => JSON.parse(v.data) as VocabularyType);
    } catch (error) {
        console.error('❌ Error getting flashcards from Realm:', error);
        return [];
    }
};

export const processFlashcardAction = async (
    vocabId: string,
    action: 'know' | 'forget'
) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    const quality = action === 'know' ? 4 : 0;

    return queueWrite(async () => {
        try {
            const now = Date.now();

            realmInstance!.write(() => {
                // 1. Record History
                realmInstance!.create('FlashcardActivity', {
                    id: Date.now(), // Simplified auto-increment
                    vocabularyId: vocabId,
                    action: action,
                    timestamp: now
                });

                // 2. Process SRS Logic
                let progress = realmInstance!.objectForPrimaryKey(LearningProgress, vocabId);

                if (!progress) {
                    progress = realmInstance!.create(LearningProgress, {
                        vocabularyId: vocabId,
                        status: 'new',
                        nextReview: 0,
                        interval: 0,
                        easeFactor: 2.5,
                        repetitions: 0,
                        lastReviewed: 0,
                        isDifficult: false
                    });
                }

                let { interval, repetitions, easeFactor } = progress;

                if (quality >= 3) {
                    if (repetitions === 0) {
                        interval = 1;
                    } else if (repetitions === 1) {
                        interval = 6;
                    } else {
                        interval = Math.round(interval * easeFactor);
                    }
                    repetitions += 1;
                } else {
                    repetitions = 0;
                    interval = 1;
                }

                easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
                if (easeFactor < 1.3) easeFactor = 1.3;

                const nextReview = now + (interval * 24 * 60 * 60 * 1000);
                const status = interval > 21 ? 'mastered' : (repetitions > 0 ? 'review' : 'learning');
                const isDifficult = easeFactor < 2.0;

                progress.status = status;
                progress.nextReview = nextReview;
                progress.interval = interval;
                progress.easeFactor = easeFactor;
                progress.repetitions = repetitions;
                progress.lastReviewed = now;
                progress.isDifficult = isDifficult;
            });
        } catch (error) {
            console.error('❌ Error processing flashcard action in Realm:', error);
            throw error;
        }
    });
};

export const updateVocabularyProgress = async (
    vocabId: string,
    quality: number // 0-5 (0=wrong, 3-5=correct/easy)
) => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();
            realmInstance!.write(() => {
                let progress = realmInstance!.objectForPrimaryKey(LearningProgress, vocabId);

                if (!progress) {
                    progress = realmInstance!.create(LearningProgress, {
                        vocabularyId: vocabId,
                        status: 'new',
                        nextReview: 0,
                        interval: 0,
                        easeFactor: 2.5,
                        repetitions: 0,
                        lastReviewed: 0,
                        isDifficult: false
                    });
                }

                let { interval, repetitions, easeFactor } = progress;

                if (quality >= 3) {
                    // Correct response
                    if (repetitions === 0) {
                        interval = 1; // 1 day
                    } else if (repetitions === 1) {
                        interval = 6; // 6 days
                    } else {
                        interval = Math.round(interval * easeFactor);
                    }
                    repetitions += 1;
                } else {
                    // Incorrect response
                    repetitions = 0;
                    interval = 1; // 1 day
                }

                // Update Ease Factor
                // q = quality (0-5)
                // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
                easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
                if (easeFactor < 1.3) easeFactor = 1.3;

                const nextReview = now + (interval * 24 * 60 * 60 * 1000);
                const status = interval > 21 ? 'mastered' : (repetitions > 0 ? 'review' : 'learning');
                const isDifficult = easeFactor < 2.0;

                progress.status = status;
                progress.nextReview = nextReview;
                progress.interval = interval;
                progress.easeFactor = easeFactor;
                progress.repetitions = repetitions;
                progress.lastReviewed = now;
                progress.isDifficult = isDifficult;
            });
        } catch (error) {
            console.error('❌ Error updating progress in Realm:', error);
        }
    });
};

export const getLearningStats = async () => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0 };

    try {
        const progress = realmInstance.objects(LearningProgress);
        const vocabCount = realmInstance.objects(Vocabulary).length;
        const touchedCount = progress.length;

        const untouched = Math.max(0, vocabCount - touchedCount);

        const newCount = progress.filtered('status == "new"').length + untouched;
        const learningCount = progress.filtered('status == "learning"').length;
        const reviewCount = progress.filtered('status == "review"').length;
        const masteredCount = progress.filtered('status == "mastered"').length;
        const difficultCount = progress.filtered('isDifficult == true').length;

        return {
            new: newCount,
            learning: learningCount,
            review: reviewCount,
            mastered: masteredCount,
            difficult: difficultCount
        };
    } catch (error) {
        console.error('❌ Error getting stats from Realm:', error);
        return { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0 };
    }
};

// ===== NOTIFICATION HELPERS =====

export const getDueCardsCount = async (): Promise<number> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return 0;

    try {
        const now = Date.now();
        return realmInstance.objects(LearningProgress).filtered('nextReview <= $0', now).length;
    } catch (error) {
        console.error('❌ Error getting due cards count from Realm:', error);
        return 0;
    }
};

export const getNewVocabCount = async (): Promise<number> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return 0;

    try {
        const vocabCount = realmInstance.objects(Vocabulary).length;
        const touchedCount = realmInstance.objects(LearningProgress).length;
        return Math.max(0, vocabCount - touchedCount);
    } catch (error) {
        console.error('❌ Error getting new vocab count from Realm:', error);
        return 0;
    }
};

// Redundant recordFlashcardActivity removed - use processFlashcardAction

export const getFlashcardActivityStats = async (): Promise<{ known: number; forgotten: number; total: number }> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return { known: 0, forgotten: 0, total: 0 };

    try {
        const activities = realmInstance.objects(FlashcardActivity);
        const uniqueVocabIds = Array.from(new Set(activities.map(a => a.vocabularyId)));

        let known = 0;
        let forgotten = 0;

        for (const id of uniqueVocabIds) {
            const latest = activities.filtered('vocabularyId == $0', id).sorted('timestamp', true)[0];
            if (latest?.action === 'know') known++;
            else if (latest?.action === 'forget') forgotten++;
        }

        return {
            known,
            forgotten,
            total: uniqueVocabIds.length
        };
    } catch (error) {
        console.error('❌ Error getting flashcard activity stats from Realm:', error);
        return { known: 0, forgotten: 0, total: 0 };
    }
};

export const getTodayActivityCount = async (): Promise<number> => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return 0;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();

        return realmInstance.objects(FlashcardActivity).filtered('timestamp >= $0', todayStart).length;
    } catch (error) {
        console.error('❌ Error getting today activity count from Realm:', error);
        return 0;
    }
};

// ===== UTILITY =====

export const clearAllCache = async () => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return;

    return queueWrite(async () => {
        try {
            realmInstance!.write(() => {
                realmInstance!.delete(realmInstance!.objects(Vocabulary));
                realmInstance!.delete(realmInstance!.objects(Resource));
                realmInstance!.delete(realmInstance!.objects(SyncMetadata));
                realmInstance!.delete(realmInstance!.objects(SearchCache));
                realmInstance!.delete(realmInstance!.objects(LearningProgress));
                realmInstance!.delete(realmInstance!.objects(FlashcardActivity));
            });
            console.log('✅ All Realm cache cleared');
        } catch (error) {
            console.error('❌ Error clearing Realm cache:', error);
        }
    });
};

export const getCacheStats = async () => {
    if (!realmInstance) await initDatabase();
    if (!realmInstance) return null;

    try {
        return realmInstance.objects(SyncMetadata).map(m => ({
            collection: m.collection,
            last_sync: m.lastSync,
            item_count: m.itemCount
        }));
    } catch (error) {
        console.error('❌ Error getting cache stats from Realm:', error);
        return null;
    }
};

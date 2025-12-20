import type { PaginatedResponse, Resource, Vocabulary } from '@/types';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    Timestamp,
    where
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
    cacheResources,
    cacheVocabularies,
    getCachedResources,
    getCachedVocabularies,
    getLatestUpdatedTimestamp,
    getLearningStats,
    getResourceByIdFromCache,
    getVocabulariesForSession,
    getVocabularyByIdFromCache,
    processFlashcardAction
} from './offlineStorage';
import { queryClient } from './queryClient';
import * as Storage from './storage';

// --- Vocabulary API ---

let isSyncing = false;
let syncPromise: Promise<number> | null = null;

export const fetchVocabularies = async (
    page = 1,
    pageSize = 300,
    options?: { partOfSpeech?: string; search?: string }
): Promise<PaginatedResponse<Vocabulary>> => {
    try {
        console.log('📖 Fetching vocabularies from SQLite...');
        let cached = await getCachedVocabularies(options);

        // INSTANT UI + LAZY SYNC
        // If searching or filtering, we don't trigger sync (cost optimization)
        if (!options?.search && !options?.partOfSpeech) {
            // Trigger sync in background (fire and forget)
            // If it's already syncing, this will just join the existing promise or skip
            syncVocabularies({ initialBatchOnly: cached.data.length === 0 }).catch(e => console.warn('Background sync background error:', e));
        }

        const items = cached.data;
        const startIndex = (page - 1) * pageSize;
        const pagedItems = items.slice(startIndex, startIndex + pageSize);

        if (items.length === 0 && !options?.search && !options?.partOfSpeech) {
            console.log('Empty cache in UI, waiting for first batch...');
            // Optional: We could wait for the first batch here if we really wanted to, 
            // but return current empty so UI shows loading state handled by react-query.
        }

        return {
            data: pagedItems,
            total: items.length,
            page,
            limit: pageSize,
            totalPages: Math.ceil(items.length / pageSize)
        };
    } catch (error) {
        console.error("Error fetching vocabularies from cache:", error);
        throw error;
    }
};

// Incremental Sync with Cost Reduction
// Delta Sync Logic
export const syncVocabularies = async (options?: { limit?: number, initialBatchOnly?: boolean }): Promise<number> => {
    // Prevent concurrent syncs
    if (isSyncing) return syncPromise || Promise.resolve(0);

    isSyncing = true;
    syncPromise = (async () => {
        try {
            const isInitialSyncDone = await Storage.getInitialSyncDone();
            const latestTs = await getLatestUpdatedTimestamp('vocabularies');

            console.log(`🔄 Sync Start - InitialSyncDone: ${isInitialSyncDone}, LatestTs: ${latestTs}`);

            // DELTA SYNC: If we are fully synced and have a timestamp, just get updates since latest
            if (isInitialSyncDone && latestTs) {
                console.log('🔄 Checking for vocabulary updates since:', latestTs);
                const vocabRef = collection(db, 'vocabularies');
                const lastDate = new Date(latestTs);

                // Using 'updated_at' for delta sync to catch modifications
                const q = query(
                    vocabRef,
                    where('updated_at', '>', Timestamp.fromDate(lastDate)),
                    orderBy('updated_at', 'desc')
                );

                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    console.log('✅ Vocabularies already up to date.');
                    return 0;
                }

                console.log(`☁️ Found ${snapshot.size} new/updated vocabularies`);
                await processAndCacheVocabularies(snapshot.docs);
                return snapshot.size;
            }

            // BACKFILL / INITIAL SYNC
            console.log('⚠️ Performing Backfill/Initial Sync...');

            const vocabRef = collection(db, 'vocabularies');
            let fetchLimit = options?.limit || 200; // Increased batch size for faster background sync
            let totalFetched = 0;
            let lastDocSnapshot: any = null;

            while (true) {
                // Using 'createdAt' to ensure consistency with the index and predictable sorting
                let queryConstraints: any[] = [orderBy('createdAt', 'desc'), limit(fetchLimit)];

                if (lastDocSnapshot) {
                    queryConstraints.push(startAfter(lastDocSnapshot));
                }

                const q = query(vocabRef, ...queryConstraints);
                let snapshot;

                try {
                    snapshot = await getDocs(q);
                } catch (queryError: any) {
                    console.warn('⚠️ Order query failed. falling back...', queryError?.message);
                    if (!lastDocSnapshot) {
                        const fallbackQ = query(vocabRef, limit(fetchLimit));
                        snapshot = await getDocs(fallbackQ);
                    } else {
                        break;
                    }
                }

                if (snapshot.empty) {
                    if (!options?.initialBatchOnly) {
                        await Storage.setInitialSyncDone(true);
                        console.log('✅ Initial Sync Complete!');
                    }
                    break;
                }

                await processAndCacheVocabularies(snapshot.docs);
                totalFetched += snapshot.size;
                lastDocSnapshot = snapshot.docs[snapshot.docs.length - 1];

                console.log(`📦 Synced batch ${Math.ceil(totalFetched / fetchLimit)} (${totalFetched} items total)`);

                if (options?.initialBatchOnly) {
                    console.log('⏸️ Initial batch loaded for UI, continuing syncing others in background...');
                    // Don't mark as done yet, but return so UI can refresh
                    // Trigger the rest of the sync as a non-await promise
                    (async () => {
                        // Reset lock temporarily to allow this fire-and-forget to continue
                        isSyncing = false;
                        await syncVocabularies({ limit: fetchLimit });
                    })();
                    return totalFetched;
                }

                // yield to UI thread
                await new Promise(r => setTimeout(r, 100));
            }

            return totalFetched;
        } catch (error) {
            console.error('❌ Sync error (vocab):', error);
            return 0;
        } finally {
            isSyncing = false;
            syncPromise = null;
        }
    })();

    return syncPromise;
};

const processAndCacheVocabularies = async (docs: any[]) => {
    const items = docs.map(doc => {
        const data = doc.data();
        const createdAt = data.created_at?.toDate?.() ? data.created_at.toDate().toISOString() : (data.created_at || data.createdAt || new Date().toISOString());
        const updatedAt = data.updated_at?.toDate?.() ? data.updated_at.toDate().toISOString() : (data.updated_at || data.updatedAt || new Date().toISOString());

        return {
            id: doc.id,
            ...data,
            english: data.english || '',
            bangla: data.bangla || '',
            partOfSpeech: (data.part_of_speech || data.partOfSpeech || 'noun').toLowerCase(),
            examples: Array.isArray(data.examples) ? data.examples : (typeof data.examples === 'string' ? JSON.parse(data.examples) : []),
            createdAt,
            updatedAt,
        } as Vocabulary;
    }).filter(item => item.english && item.bangla);

    if (items.length > 0) {
        await cacheVocabularies(items);
        queryClient.invalidateQueries({ queryKey: ['vocabularies'] });
    }
};

const syncVocabulariesInBackground = syncVocabularies;

// --- Resource API ---

export const fetchResources = async (
    page = 1,
    pageSize = 20,
    options?: { search?: string }
): Promise<PaginatedResponse<Resource>> => {
    try {
        console.log('📖 Fetching resources from SQLite...');
        let cached = await getCachedResources(options);

        // Eager Sync: If cache is empty and not searching, try a quick sync
        if (cached.data.length === 0 && !options?.search) {
            console.log('Empty cache, triggering eager sync...');
            await syncResources();
            cached = await getCachedResources(options);
        }

        const items = cached.data;
        const startIndex = (page - 1) * pageSize;
        const pagedItems = items.slice(startIndex, startIndex + pageSize);

        return {
            data: pagedItems,
            total: items.length,
            page,
            limit: pageSize,
            totalPages: Math.ceil(items.length / pageSize)
        };
    } catch (error) {
        console.error("Error fetching resources from cache:", error);
        throw error;
    }
};

export const syncResources = async () => {
    try {
        const latestTs = await getLatestUpdatedTimestamp('grammar_images');
        console.log('🔄 Checking for resource updates since:', latestTs || 'Beginning');

        const resourceRef = collection(db, 'grammar_images');
        let q;

        if (latestTs) {
            const lastDate = new Date(latestTs);
            q = query(resourceRef, where('createdAt', '>', Timestamp.fromDate(lastDate)), orderBy('createdAt', 'desc'));
        } else {
            // Initial sync: try ordered first
            q = query(resourceRef, orderBy('createdAt', 'desc'), limit(100));
        }

        let snapshot = await getDocs(q);

        // Fallback: If initial sync is empty, documents might be missing 'createdAt'
        if (snapshot.empty && !latestTs) {
            console.log('⚠️ No resources found with timestamp. Falling back to unordered query...');
            q = query(resourceRef, limit(100));
            snapshot = await getDocs(q);
        }
        if (snapshot.empty) {
            console.log('✅ Resources already up to date.');
            return 0;
        }

        console.log(`☁️ Found ${snapshot.size} new/updated resources`);

        const items = snapshot.docs.map(doc => {
            const data = doc.data();
            const createdAt = data.created_at?.toDate?.() ? data.created_at.toDate().toISOString() : (data.created_at || data.createdAt || new Date().toISOString());
            const updatedAt = data.updated_at?.toDate?.() ? data.updated_at.toDate().toISOString() : (data.updated_at || data.updatedAt || new Date().toISOString());

            return {
                id: doc.id,
                ...data,
                title: data.title || '',
                description: data.description || '',
                imageUrl: data.imageUrl || data.url || '',
                createdAt,
                updatedAt
            } as Resource;
        });

        if (items.length > 0) {
            await cacheResources(items);
            queryClient.invalidateQueries({ queryKey: ['resources'] });
        }
        return items.length;
    } catch (error) {
        console.error('❌ Sync error (resource):', error);
        throw error;
    }
};

const syncResourcesInBackground = syncResources;

// --- Lifecycle / Other ---

export const subscribeToDataChanges = () => {
    // Disabled onSnapshot to reduce cost. Background sync handles updates.
    console.log('💡 Global onSnapshot disabled for cost optimization.');
};

export const unsubscribeFromDataChanges = () => {
    // No-op
};

export const getVocabularyById = async (id: string): Promise<Vocabulary> => {
    try {
        const cached = await getVocabularyByIdFromCache(id);
        if (cached) return cached;

        const docRef = doc(db, 'vocabularies', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Vocabulary not found");

        const data = docSnap.data();
        const createdAt = data.created_at?.toDate?.() ? data.created_at.toDate().toISOString() : (data.created_at || data.createdAt || new Date().toISOString());
        const updatedAt = data.updated_at?.toDate?.() ? data.updated_at.toDate().toISOString() : (data.updated_at || data.updatedAt || new Date().toISOString());

        return {
            id: docSnap.id,
            ...data,
            english: data.english || '',
            bangla: data.bangla || '',
            partOfSpeech: (data.part_of_speech || data.partOfSpeech || 'noun').toLowerCase(),
            examples: typeof data.examples === 'string' ? JSON.parse(data.examples) : data.examples || [],
            synonyms: typeof data.synonyms === 'string' ? JSON.parse(data.synonyms) : data.synonyms || [],
            antonyms: typeof data.antonyms === 'string' ? JSON.parse(data.antonyms) : data.antonyms || [],
            verbForms: typeof data.verb_forms === 'string' ? JSON.parse(data.verb_forms) : (data.verbForms || data.verb_forms || null),
            createdAt,
            updatedAt,
        } as Vocabulary;
    } catch (error) {
        console.error("Error fetching vocabulary by id:", error);
        throw error;
    }
};

export const getResourceById = async (id: string): Promise<Resource> => {
    try {
        const cached = await getResourceByIdFromCache(id);
        if (cached) return cached;

        const docRef = doc(db, 'grammar_images', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) throw new Error("Resource not found");

        const data = docSnap.data();
        const createdAt = data.created_at?.toDate?.() ? data.created_at.toDate().toISOString() : (data.created_at || data.createdAt || new Date().toISOString());

        return {
            id: docSnap.id,
            ...data,
            title: data.title || '',
            description: data.description || '',
            imageUrl: data.imageUrl || data.url || '',
            createdAt
        } as Resource;
    } catch (error) {
        console.error("Error fetching resource by id:", error);
        throw error;
    }
};

export const searchContent = async (queryStr: string, type: 'vocabulary' | 'resources' | 'users') => {
    return [];
};

// --- Storage Aliases ---

export const addToFavorites = async (vocabulary: Vocabulary) => Storage.addFavorite(vocabulary.id, vocabulary);
export const removeFromFavorites = async (vocabId: string) => Storage.removeFavorite(vocabId);
export const getFavoriteVocabularies = async (): Promise<Vocabulary[]> => Storage.getFavoriteVocabulariesData();
export const isFavorited = async (vocabId: string): Promise<boolean> => Storage.isFavorite(vocabId);

export const addToBookmarks = async (resource: any) => Storage.addBookmark(resource.id, resource);
export const removeFromBookmarks = async (resourceId: string) => Storage.removeBookmark(resourceId);
export const getBookmarkedResources = async (): Promise<Resource[]> => Storage.getBookmarkedResourcesData();
export const isBookmarked = async (resourceId: string): Promise<boolean> => Storage.isBookmarked(resourceId);

export const getFlashcards = async (limit: number = 0, mode: 'mixed' | 'new' | 'review' | 'hardest' = 'mixed') => {
    return getVocabulariesForSession(limit, mode);
};

export const updateFlashcardProgress = async (vocabId: string, quality: number) => {
    // quality range is 0-5 in SM-2. If quality >= 3, treat as "know", else "forget"
    const action = quality >= 3 ? 'know' : 'forget';
    return processFlashcardAction(vocabId, action);
};

export const getFlashcardStats = async () => {
    return getLearningStats();
};

export const getVocabularies = fetchVocabularies;
export type { Resource, Vocabulary };


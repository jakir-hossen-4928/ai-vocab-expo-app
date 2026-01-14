import type { PaginatedResponse, Resource, Vocabulary } from '@/types';
import {
    doc,
    getDoc
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
    getCachedResources,
    getCachedVocabularies,
    getLearningStats,
    getResourceByIdFromCache,
    getVocabulariesForSession,
    getVocabularyByIdFromCache,
    processFlashcardAction
} from './offlineStorage';
import * as Storage from './storage';
import { syncOrchestrator } from './syncService';

// --- Vocabulary API ---

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
            // Trigger background delta sync (fire and forget)
            syncOrchestrator.startDeltaSync().catch(e => console.warn('Background sync error:', e));
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
        console.error("Error fetching vocabularies from cache:", error);
        throw error;
    }
};

// Legacy sync functions - now handled by syncOrchestrator
// Kept for backward compatibility
export const syncVocabularies = async (options?: { limit?: number, initialBatchOnly?: boolean }): Promise<number> => {
    console.warn('⚠️ syncVocabularies is deprecated, use syncOrchestrator instead');
    return syncOrchestrator.syncCollection('vocabularies', {
        chunkSize: options?.limit,
        initialBatchOnly: options?.initialBatchOnly
    });
};

// --- Resource API ---

export const fetchResources = async (
    page = 1,
    pageSize = 20,
    options?: { search?: string }
): Promise<PaginatedResponse<Resource>> => {
    try {
        console.log('📖 Fetching resources from SQLite...');
        let cached = await getCachedResources(options);

        // Trigger background delta sync if not searching
        if (!options?.search) {
            syncOrchestrator.startDeltaSync().catch(e => console.warn('Background sync error:', e));
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

// Legacy sync function - now handled by syncOrchestrator
export const syncResources = async () => {
    console.warn('⚠️ syncResources is deprecated, use syncOrchestrator instead');
    return syncOrchestrator.syncCollection('resources');
};

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
            slug: data.slug || docSnap.id,
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


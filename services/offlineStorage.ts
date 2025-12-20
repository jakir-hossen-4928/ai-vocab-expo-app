import type { Resource as ResourceType, Vocabulary as VocabularyType } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

// Cache expiry: 30 minutes
const CACHE_EXPIRY_MS = 1000 * 60 * 30;

// Singleton promise for database initialization
let dbInstance: SQLite.SQLiteDatabase | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Ensures the database is initialized and all PRAGMAs are set.
 * Returns the ready database instance.
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    if (dbInstance) return dbInstance;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
        try {
            console.log('🏗️ Initializing SQLite Engine...');
            const _db = await SQLite.openDatabaseAsync('vocab.db');

            // CRITICAL: Set PRAGMAs IMMEDIATELY and ATOMICALLY
            // This must happen before ANY table creation or selection
            await _db.execAsync(`
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA busy_timeout = 5000;
            `);

            // 1. Create Tables in a single transaction
            await _db.withTransactionAsync(async () => {
                await _db.execAsync(`
                    CREATE TABLE IF NOT EXISTS vocabularies (
                        id TEXT PRIMARY KEY,
                        english TEXT NOT NULL,
                        bangla TEXT NOT NULL,
                        partOfSpeech TEXT,
                        pronunciation TEXT,
                        examples TEXT, synonyms TEXT, antonyms TEXT,
                        explanation TEXT, meaning TEXT,
                        difficulty_level TEXT, origin TEXT,
                        audioUrl TEXT, verbForms TEXT,
                        relatedWords TEXT, userId TEXT,
                        cachedAt INTEGER, updatedAtTs INTEGER,
                        isFavorite INTEGER DEFAULT 0,
                        createdAt TEXT, updatedAt TEXT
                    );
                    
                    CREATE TABLE IF NOT EXISTS resources (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        imageUrl TEXT, thumbnailUrl TEXT,
                        link TEXT, type TEXT, userId TEXT,
                        cachedAt INTEGER, updatedAtTs INTEGER,
                        isBookmarked INTEGER DEFAULT 0,
                        createdAt TEXT, updatedAt TEXT
                    );

                    CREATE TABLE IF NOT EXISTS sync_metadata (
                        collection TEXT PRIMARY KEY,
                        lastSync INTEGER, itemCount INTEGER
                    );

                    CREATE TABLE IF NOT EXISTS learning_progress (
                        vocabularyId TEXT PRIMARY KEY,
                        status TEXT DEFAULT 'new',
                        nextReview INTEGER DEFAULT 0,
                        interval INTEGER DEFAULT 0,
                        easeFactor REAL DEFAULT 2.5,
                        repetitions INTEGER DEFAULT 0,
                        lastReviewed INTEGER DEFAULT 0,
                        isDifficult INTEGER DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS flashcard_activity (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        vocabularyId TEXT,
                        action TEXT,
                        timestamp INTEGER
                    );

                    CREATE TABLE IF NOT EXISTS search_cache (
                        query TEXT PRIMARY KEY,
                        result TEXT,
                        updatedAt INTEGER
                    );
                `);

                // Indexes
                await _db.execAsync(`
                    CREATE INDEX IF NOT EXISTS idx_vocab_english ON vocabularies(english);
                    CREATE INDEX IF NOT EXISTS idx_vocab_updated ON vocabularies(updatedAtTs);
                    CREATE INDEX IF NOT EXISTS idx_resource_updated ON resources(updatedAtTs);
                    CREATE INDEX IF NOT EXISTS idx_progress_next ON learning_progress(nextReview);
                `);
            });

            dbInstance = _db;
            db = _db; // Backward compatibility
            console.log('✅ SQLite Database Engine Ready (WAL Mode Enabled)');

            // Log current counts for debugging
            try {
                const vocabCountRow: any = await _db.getFirstAsync('SELECT COUNT(*) as count FROM vocabularies');
                const resourceCountRow: any = await _db.getFirstAsync('SELECT COUNT(*) as count FROM resources');
                console.log(`📊 DB Stats: ${vocabCountRow?.count || 0} vocabularies, ${resourceCountRow?.count || 0} resources`);
            } catch (e) {
                console.warn('Could not fetch DB stats:', e);
            }

            return _db;
        } catch (error) {
            console.error('❌ Failed to initialize SQLite Engine:', error);
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
};

// Backward compatible initDatabase for RootLayout
export const initDatabase = async () => {
    await getDatabase();
};

// Queue for database write operations - strictly serialized
type QueueTask = () => Promise<any>;
const writeQueue: QueueTask[] = [];
let isProcessingQueue = false;

const processQueue = async () => {
    if (isProcessingQueue || writeQueue.length === 0) return;
    isProcessingQueue = true;

    while (writeQueue.length > 0) {
        const task = writeQueue.shift();
        if (task) {
            try {
                // Guaranteed safety: Wait for DB to be 100% configured
                await getDatabase();
                await task();
            } catch (error) {
                console.error('❌ SQLite Queue execution error:', error);
            }
        }
    }

    isProcessingQueue = false;
};

const queueWrite = <T>(operation: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
        writeQueue.push(async () => {
            try {
                const result = await operation();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
        processQueue().catch(e => console.error('Queue processing crash:', e));
    });
};

// ===== VOCABULARIES =====

export const cacheVocabularies = async (vocabularies: VocabularyType[]) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();
            await db!.withTransactionAsync(async () => {
                for (const v of vocabularies) {
                    const rawDate = v.updatedAt || v.updated_at || v.createdAt || v.created_at || now;
                    let updatedAtTs = now;
                    try {
                        updatedAtTs = new Date(rawDate).getTime();
                        if (isNaN(updatedAtTs)) updatedAtTs = now;
                    } catch (e) {
                        updatedAtTs = now;
                    }

                    await db!.runAsync(
                        `INSERT OR REPLACE INTO vocabularies (
                            id, english, bangla, partOfSpeech, pronunciation, 
                            examples, synonyms, antonyms, explanation, meaning, 
                            difficulty_level, origin, audioUrl, verbForms, 
                            relatedWords, userId, cachedAt, updatedAtTs, 
                            isFavorite, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            v.id,
                            v.english || '',
                            v.bangla || '',
                            v.partOfSpeech?.toLowerCase() || 'noun',
                            v.pronunciation || null,
                            v.examples ? JSON.stringify(v.examples) : null,
                            v.synonyms ? JSON.stringify(v.synonyms) : null,
                            v.antonyms ? JSON.stringify(v.antonyms) : null,
                            v.explanation || null,
                            v.meaning || null,
                            v.difficulty_level || null,
                            v.origin || null,
                            v.audioUrl || null,
                            v.verbForms ? JSON.stringify(v.verbForms) : null,
                            v.relatedWords ? JSON.stringify(v.relatedWords) : null,
                            v.userId || null,
                            now,
                            updatedAtTs,
                            v.isFavorite ? 1 : 0,
                            v.createdAt || (v.created_at?.toISOString ? v.created_at.toISOString() : null),
                            v.updatedAt || (v.updated_at?.toISOString ? v.updated_at.toISOString() : null)
                        ]
                    );
                }

                // Update metadata
                await db!.runAsync(
                    'INSERT OR REPLACE INTO sync_metadata (collection, lastSync, itemCount) VALUES (?, ?, ?)',
                    ['vocabularies', now, vocabularies.length]
                );
            });

            console.log(`✅ SQLite: Cached ${vocabularies.length} vocabularies.`);
        } catch (error) {
            console.error('❌ Error caching vocabularies in SQLite:', error);
            throw error;
        }
    });
};

export const getCachedVocabularies = async (options?: { partOfSpeech?: string; search?: string; onlyFavorites?: boolean }): Promise<{ data: VocabularyType[], isStale: boolean }> => {
    if (!db) await initDatabase();
    if (!db) return { data: [], isStale: true };

    try {
        const metadata: any = await db.getFirstAsync('SELECT * FROM sync_metadata WHERE collection = ?', ['vocabularies']);
        const isStale = !metadata || (Date.now() - metadata.lastSync > CACHE_EXPIRY_MS);

        let queryStr = 'SELECT * FROM vocabularies';
        let params: any[] = [];
        let conditions: string[] = [];

        if (options?.onlyFavorites) {
            conditions.push('isFavorite = 1');
        }

        if (options?.partOfSpeech && options.partOfSpeech !== 'all') {
            conditions.push('partOfSpeech = ?');
            params.push(options.partOfSpeech.toLowerCase());
        }

        if (options?.search) {
            conditions.push('(english LIKE ? OR bangla LIKE ?)');
            const searchPattern = `%${options.search.trim().toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }

        if (conditions.length > 0) {
            queryStr += ' WHERE ' + conditions.join(' AND ');
        }

        // Sorting
        if (options?.onlyFavorites) {
            queryStr += ' ORDER BY updatedAtTs DESC';
        } else {
            queryStr += ' ORDER BY updatedAtTs DESC, id ASC';
        }

        const rows: any[] = await db.getAllAsync(queryStr, params);

        const data = rows.map(v => ({
            id: v.id,
            english: v.english,
            bangla: v.bangla,
            partOfSpeech: v.partOfSpeech,
            pronunciation: v.pronunciation,
            examples: v.examples ? JSON.parse(v.examples) : [],
            synonyms: v.synonyms ? JSON.parse(v.synonyms) : [],
            antonyms: v.antonyms ? JSON.parse(v.antonyms) : [],
            explanation: v.explanation,
            meaning: v.meaning,
            difficulty_level: v.difficulty_level,
            origin: v.origin,
            audioUrl: v.audioUrl,
            verbForms: v.verbForms ? JSON.parse(v.verbForms) : undefined,
            relatedWords: v.relatedWords ? JSON.parse(v.relatedWords) : [],
            userId: v.userId,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            isFavorite: v.isFavorite === 1
        } as VocabularyType));

        return { data, isStale };
    } catch (error) {
        console.error('❌ Error getting cached vocabularies from SQLite:', error);
        return { data: [], isStale: true };
    }
};

export const getVocabularyByIdFromCache = async (id: string): Promise<VocabularyType | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const v: any = await db.getFirstAsync('SELECT * FROM vocabularies WHERE id = ?', [id]);
        if (!v) return null;

        return {
            id: v.id,
            english: v.english,
            bangla: v.bangla,
            partOfSpeech: v.partOfSpeech,
            pronunciation: v.pronunciation,
            examples: v.examples ? JSON.parse(v.examples) : [],
            synonyms: v.synonyms ? JSON.parse(v.synonyms) : [],
            antonyms: v.antonyms ? JSON.parse(v.antonyms) : [],
            explanation: v.explanation,
            meaning: v.meaning,
            difficulty_level: v.difficulty_level,
            origin: v.origin,
            audioUrl: v.audioUrl,
            verbForms: v.verbForms ? JSON.parse(v.verbForms) : undefined,
            relatedWords: v.relatedWords ? JSON.parse(v.relatedWords) : [],
            userId: v.userId,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            isFavorite: v.isFavorite === 1
        } as VocabularyType;
    } catch (error) {
        console.error('❌ Error getting vocabulary from SQLite:', error);
        return null;
    }
};

// ===== RESOURCES =====

export const cacheResources = async (resources: ResourceType[]) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();
            await db!.withTransactionAsync(async () => {
                for (const r of resources) {
                    const updatedAtTs = new Date(r.updatedAt || r.updated_at || r.createdAt || r.created_at || now).getTime();

                    await db!.runAsync(
                        `INSERT OR REPLACE INTO resources (
                            id, title, description, imageUrl, thumbnailUrl,
                            link, type, userId, cachedAt, updatedAtTs,
                            isBookmarked, createdAt, updatedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            r.id,
                            r.title || 'Untitled',
                            r.description || null,
                            r.imageUrl || r.thumbnail || null,
                            r.thumbnailUrl || r.thumbnail || null,
                            r.link || null,
                            r.type || null,
                            r.userId || null,
                            now,
                            updatedAtTs,
                            r.isBookmarked ? 1 : 0,
                            r.createdAt || (r.created_at?.toISOString ? r.created_at.toISOString() : null),
                            r.updatedAt || (r.updated_at?.toISOString ? r.updated_at.toISOString() : null)
                        ]
                    );
                }
                // Update sync metadata
                await db!.runAsync(
                    'INSERT OR REPLACE INTO sync_metadata (collection, lastSync, itemCount) VALUES (?, ?, ?)',
                    ['grammar_images', now, resources.length]
                );
            });

            console.log(`✅ SQLite: Cached ${resources.length} resources.`);
        } catch (error) {
            console.error('❌ Error caching resources in SQLite:', error);
            throw error;
        }
    });
};

export const getCachedResources = async (options?: { search?: string; onlyBookmarks?: boolean }): Promise<{ data: ResourceType[], isStale: boolean }> => {
    if (!db) await initDatabase();
    if (!db) return { data: [], isStale: true };

    try {
        const metadata: any = await db.getFirstAsync('SELECT * FROM sync_metadata WHERE collection = ?', ['grammar_images']);
        const isStale = !metadata || (Date.now() - metadata.lastSync > CACHE_EXPIRY_MS);

        let queryStr = 'SELECT * FROM resources';
        let params: any[] = [];
        let conditions: string[] = [];

        if (options?.onlyBookmarks) {
            conditions.push('isBookmarked = 1');
        }

        if (options?.search) {
            conditions.push('(title LIKE ? OR description LIKE ?)');
            const searchPattern = `%${options.search.trim().toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }

        if (conditions.length > 0) {
            queryStr += ' WHERE ' + conditions.join(' AND ');
        }

        // Sorting
        if (options?.onlyBookmarks) {
            queryStr += ' ORDER BY updatedAtTs DESC';
        } else {
            queryStr += ' ORDER BY updatedAtTs DESC, id ASC';
        }

        const rows: any[] = await db.getAllAsync(queryStr, params);

        const data = rows.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            imageUrl: r.imageUrl,
            thumbnailUrl: r.thumbnailUrl,
            link: r.link,
            type: r.type,
            userId: r.userId,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            isBookmarked: r.isBookmarked === 1
        } as ResourceType));

        return { data, isStale };
    } catch (error) {
        console.error('❌ Error getting cached resources from SQLite:', error);
        return { data: [], isStale: true };
    }
};

export const getResourceByIdFromCache = async (id: string): Promise<ResourceType | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const r: any = await db.getFirstAsync('SELECT * FROM resources WHERE id = ?', [id]);
        if (!r) return null;

        return {
            id: r.id,
            title: r.title,
            description: r.description,
            imageUrl: r.imageUrl,
            thumbnailUrl: r.thumbnailUrl,
            link: r.link,
            type: r.type,
            userId: r.userId,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            isBookmarked: r.isBookmarked === 1
        } as ResourceType;
    } catch (error) {
        console.error('❌ Error getting resource from SQLite:', error);
        return null;
    }
};

// ===== SYNC METADATA =====

export const getCollectionMetadata = async (collection: string) => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const metadata: any = await db.getFirstAsync('SELECT * FROM sync_metadata WHERE collection = ?', [collection]);
        return metadata ? { lastSync: metadata.lastSync, itemCount: metadata.itemCount } : null;
    } catch (error) {
        console.error(`❌ Error getting ${collection} metadata from SQLite:`, error);
        return null;
    }
};

export const updateLastSyncMetadata = async (collection: string, itemCount: number) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.runAsync(
                'INSERT OR REPLACE INTO sync_metadata (collection, lastSync, itemCount) VALUES (?, ?, ?)',
                [collection, Date.now(), itemCount]
            );
        } catch (error) {
            console.error(`❌ Error updating ${collection} metadata in SQLite:`, error);
        }
    });
};

// ===== TIMESTAMPS =====

export const getLatestUpdatedTimestamp = async (collection: string): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        const table = collection === 'grammar_images' ? 'resources' : 'vocabularies';
        const row: any = await db.getFirstAsync(`SELECT MAX(updatedAtTs) as maxTs FROM ${table}`);
        return row?.maxTs || 0;
    } catch (error) {
        console.error(`❌ Error getting latest timestamp for ${collection} from SQLite:`, error);
        return 0;
    }
};

export const getOldestUpdatedTimestamp = async (collection: string): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        const table = collection === 'grammar_images' ? 'resources' : 'vocabularies';
        const row: any = await db.getFirstAsync(`SELECT MIN(updatedAtTs) as minTs FROM ${table}`);
        return row?.minTs || 0;
    } catch (error) {
        console.error(`❌ Error getting oldest timestamp for ${collection} from SQLite:`, error);
        return 0;
    }
};

export const isCacheEmpty = async (collection: string): Promise<boolean> => {
    if (!db) await initDatabase();
    if (!db) return true;

    try {
        const table = collection === 'grammar_images' ? 'resources' : 'vocabularies';
        const row: any = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${table}`);
        return (row?.count || 0) === 0;
    } catch (error) {
        console.error(`❌ Error checking if ${collection} cache is empty in SQLite:`, error);
        return true;
    }
};


export const processFlashcardAction = async (vocabId: string, action: 'know' | 'forget') => {
    if (!db) await initDatabase();
    if (!db) return;

    // Use queueWrite to prevent concurrent write attempts
    return queueWrite(async () => {
        try {
            const now = Date.now();
            // Use a transaction for atomicity and to reduce the number of lock acquisitions
            await db!.withTransactionAsync(async () => {
                // 1. Record activity
                await db!.runAsync(
                    'INSERT INTO flashcard_activity (vocabularyId, action, timestamp) VALUES (?, ?, ?)',
                    [vocabId, action, now]
                );

                // 2. Update progress using SM-2 logic
                const quality = action === 'know' ? 5 : 0;

                let progress: any = await db!.getFirstAsync('SELECT * FROM learning_progress WHERE vocabularyId = ?', [vocabId]);

                if (!progress) {
                    progress = {
                        status: 'new',
                        nextReview: 0,
                        interval: 0,
                        easeFactor: 2.5,
                        repetitions: 0,
                        lastReviewed: 0,
                        isDifficult: 0
                    };
                }

                let { interval, repetitions, easeFactor } = progress;

                if (quality >= 3) {
                    if (repetitions === 0) interval = 1;
                    else if (repetitions === 1) interval = 6;
                    else interval = Math.round(interval * easeFactor);
                    repetitions += 1;
                } else {
                    repetitions = 0;
                    interval = 1;
                }

                // Ease Factor formula
                easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
                if (easeFactor < 1.3) easeFactor = 1.3;

                const nextReview = now + (interval * 24 * 60 * 60 * 1000);
                const status = interval > 21 ? 'mastered' : (repetitions > 0 ? 'review' : 'learning');
                const isDifficult = easeFactor < 2.0 ? 1 : 0;

                await db!.runAsync(
                    `INSERT OR REPLACE INTO learning_progress (
                        vocabularyId, status, nextReview, interval, easeFactor, 
                        repetitions, lastReviewed, isDifficult
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [vocabId, status, nextReview, interval, easeFactor, repetitions, now, isDifficult]
                );
            });
        } catch (error) {
            console.error('❌ Error processing flashcard action in SQLite:', error);
            throw error;
        }
    });
};

export const updateVocabularyProgress = async (vocabId: string, quality: number) => {
    const action = quality >= 3 ? 'know' : 'forget';
    return processFlashcardAction(vocabId, action);
};

export const getLearningStats = async () => {
    if (!db) await initDatabase();
    if (!db) return { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0, todayCount: 0, totalActivity: 0 };

    try {
        const progressCountRow: any = await db!.getFirstAsync('SELECT COUNT(*) as count FROM learning_progress');
        const vocabCountRow: any = await db!.getFirstAsync('SELECT COUNT(*) as count FROM vocabularies');

        const touchedCount = progressCountRow?.count || 0;
        const vocabCount = vocabCountRow?.count || 0;
        const untouched = Math.max(0, vocabCount - touchedCount);

        const rows: any[] = await db!.getAllAsync('SELECT status, isDifficult, COUNT(*) as count FROM learning_progress GROUP BY status, isDifficult');

        // Today's activity
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();
        const todayRow: any = await db!.getFirstAsync('SELECT COUNT(*) as count FROM flashcard_activity WHERE timestamp >= ?', [todayStart]);

        // Total activity count
        const totalActivityRow: any = await db!.getFirstAsync('SELECT COUNT(*) as count FROM flashcard_activity');

        let stats = {
            new: untouched,
            learning: 0,
            review: 0,
            mastered: 0,
            difficult: 0,
            todayCount: todayRow?.count || 0,
            totalActivity: totalActivityRow?.count || 0
        };

        for (const row of rows) {
            if (row.status === 'learning') stats.learning += row.count;
            else if (row.status === 'review') stats.review += row.count;
            else if (row.status === 'mastered') stats.mastered += row.count;

            if (row.isDifficult === 1) stats.difficult += row.count;
        }

        return stats;
    } catch (error) {
        console.error('❌ Error getting learning stats from SQLite:', error);
        return { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0, todayCount: 0, totalActivity: 0 };
    }
};

// ===== FAVORITE / BOOKMARK HELPERS =====

export const addFavoriteVocab = async (vocabId: string) => {
    return addFavoriteVocabs([vocabId]);
};

export const addFavoriteVocabs = async (vocabIds: string[]) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();
            await db!.withTransactionAsync(async () => {
                for (const vocabId of vocabIds) {
                    await db!.runAsync('UPDATE vocabularies SET isFavorite = 1, updatedAtTs = ? WHERE id = ?', [now, vocabId]);
                }
            });
        } catch (error) {
            console.error('❌ Error adding favorites in SQLite:', error);
        }
    });
};

export const removeFavoriteVocab = async (vocabId: string) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.runAsync('UPDATE vocabularies SET isFavorite = 0, updatedAtTs = ? WHERE id = ?', [Date.now(), vocabId]);
        } catch (error) {
            console.error('❌ Error removing favorite in SQLite:', error);
        }
    });
};

export const isVocabFavorited = async (vocabId: string): Promise<boolean> => {
    if (!db) await initDatabase();
    if (!db) return false;

    try {
        const row: any = await db!.getFirstAsync('SELECT isFavorite FROM vocabularies WHERE id = ?', [vocabId]);
        return row?.isFavorite === 1;
    } catch (error) {
        return false;
    }
};

export const getFavoriteVocabIds = async (): Promise<string[]> => {
    if (!db) await initDatabase();
    if (!db) return [];

    try {
        const rows: any[] = await db!.getAllAsync('SELECT id FROM vocabularies WHERE isFavorite = 1');
        return rows.map(r => r.id);
    } catch (error) {
        return [];
    }
};

export const addBookmarkResource = async (resourceId: string) => {
    return addBookmarkResources([resourceId]);
};

export const addBookmarkResources = async (resourceIds: string[]) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();
            await db!.withTransactionAsync(async () => {
                for (const resourceId of resourceIds) {
                    await db!.runAsync('UPDATE resources SET isBookmarked = 1, updatedAtTs = ? WHERE id = ?', [now, resourceId]);
                }
            });
        } catch (error) {
            console.error('❌ Error adding bookmarks in SQLite:', error);
        }
    });
};

export const removeBookmarkResource = async (resourceId: string) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.runAsync('UPDATE resources SET isBookmarked = 0, updatedAtTs = ? WHERE id = ?', [Date.now(), resourceId]);
        } catch (error) {
            console.error('❌ Error removing bookmark in SQLite:', error);
        }
    });
};

export const isResourceBookmarked = async (resourceId: string): Promise<boolean> => {
    if (!db) await initDatabase();
    if (!db) return false;

    try {
        const row: any = await db!.getFirstAsync('SELECT isBookmarked FROM resources WHERE id = ?', [resourceId]);
        return row?.isBookmarked === 1;
    } catch (error) {
        return false;
    }
};

export const getBookmarkResourceIds = async (): Promise<string[]> => {
    if (!db) await initDatabase();
    if (!db) return [];

    try {
        const rows: any[] = await db!.getAllAsync('SELECT id FROM resources WHERE isBookmarked = 1');
        return rows.map(r => r.id);
    } catch (error) {
        return [];
    }
};

// ===== SRS SESSION LOGIC =====

export const getVocabulariesForSession = async (limit: number = 0, mode: 'mixed' | 'new' | 'review' | 'hardest' = 'mixed'): Promise<VocabularyType[]> => {
    const _db = await getDatabase();

    try {
        const now = Date.now();
        let queryStr = 'SELECT v.* FROM vocabularies v';
        let params: any[] = [];

        if (mode === 'review') {
            queryStr += ' INNER JOIN learning_progress p ON v.id = p.vocabularyId WHERE p.nextReview <= ? ORDER BY p.nextReview ASC';
            params.push(now);
        } else if (mode === 'new') {
            queryStr += ' LEFT JOIN learning_progress p ON v.id = p.vocabularyId WHERE p.vocabularyId IS NULL ORDER BY RANDOM()';
        } else if (mode === 'hardest') {
            queryStr += ' INNER JOIN learning_progress p ON v.id = p.vocabularyId WHERE p.isDifficult = 1 OR p.easeFactor < 2.0 ORDER BY p.easeFactor ASC';
        } else if (limit > 0) {
            // Mixed with limit
            const dueRows: any[] = await _db.getAllAsync(
                'SELECT v.id FROM vocabularies v INNER JOIN learning_progress p ON v.id = p.vocabularyId WHERE p.nextReview <= ? ORDER BY p.nextReview ASC LIMIT ?',
                [now, Math.floor(limit / 2)]
            );
            const dueIds = dueRows.map(r => r.id);

            const newRows: any[] = await _db.getAllAsync(
                'SELECT v.id FROM vocabularies v LEFT JOIN learning_progress p ON v.id = p.vocabularyId WHERE p.vocabularyId IS NULL ORDER BY RANDOM() LIMIT ?',
                [limit - dueIds.length]
            );
            const newIds = newRows.map(r => r.id);

            const allIds = [...dueIds, ...newIds];
            if (allIds.length === 0) return [];

            queryStr += ` WHERE v.id IN (${allIds.map(() => '?').join(',')})`;
            params = allIds;
        } else {
            // Default: "mixed" but with NO limit (Load ALL cached vocabularies)
            // Just return everything shuffled
            queryStr += ' ORDER BY RANDOM()';
        }

        if (limit > 0) {
            queryStr += ` LIMIT ${limit}`;
        }

        const rows: any[] = await _db.getAllAsync(queryStr, params);

        return rows.map(v => ({
            id: v.id,
            english: v.english,
            bangla: v.bangla,
            partOfSpeech: v.partOfSpeech,
            pronunciation: v.pronunciation,
            examples: v.examples ? JSON.parse(v.examples) : [],
            synonyms: v.synonyms ? JSON.parse(v.synonyms) : [],
            antonyms: v.antonyms ? JSON.parse(v.antonyms) : [],
            explanation: v.explanation,
            meaning: v.meaning,
            difficulty_level: v.difficulty_level,
            origin: v.origin,
            audioUrl: v.audioUrl,
            verbForms: v.verbForms ? JSON.parse(v.verbForms) : undefined,
            relatedWords: v.relatedWords ? JSON.parse(v.relatedWords) : [],
            userId: v.userId,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            isFavorite: v.isFavorite === 1
        } as VocabularyType));
    } catch (error) {
        console.error('❌ Error getting session vocabularies from SQLite:', error);
        return [];
    }
};

// ===== SEARCH CACHE =====

export const cacheSearchResult = async (query: string, result: any) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.runAsync(
                'INSERT OR REPLACE INTO search_cache (query, result, updatedAt) VALUES (?, ?, ?)',
                [query, JSON.stringify(result), Date.now()]
            );
        } catch (error) {
            console.error('❌ Error caching search result in SQLite:', error);
        }
    });
};

export const getCachedSearchResult = async (query: string): Promise<any | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const row: any = await db.getFirstAsync('SELECT * FROM search_cache WHERE query = ?', [query]);
        if (!row) return null;

        // Check if cache is expired
        if (Date.now() - row.updatedAt > CACHE_EXPIRY_MS) {
            return null;
        }

        return JSON.parse(row.result);
    } catch (error) {
        console.error('❌ Error getting cached search result from SQLite:', error);
        return null;
    }
};

// ===== ACTIVITY HELPERS =====

export const getDueCardsCount = async (): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        const now = Date.now();
        const row: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM learning_progress WHERE nextReview <= ?', [now]);
        return row?.count || 0;
    } catch (error) {
        console.error('❌ Error getting due cards count from SQLite:', error);
        return 0;
    }
};

export const getNewVocabCount = async (): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        const vocabCountRow: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM vocabularies');
        const touchedCountRow: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM learning_progress');

        const vocabCount = vocabCountRow?.count || 0;
        const touchedCount = touchedCountRow?.count || 0;

        return Math.max(0, vocabCount - touchedCount);
    } catch (error) {
        console.error('❌ Error getting new vocab count from SQLite:', error);
        return 0;
    }
};

export const getFlashcardActivityStats = async (): Promise<{ known: number; forgotten: number; total: number }> => {
    if (!db) await initDatabase();
    if (!db) return { known: 0, forgotten: 0, total: 0 };

    try {
        // Get the latest action for each unique vocabularyId
        const rows: any[] = await db.getAllAsync(`
            SELECT vocabularyId, action 
            FROM flashcard_activity 
            WHERE id IN (SELECT MAX(id) FROM flashcard_activity GROUP BY vocabularyId)
        `);

        let known = 0;
        let forgotten = 0;

        for (const row of rows) {
            if (row.action === 'know') known++;
            else if (row.action === 'forget') forgotten++;
        }

        return {
            known,
            forgotten,
            total: rows.length
        };
    } catch (error) {
        console.error('❌ Error getting flashcard activity stats from SQLite:', error);
        return { known: 0, forgotten: 0, total: 0 };
    }
};

export const getTodayActivityCount = async (): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.getTime();

        const row: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM flashcard_activity WHERE timestamp >= ?', [todayStart]);
        return row?.count || 0;
    } catch (error) {
        console.error('❌ Error getting today activity count from SQLite:', error);
        return 0;
    }
};

// ===== UTILITY =====

export const clearAllCache = async () => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.withTransactionAsync(async () => {
                await db!.runAsync('DELETE FROM vocabularies');
                await db!.runAsync('DELETE FROM resources');
                await db!.runAsync('DELETE FROM sync_metadata');
                await db!.runAsync('DELETE FROM learning_progress');
                await db!.runAsync('DELETE FROM flashcard_activity');
                await db!.runAsync('DELETE FROM search_cache');
            });
            console.log('✅ All SQLite cache cleared');
        } catch (error) {
            console.error('❌ Error clearing SQLite cache:', error);
        }
    });
};

export const getCacheStats = async () => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const rows: any[] = await db!.getAllAsync('SELECT * FROM sync_metadata');
        return rows.map(m => ({
            collection: m.collection,
            last_sync: m.lastSync,
            item_count: m.itemCount
        }));
    } catch (error) {
        console.error('❌ Error getting cache stats from SQLite:', error);
        return null;
    }
};

export const resetLocalCache = async () => {
    await clearAllCache();
    await AsyncStorage.removeItem('last_sync_timestamp');
};

// Backward compatibility or direct Firestore migration helper if needed
export const migrateFromFirestore = async (vocabularies: VocabularyType[]) => {
    return cacheVocabularies(vocabularies);
};

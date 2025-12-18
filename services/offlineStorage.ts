import type { Resource, Vocabulary } from '@/types';
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

// Cache expiry: 24 hours
const CACHE_EXPIRY_MS = 1000 * 60 * 30; // 30 minutes (aligned with web app for better sync)
export const initDatabase = async () => {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            db = await SQLite.openDatabaseAsync('ai_vocab.db');

            // Create tables (ensures fresh install works)
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS vocabularies (
                    id TEXT PRIMARY KEY,
                    english TEXT,
                    bangla TEXT,
                    part_of_speech TEXT,
                    data TEXT NOT NULL,
                    cached_at INTEGER NOT NULL,
                    updated_at_ts INTEGER DEFAULT 0
                );
                
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA busy_timeout = 5000;

                CREATE INDEX IF NOT EXISTS idx_vocab_english ON vocabularies(english);
                CREATE INDEX IF NOT EXISTS idx_vocab_bangla ON vocabularies(bangla);
                CREATE INDEX IF NOT EXISTS idx_vocab_pos ON vocabularies(part_of_speech);
                CREATE INDEX IF NOT EXISTS idx_vocab_updated ON vocabularies(updated_at_ts DESC);
                
                -- Optimization: Combined search index
                CREATE INDEX IF NOT EXISTS idx_vocab_search_combined ON vocabularies(english, bangla);

                CREATE TABLE IF NOT EXISTS grammar_images (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    data TEXT NOT NULL,
                    cached_at INTEGER NOT NULL,
                    updated_at_ts INTEGER DEFAULT 0
                );

                CREATE INDEX IF NOT EXISTS idx_grammar_title ON grammar_images(title);
                CREATE INDEX IF NOT EXISTS idx_grammar_updated ON grammar_images(updated_at_ts DESC);

                CREATE TABLE IF NOT EXISTS sync_metadata (
                    collection TEXT PRIMARY KEY,
                    last_sync INTEGER NOT NULL,
                    item_count INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS search_cache (
                    query TEXT PRIMARY KEY,
                    result TEXT,
                    updatedAt INTEGER
                );

                CREATE TABLE IF NOT EXISTS favorites (
                    vocabulary_id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS bookmarks (
                    resource_id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS vocabulary_learning_progress (
                    vocabulary_id TEXT PRIMARY KEY,
                    status TEXT DEFAULT 'new',
                    next_review INTEGER DEFAULT 0,
                    interval INTEGER DEFAULT 0,
                    ease_factor REAL DEFAULT 2.5,
                    repetitions INTEGER DEFAULT 0,
                    last_reviewed INTEGER DEFAULT 0,
                    is_difficult BOOLEAN DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS flashcard_activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    vocabulary_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    FOREIGN KEY (vocabulary_id) REFERENCES vocabularies(id)
                );

                CREATE INDEX IF NOT EXISTS idx_progress_next_review ON vocabulary_learning_progress(next_review);
                CREATE INDEX IF NOT EXISTS idx_progress_status ON vocabulary_learning_progress(status);
                CREATE INDEX IF NOT EXISTS idx_flashcard_activity_vocab ON flashcard_activity(vocabulary_id);
                CREATE INDEX IF NOT EXISTS idx_flashcard_activity_timestamp ON flashcard_activity(timestamp);
            `);

            // Verify if tables are correct, if not (e.g. missing columns), we add them
            const vocabInfo: any[] = await db.getAllAsync("PRAGMA table_info(vocabularies)");
            if (!vocabInfo.some(col => col.name === 'updated_at_ts')) {
                await db.execAsync("ALTER TABLE vocabularies ADD COLUMN updated_at_ts INTEGER DEFAULT 0;");
            }

            const grammarInfo: any[] = await db.getAllAsync("PRAGMA table_info(grammar_images)");
            if (!grammarInfo.some(col => col.name === 'updated_at_ts')) {
                await db.execAsync("ALTER TABLE grammar_images ADD COLUMN updated_at_ts INTEGER DEFAULT 0;");
            }

            // Check if flashcard_activity table exists, if not create it
            try {
                const tables: any[] = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='flashcard_activity'");
                if (tables.length === 0) {
                    console.log('📝 Creating flashcard_activity table...');
                    await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS flashcard_activity (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            vocabulary_id TEXT NOT NULL,
                            action TEXT NOT NULL,
                            timestamp INTEGER NOT NULL,
                            FOREIGN KEY (vocabulary_id) REFERENCES vocabularies(id)
                        );
                        
                        CREATE INDEX IF NOT EXISTS idx_flashcard_activity_vocab ON flashcard_activity(vocabulary_id);
                        CREATE INDEX IF NOT EXISTS idx_flashcard_activity_timestamp ON flashcard_activity(timestamp);
                    `);
                    console.log('✅ flashcard_activity table created successfully');
                }
            } catch (migrationError) {
                console.warn('⚠️ flashcard_activity table may already exist or migration skipped:', migrationError);
            }

            // Force one-time resync to fix the 1000-item limit bug and transition to Lazy Sync Architecture
            const resyncCheck = await db.getFirstAsync("SELECT last_sync FROM sync_metadata WHERE collection = 'vocabularies_resync_v4'");
            if (!resyncCheck) {
                console.log('🔄 Lazy Sync Architecture Transition: Clearing local cache for a fresh deep sync...');
                await db.execAsync("DELETE FROM vocabularies");
                await db.execAsync("DELETE FROM sync_metadata WHERE collection = 'vocabularies'");
                // Clear initial sync flag to force backfill
                await db.runAsync("INSERT INTO sync_metadata (collection, last_sync, item_count) VALUES ('vocabularies_resync_v4', ?, 0)", [Date.now()]);
            }

            console.log('✅ SQLite Database initialized with offline-first tables');
        } catch (error) {
            console.error('❌ Error initializing SQLite database:', error);
            initPromise = null; // Reset so it can be retried
            throw error;
        }
    })();

    return initPromise;
};

// Queue for database write operations to prevent transaction collisions
let writeQueue: Promise<any> = Promise.resolve();

const queueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
    const currentQueue = writeQueue;
    const nextTask = (async () => {
        try {
            // Wait for the previous operation to finish, even if it failed
            await currentQueue.catch(() => { });
            return await operation();
        } catch (error) {
            // Error is handled in the operation itself or by the caller
            throw error;
        }
    })();

    writeQueue = nextTask.catch(() => { }); // Ensure the queue itself never stays rejected
    return nextTask;
};

// ===== VOCABULARIES =====

export const cacheVocabularies = async (vocabularies: Vocabulary[]) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();

            await db!.withTransactionAsync(async () => {
                for (const vocab of vocabularies) {
                    const updatedAt = new Date(vocab.updatedAt || vocab.updated_at || vocab.createdAt || vocab.created_at || 0).getTime();
                    await db!.runAsync(
                        'INSERT OR REPLACE INTO vocabularies (id, english, bangla, part_of_speech, data, cached_at, updated_at_ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [vocab.id, vocab.english, vocab.bangla, vocab.partOfSpeech, JSON.stringify(vocab), now, updatedAt]
                    );
                }

                // Update sync metadata
                await db!.runAsync(
                    'INSERT OR REPLACE INTO sync_metadata (collection, last_sync, item_count) VALUES (?, ?, ?)',
                    ['vocabularies', now, vocabularies.length]
                );
            });

            console.log(`✅ Cached ${vocabularies.length} vocabularies`);
        } catch (error) {
            console.error('❌ Error caching vocabularies:', error);
            throw error;
        }
    });
};

export const getCachedVocabularies = async (options?: { partOfSpeech?: string; search?: string; onlyFavorites?: boolean }): Promise<{ data: Vocabulary[], isStale: boolean }> => {
    if (!db) await initDatabase();
    if (!db) return { data: [], isStale: true };

    try {
        const metadata: any = await db.getFirstAsync(
            'SELECT last_sync FROM sync_metadata WHERE collection = ?',
            ['vocabularies']
        );

        const isStale = !metadata || (Date.now() - metadata.last_sync > CACHE_EXPIRY_MS);

        // Diagnostic: Log total count
        const countRes: any = await db.getFirstAsync('SELECT COUNT(*) as total FROM vocabularies');
        console.log(`📊 Local Database: ${countRes?.total || 0} vocabularies found in cache.`);

        let query = 'SELECT v.data FROM vocabularies v';
        const params: any[] = [];

        if (options?.onlyFavorites) {
            query += ' INNER JOIN favorites f ON v.id = f.vocabulary_id';
        }

        query += ' WHERE v.english IS NOT NULL AND v.bangla IS NOT NULL';

        if (options?.partOfSpeech && options.partOfSpeech !== 'all') {
            query += ' AND part_of_speech = ?';
            params.push(options.partOfSpeech.toLowerCase());
        }

        if (options?.search) {
            const searchTerm = options.search.trim().toLowerCase();
            query += ' AND (LOWER(v.english) LIKE ? OR LOWER(v.bangla) LIKE ?)';
            params.push(`%${searchTerm}%`);
            params.push(`%${searchTerm}%`);
            console.log(`🔍 Searching local DB for: "${searchTerm}"`);
        }

        if (options?.onlyFavorites) {
            query += ' ORDER BY f.created_at DESC';
        } else {
            query += ' ORDER BY v.updated_at_ts DESC, v.id DESC';
        }

        const rows: any[] = await db.getAllAsync(query, params);
        let vocabularies = rows.map(row => JSON.parse(row.data)) as Vocabulary[];

        // Safety in-memory sorting ONLY if not onlyFavorites (where SQL sort is essential)
        if (!options?.onlyFavorites) {
            vocabularies.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
                const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
                return dateB - dateA;
            });
        }

        return { data: vocabularies, isStale };
    } catch (error) {
        console.error('❌ Error getting cached vocabularies:', error);
        return { data: [], isStale: true };
    }
};

// ===== RESOURCES =====

export const cacheResources = async (resources: Resource[]) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            const now = Date.now();

            await db!.withTransactionAsync(async () => {
                for (const resource of resources) {
                    const updatedAt = new Date(resource.createdAt || resource.created_at || 0).getTime();
                    await db!.runAsync(
                        'INSERT OR REPLACE INTO grammar_images (id, title, description, data, cached_at, updated_at_ts) VALUES (?, ?, ?, ?, ?, ?)',
                        [resource.id, resource.title || '', resource.description || '', JSON.stringify(resource), now, updatedAt]
                    );
                }

                await db!.runAsync(
                    'INSERT OR REPLACE INTO sync_metadata (collection, last_sync, item_count) VALUES (?, ?, ?)',
                    ['grammar_images', now, resources.length]
                );
            });

            console.log(`✅ Cached ${resources.length} grammar images`);
        } catch (error) {
            console.error('❌ Error caching grammar images:', error);
            throw error;
        }
    });
};

export const getCachedResources = async (options?: { search?: string; onlyBookmarks?: boolean }): Promise<{ data: Resource[], isStale: boolean }> => {
    if (!db) await initDatabase();
    if (!db) return { data: [], isStale: true };

    try {
        const metadata: any = await db.getFirstAsync(
            'SELECT last_sync FROM sync_metadata WHERE collection = ?',
            ['grammar_images']
        );

        const isStale = !metadata || (Date.now() - metadata.last_sync > CACHE_EXPIRY_MS);

        let query = 'SELECT r.data FROM grammar_images r';
        const params: any[] = [];

        if (options?.onlyBookmarks) {
            query += ' INNER JOIN bookmarks b ON r.id = b.resource_id';
        }

        if (options?.search) {
            const searchTerm = options.search.trim().toLowerCase();
            query += ' AND (LOWER(r.title) LIKE ? OR LOWER(r.description) LIKE ?)';
            params.push(`%${searchTerm}%`);
            params.push(`%${searchTerm}%`);
            console.log(`🔍 Searching resources for: "${searchTerm}"`);
        }

        if (options?.onlyBookmarks) {
            query += ' ORDER BY b.created_at DESC';
        } else {
            query += ' ORDER BY r.updated_at_ts DESC, r.id DESC';
        }

        const rows: any[] = await db.getAllAsync(query, params);
        const resources = rows.map(row => JSON.parse(row.data)) as Resource[];

        if (!options?.onlyBookmarks) {
            resources.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
                const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
                return dateB - dateA;
            });
        }

        return { data: resources, isStale };
    } catch (error) {
        console.error('❌ Error getting cached grammar images:', error);
        return { data: [], isStale: true };
    }
};

export const getVocabularyByIdFromCache = async (id: string): Promise<Vocabulary | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const row: any = await db.getFirstAsync('SELECT data FROM vocabularies WHERE id = ?', [id]);
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('❌ Error getting vocabulary by id from cache:', error);
        return null;
    }
};

export const getResourceByIdFromCache = async (id: string): Promise<Resource | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const row: any = await db.getFirstAsync('SELECT data FROM grammar_images WHERE id = ?', [id]);
        return row ? JSON.parse(row.data) : null;
    } catch (error) {
        console.error('❌ Error getting resource by id from cache:', error);
        return null;
    }
};

// Redundant functions removed - use cacheResources / getCachedResources instead

// ===== SEARCH CACHE (existing) =====

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
            console.error('Error caching search result:', error);
        }
    });
};

// ===== SYNC METADATA =====

export const getCollectionMetadata = async (collection: string) => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const metadata: any = await db.getFirstAsync(
            'SELECT last_sync, item_count FROM sync_metadata WHERE collection = ?',
            [collection]
        );
        return metadata ? { lastSync: metadata.last_sync, itemCount: metadata.item_count } : null;
    } catch (error) {
        console.error(`❌ Error getting ${collection} metadata:`, error);
        return null;
    }
};

export const updateLastSyncMetadata = async (collection: string, itemCount: number) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.runAsync(
                'INSERT OR REPLACE INTO sync_metadata (collection, last_sync, item_count) VALUES (?, ?, ?)',
                [collection, Date.now(), itemCount]
            );
        } catch (error) {
            console.error(`❌ Error updating ${collection} metadata:`, error);
        }
    });
};

export const getLatestUpdatedTimestamp = async (collectionName: string): Promise<string | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const tableName = collectionName === 'vocabularies' ? 'vocabularies' : 'grammar_images';
        const row: any = await db.getFirstAsync(`SELECT MAX(updated_at_ts) as max_ts FROM ${tableName}`);

        if (!row || !row.max_ts) return null;

        return new Date(row.max_ts).toISOString();
    } catch (error) {
        console.error('❌ Error getting latest updated timestamp:', error);
        return null;
    }
};

export const getOldestUpdatedTimestamp = async (collectionName: string): Promise<string | null> => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const tableName = collectionName === 'vocabularies' ? 'vocabularies' : 'grammar_images';
        const row: any = await db.getFirstAsync(`SELECT MIN(updated_at_ts) as min_ts FROM ${tableName}`);

        if (!row || !row.min_ts) return null;

        return new Date(row.min_ts).toISOString();
    } catch (error) {
        console.error('❌ Error getting oldest updated timestamp:', error);
        return null;
    }
};

export const isCacheEmpty = async (collectionName: string): Promise<boolean> => {
    if (!db) await initDatabase();
    if (!db) return true;

    try {
        const tableName = collectionName === 'vocabularies' ? 'vocabularies' : 'grammar_images';
        const countObj: any = await db.getFirstAsync(`SELECT COUNT(*) as count FROM ${tableName}`);
        return !countObj || countObj.count === 0;
    } catch (error) {
        console.error(`❌ Error checking if ${collectionName} cache is empty:`, error);
        return true;
    }
};

export const getCachedSearchResult = async (query: string) => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const result: any = await db.getFirstAsync(
            'SELECT result FROM search_cache WHERE query = ?',
            [query]
        );
        return result ? JSON.parse(result.result) : null;
    } catch (error) {
        console.error('Error getting cached search result:', error);
        return null;
    }
};

// ===== FAVORITES / BOOKMARKS (SQLite backed) =====

export const addFavoriteVocab = async (vocabId: string) => {
    if (!db) await initDatabase();
    return queueWrite(async () => {
        await db!.runAsync(
            'INSERT OR IGNORE INTO favorites (vocabulary_id, created_at) VALUES (?, ?)',
            [vocabId, Date.now()]
        );
    });
};

export const removeFavoriteVocab = async (vocabId: string) => {
    if (!db) await initDatabase();
    return queueWrite(async () => {
        await db!.runAsync('DELETE FROM favorites WHERE vocabulary_id = ?', [vocabId]);
    });
};

export const isVocabFavorited = async (vocabId: string): Promise<boolean> => {
    if (!db) await initDatabase();
    try {
        const row: any = await db!.getFirstAsync('SELECT created_at FROM favorites WHERE vocabulary_id = ?', [vocabId]);
        return !!row;
    } catch (error) {
        return false;
    }
};

export const getFavoriteVocabIds = async (): Promise<string[]> => {
    if (!db) await initDatabase();
    try {
        const rows: any[] = await db!.getAllAsync('SELECT vocabulary_id FROM favorites');
        return rows.map(r => r.vocabulary_id);
    } catch (error) {
        return [];
    }
};

export const addBookmarkResource = async (resourceId: string) => {
    if (!db) await initDatabase();
    return queueWrite(async () => {
        await db!.runAsync(
            'INSERT OR IGNORE INTO bookmarks (resource_id, created_at) VALUES (?, ?)',
            [resourceId, Date.now()]
        );
    });
};

export const removeBookmarkResource = async (resourceId: string) => {
    if (!db) await initDatabase();
    return queueWrite(async () => {
        await db!.runAsync('DELETE FROM bookmarks WHERE resource_id = ?', [resourceId]);
    });
};

export const isResourceBookmarked = async (resourceId: string): Promise<boolean> => {
    if (!db) await initDatabase();
    try {
        const row: any = await db!.getFirstAsync('SELECT created_at FROM bookmarks WHERE resource_id = ?', [resourceId]);
        return !!row;
    } catch (error) {
        return false;
    }
};

export const getBookmarkResourceIds = async (): Promise<string[]> => {
    if (!db) await initDatabase();
    try {
        const rows: any[] = await db!.getAllAsync('SELECT resource_id FROM bookmarks');
        return rows.map(r => r.resource_id);
    } catch (error) {
        return [];
    }
};


// ===== LEARNING / FLASHCARD PROGRESS (SRS) =====

export interface LearningProgress {
    vocabulary_id: string;
    status: 'new' | 'learning' | 'review' | 'mastered';
    next_review: number;
    interval: number;
    ease_factor: number;
    repetitions: number;
    last_reviewed: number;
    is_difficult: boolean;
}

export const getVocabulariesForSession = async (limit: number = 50, mode: 'mixed' | 'new' | 'review' | 'hardest' = 'mixed'): Promise<Vocabulary[]> => {
    if (!db) await initDatabase();
    if (!db) return [];

    try {
        let query = '';
        let params: any[] = [];
        const now = Date.now();

        // Base query joins vocabularies with progress
        // We select the raw data string from vocabularies

        if (mode === 'review') {
            query = `
                SELECT v.data FROM vocabularies v
                JOIN vocabulary_learning_progress p ON v.id = p.vocabulary_id
                WHERE p.next_review <= ?
                ORDER BY p.next_review ASC
                LIMIT ?
            `;
            params = [now, limit];
        } else if (mode === 'new') {
            // Select items NOT in progress table OR items with status 'new'
            query = `
                SELECT v.data FROM vocabularies v
                LEFT JOIN vocabulary_learning_progress p ON v.id = p.vocabulary_id
                WHERE p.vocabulary_id IS NULL OR p.status = 'new'
                ORDER BY RANDOM()
                LIMIT ?
            `;
            params = [limit];
        } else if (mode === 'hardest') {
            query = `
                SELECT v.data FROM vocabularies v
                JOIN vocabulary_learning_progress p ON v.id = p.vocabulary_id
                WHERE p.is_difficult = 1 OR p.ease_factor < 2.0
                ORDER BY p.ease_factor ASC
                LIMIT ?
            `;
            params = [limit];
        } else {
            // Mixed: Some due reviews, some new
            // This is a bit complex in one query, so simplistically:
            // Prioritize due reviews, then fill with new
            query = `
                SELECT v.data, p.next_review FROM vocabularies v
                LEFT JOIN vocabulary_learning_progress p ON v.id = p.vocabulary_id
                WHERE (p.next_review <= ? OR p.next_review IS NULL)
                ORDER BY CASE WHEN p.next_review IS NOT NULL THEN 0 ELSE 1 END, p.next_review ASC
                LIMIT ?
            `;
            params = [now, limit];
        }

        const rows: any[] = await db.getAllAsync(query, params);
        return rows.map(row => JSON.parse(row.data));
    } catch (error) {
        console.error('❌ Error getting flashcards:', error);
        return [];
    }
};

// NEW: Batch flashcard action to prevent lock contention
export const processFlashcardAction = async (
    vocabId: string,
    action: 'know' | 'forget'
) => {
    if (!db) await initDatabase();
    if (!db) return;

    const quality = action === 'know' ? 4 : 0;

    return queueWrite(async () => {
        try {
            await db!.withTransactionAsync(async () => {
                const now = Date.now();

                // 1. Record History
                await db!.runAsync(
                    'INSERT INTO flashcard_activity (vocabulary_id, action, timestamp) VALUES (?, ?, ?)',
                    [vocabId, action, now]
                );

                // 2. Process SRS Logic
                let progress: LearningProgress | null = await db!.getFirstAsync(
                    'SELECT * FROM vocabulary_learning_progress WHERE vocabulary_id = ?',
                    [vocabId]
                ) as LearningProgress | null;

                if (!progress) {
                    progress = {
                        vocabulary_id: vocabId,
                        status: 'new',
                        next_review: 0,
                        interval: 0,
                        ease_factor: 2.5,
                        repetitions: 0,
                        last_reviewed: 0,
                        is_difficult: false
                    };
                }

                let { interval, repetitions, ease_factor } = progress;

                if (quality >= 3) {
                    if (repetitions === 0) {
                        interval = 1;
                    } else if (repetitions === 1) {
                        interval = 6;
                    } else {
                        interval = Math.round(interval * ease_factor);
                    }
                    repetitions += 1;
                } else {
                    repetitions = 0;
                    interval = 1;
                }

                ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
                if (ease_factor < 1.3) ease_factor = 1.3;

                const next_review = now + (interval * 24 * 60 * 60 * 1000);
                const status = interval > 21 ? 'mastered' : (repetitions > 0 ? 'review' : 'learning');
                const is_difficult = ease_factor < 2.0;

                await db!.runAsync(`
                    INSERT OR REPLACE INTO vocabulary_learning_progress 
                    (vocabulary_id, status, next_review, interval, ease_factor, repetitions, last_reviewed, is_difficult)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [vocabId, status, next_review, interval, ease_factor, repetitions, now, is_difficult]);
            });
        } catch (error) {
            console.error('❌ Error processing flashcard action:', error);
            throw error;
        }
    });
};

export const updateVocabularyProgress = async (
    vocabId: string,
    quality: number // 0-5 (0=wrong, 3-5=correct/easy)
) => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            // Get current progress or default
            let progress: LearningProgress | null = await db!.getFirstAsync(
                'SELECT * FROM vocabulary_learning_progress WHERE vocabulary_id = ?',
                [vocabId]
            ) as LearningProgress | null;

            if (!progress) {
                progress = {
                    vocabulary_id: vocabId,
                    status: 'new',
                    next_review: 0,
                    interval: 0,
                    ease_factor: 2.5,
                    repetitions: 0,
                    last_reviewed: 0,
                    is_difficult: false
                };
            }

            // Simplified SM-2 Algorithm
            // Performance rating: 0-2 = Fail, 3-5 = Pass

            let { interval, repetitions, ease_factor } = progress;
            const now = Date.now();

            if (quality >= 3) {
                // Correct response
                if (repetitions === 0) {
                    interval = 1; // 1 day
                } else if (repetitions === 1) {
                    interval = 6; // 6 days
                } else {
                    interval = Math.round(interval * ease_factor);
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
            ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
            if (ease_factor < 1.3) ease_factor = 1.3;

            const next_review = now + (interval * 24 * 60 * 60 * 1000);
            const status = interval > 21 ? 'mastered' : (repetitions > 0 ? 'review' : 'learning');
            const is_difficult = ease_factor < 2.0;

            await db!.runAsync(`
                INSERT OR REPLACE INTO vocabulary_learning_progress 
                (vocabulary_id, status, next_review, interval, ease_factor, repetitions, last_reviewed, is_difficult)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [vocabId, status, next_review, interval, ease_factor, repetitions, now, is_difficult]);

        } catch (error) {
            console.error('❌ Error updating progress:', error);
        }
    });
};

export const getLearningStats = async () => {
    if (!db) await initDatabase();
    if (!db) return { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0 };

    try {
        const stats: any = await db.getFirstAsync(`
            SELECT 
                COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count,
                COUNT(CASE WHEN status = 'learning' THEN 1 END) as learning_count,
                COUNT(CASE WHEN status = 'review' THEN 1 END) as review_count,
                COUNT(CASE WHEN status = 'mastered' THEN 1 END) as mastered_count,
                COUNT(CASE WHEN is_difficult = 1 THEN 1 END) as difficult_count
            FROM vocabulary_learning_progress
        `);

        // We also need to count total vocabs to know how many are "truly new" (never touched)
        const totalVocabs: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM vocabularies');
        const touchedCount: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM vocabulary_learning_progress');

        const untouched = (totalVocabs?.count || 0) - (touchedCount?.count || 0);

        return {
            new: (stats?.new_count || 0) + Math.max(0, untouched),
            learning: stats?.learning_count || 0,
            review: stats?.review_count || 0,
            mastered: stats?.mastered_count || 0,
            difficult: stats?.difficult_count || 0
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return { new: 0, learning: 0, review: 0, mastered: 0, difficult: 0 };
    }
};

// ===== NOTIFICATION HELPERS =====

export const getDueCardsCount = async (): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        const now = Date.now();
        const result: any = await db.getFirstAsync(
            'SELECT COUNT(*) as count FROM vocabulary_learning_progress WHERE next_review <= ?',
            [now]
        );
        return result?.count || 0;
    } catch (error) {
        console.error('Error getting due cards count:', error);
        return 0;
    }
};

export const getNewVocabCount = async (): Promise<number> => {
    if (!db) await initDatabase();
    if (!db) return 0;

    try {
        // Count vocabularies not in progress table (never studied)
        const result: any = await db.getFirstAsync(`
            SELECT COUNT(*) as count FROM vocabularies v
            LEFT JOIN vocabulary_learning_progress p ON v.id = p.vocabulary_id
            WHERE p.vocabulary_id IS NULL
        `);
        return result?.count || 0;
    } catch (error) {
        console.error('Error getting new vocab count:', error);
        return 0;
    }
};

// Redundant recordFlashcardActivity removed - use processFlashcardAction

export const getFlashcardActivityStats = async (): Promise<{ known: number; forgotten: number; total: number }> => {
    if (!db) await initDatabase();
    if (!db) return { known: 0, forgotten: 0, total: 0 };

    try {
        // Get latest action for each vocabulary
        const result: any = await db.getFirstAsync(`
            SELECT 
                COUNT(DISTINCT CASE WHEN latest_action = 'know' THEN vocabulary_id END) as known_count,
                COUNT(DISTINCT CASE WHEN latest_action = 'forget' THEN vocabulary_id END) as forgotten_count,
                COUNT(DISTINCT vocabulary_id) as total_count
            FROM (
                SELECT 
                    vocabulary_id,
                    action as latest_action,
                    ROW_NUMBER() OVER (PARTITION BY vocabulary_id ORDER BY timestamp DESC) as rn
                FROM flashcard_activity
            )
            WHERE rn = 1
        `);

        return {
            known: result?.known_count || 0,
            forgotten: result?.forgotten_count || 0,
            total: result?.total_count || 0
        };
    } catch (error) {
        console.error('Error getting flashcard activity stats:', error);
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

        const result: any = await db.getFirstAsync(
            'SELECT COUNT(*) as count FROM flashcard_activity WHERE timestamp >= ?',
            [todayStart]
        );

        return result?.count || 0;
    } catch (error) {
        console.error('Error getting today activity count:', error);
        return 0;
    }
};

// ===== UTILITY =====

export const clearAllCache = async () => {
    if (!db) await initDatabase();
    if (!db) return;

    return queueWrite(async () => {
        try {
            await db!.execAsync(`
                DELETE FROM vocabularies;
                DELETE FROM grammar_images;
                DELETE FROM sync_metadata;
                DELETE FROM search_cache;
            `);
            console.log('✅ All cache cleared');
        } catch (error) {
            console.error('❌ Error clearing cache:', error);
        }
    });
};

export const getCacheStats = async () => {
    if (!db) await initDatabase();
    if (!db) return null;

    try {
        const stats: any[] = await db.getAllAsync(`
            SELECT collection, last_sync, item_count 
            FROM sync_metadata
        `);
        return stats;
    } catch (error) {
        console.error('❌ Error getting cache stats:', error);
        return null;
    }
};

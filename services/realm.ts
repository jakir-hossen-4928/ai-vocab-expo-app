import { createRealmContext } from '@realm/react';
import Realm from 'realm';

// 1. Vocabulary Schema
export class Vocabulary extends Realm.Object<Vocabulary> {
    id!: string;
    english!: string;
    bangla!: string;
    partOfSpeech?: string;
    data!: string; // JSON string of full vocabulary object
    cachedAt!: number;
    updatedAtTs!: number;
    isFavorite!: boolean;

    static schema = {
        name: 'Vocabulary',
        primaryKey: 'id',
        properties: {
            id: 'string',
            english: { type: 'string', indexed: true },
            bangla: { type: 'string', indexed: true },
            partOfSpeech: { type: 'string', indexed: true, optional: true },
            data: 'string',
            cachedAt: 'int',
            updatedAtTs: { type: 'int', indexed: true },
            isFavorite: { type: 'bool', default: false, indexed: true },
        },
    };
}

// 2. Resource Schema (Grammar Images)
export class Resource extends Realm.Object<Resource> {
    id!: string;
    title?: string;
    description?: string;
    data!: string; // JSON string
    cachedAt!: number;
    updatedAtTs!: number;
    isBookmarked!: boolean;

    static schema = {
        name: 'Resource',
        primaryKey: 'id',
        properties: {
            id: 'string',
            title: { type: 'string', indexed: true, optional: true },
            description: 'string?',
            data: 'string',
            cachedAt: 'int',
            updatedAtTs: { type: 'int', indexed: true },
            isBookmarked: { type: 'bool', default: false, indexed: true },
        },
    };
}

// 3. Sync Metadata Schema
export class SyncMetadata extends Realm.Object<SyncMetadata> {
    collection!: string;
    lastSync!: number;
    itemCount!: number;

    static schema = {
        name: 'SyncMetadata',
        primaryKey: 'collection',
        properties: {
            collection: 'string',
            lastSync: 'int',
            itemCount: 'int',
        },
    };
}

// 4. Search Cache Schema
export class SearchCache extends Realm.Object<SearchCache> {
    query!: string;
    result!: string; // JSON string
    updatedAt!: number;

    static schema = {
        name: 'SearchCache',
        primaryKey: 'query',
        properties: {
            query: 'string',
            result: 'string',
            updatedAt: 'int',
        },
    };
}

// 5. Vocabulary Learning Progress (SRS)
export class LearningProgress extends Realm.Object<LearningProgress> {
    vocabularyId!: string;
    status!: string; // 'new' | 'learning' | 'review' | 'mastered'
    nextReview!: number;
    interval!: number;
    easeFactor!: number;
    repetitions!: number;
    lastReviewed!: number;
    isDifficult!: boolean;

    static schema = {
        name: 'LearningProgress',
        primaryKey: 'vocabularyId',
        properties: {
            vocabularyId: 'string',
            status: { type: 'string', default: 'new', indexed: true },
            nextReview: { type: 'int', default: 0, indexed: true },
            interval: { type: 'int', default: 0 },
            easeFactor: { type: 'double', default: 2.5 },
            repetitions: { type: 'int', default: 0 },
            lastReviewed: { type: 'int', default: 0 },
            isDifficult: { type: 'bool', default: false, indexed: true },
        },
    };
}

// 6. Flashcard Activity
export class FlashcardActivity extends Realm.Object<FlashcardActivity> {
    id!: number;
    vocabularyId!: string;
    action!: string; // 'know' | 'forget'
    timestamp!: number;

    static schema = {
        name: 'FlashcardActivity',
        primaryKey: 'id',
        properties: {
            id: 'int',
            vocabularyId: { type: 'string', indexed: true },
            action: 'string',
            timestamp: { type: 'int', indexed: true },
        },
    };
}

// Configuration
export const realmConfig: Realm.Configuration = {
    schema: [
        Vocabulary,
        Resource,
        SyncMetadata,
        SearchCache,
        LearningProgress,
        FlashcardActivity
    ],
    schemaVersion: 1,
    deleteRealmIfMigrationNeeded: true, // During development
};

// Create Realm Context for React integration if needed
export const { RealmProvider, useRealm, useQuery, useObject } = createRealmContext(realmConfig);

// Standalone Realm instance for non-React service calls
let standaloneRealm: Realm | null = null;

export const getRealm = async () => {
    if (!standaloneRealm || standaloneRealm.isClosed) {
        standaloneRealm = await Realm.open(realmConfig);
    }
    return standaloneRealm;
};

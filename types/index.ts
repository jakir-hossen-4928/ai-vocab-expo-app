// Vocabulary Types
export interface VocabularyExample {
    bn: string;
    en: string;
}

export interface VerbForms {
    base: string;
    v2: string;
    v3: string;
    ing: string;
    s_es: string;
}

export interface RelatedWord {
    word: string;
    example: string;
    meaning: string;
    partOfSpeech: string;
}

export interface Vocabulary {
    id: string;
    bangla: string;
    english: string;
    partOfSpeech: string;
    pronunciation: string;
    examples: VocabularyExample[];
    synonyms: string[];
    antonyms: string[];
    explanation: string;
    meaning?: string;
    // Firestore timestamps (can be Timestamp or string)
    created_at?: any;
    updated_at?: any;
    createdAt?: string; // For compatibility
    updatedAt?: string; // For compatibility
    userId?: string;
    difficulty_level?: string;
    // Optional fields
    isFavorite?: boolean;
    nextReviewDate?: string | null;
    interval?: number;
    repetition?: number;
    difficulty?: number;
    origin?: string;
    audioUrl?: string | null;
    isFromAPI?: boolean;
    isOnline?: boolean;
    isOnlineResult?: boolean;
    verbForms?: VerbForms;
    relatedWords?: RelatedWord[];
}

export type PartOfSpeech =
    | "noun"
    | "verb"
    | "adjective"
    | "adverb"
    | "pronoun"
    | "preposition"
    | "conjunction"
    | "interjection"
    | "phrase"
    | "idiom"
    | "phrasal verb"
    | "collocation"
    | "linking phrase";

// Resource Types
export interface Resource {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    thumbnailUrl?: string; // Matching web app
    link?: string;
    type?: string;
    thumbnail?: string; // For backward compatibility
    created_at?: any;
    updated_at?: any;
    createdAt?: string; // For compatibility
    updatedAt?: string; // For compatibility
    userId?: string;
}

// User Types
export interface User {
    id?: string;
    createdAt: string;
    displayName: string;
    email: string;
    lastLogin: any; // Firestore Timestamp or Date
    photoURL: string;
    role: 'admin' | 'user';
}

// Auth Types
export interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

// API Response Types
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

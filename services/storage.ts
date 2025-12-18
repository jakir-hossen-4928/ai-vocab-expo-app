import * as SecureStore from 'expo-secure-store';

// Keys
const FAVORITES_KEY = 'favorites';
const BOOKMARKS_KEY = 'bookmarks';
// Legacy keys - no longer used for data, kept for potential migration if needed
// const FAVORITE_VOCABS_DATA_KEY = 'favorite_vocabs_data';
// const BOOKMARK_RESOURCES_DATA_KEY = 'bookmark_resources_data';

import type { Resource, Vocabulary } from '@/types';
import * as OfflineStorage from './offlineStorage';

// Favorites (Vocabularies) - Store complete data
// Favorites (Vocabularies) - SQLite Backed
export const getFavorites = async (): Promise<string[]> => {
    return OfflineStorage.getFavoriteVocabIds();
};

export const getFavoriteVocabulariesData = async (): Promise<Vocabulary[]> => {
    try {
        const cached = await OfflineStorage.getCachedVocabularies({ onlyFavorites: true });
        return cached.data;
    } catch (error) {
        console.error('Error getting favorite vocabularies data:', error);
        return [];
    }
};

export const addFavorite = async (id: string, vocabularyData?: any): Promise<boolean> => {
    try {
        await OfflineStorage.addFavoriteVocab(id);
        return true;
    } catch (error) {
        console.error('Error adding favorite:', error);
        return false;
    }
};

export const removeFavorite = async (id: string): Promise<boolean> => {
    try {
        await OfflineStorage.removeFavoriteVocab(id);
        return true;
    } catch (error) {
        console.error('Error removing favorite:', error);
        return false;
    }
};

export const isFavorite = async (id: string): Promise<boolean> => {
    return OfflineStorage.isVocabFavorited(id);
};

// Bookmarks (Resources) - Store complete data
// Bookmarks (Resources) - SQLite Backed
export const getBookmarks = async (): Promise<string[]> => {
    return OfflineStorage.getBookmarkResourceIds();
};

export const getBookmarkedResourcesData = async (): Promise<Resource[]> => {
    try {
        const cached = await OfflineStorage.getCachedResources({ onlyBookmarks: true });
        return cached.data;
    } catch (error) {
        console.error('Error getting bookmarked resources data:', error);
        return [];
    }
};

export const addBookmark = async (id: string, resourceData?: any): Promise<boolean> => {
    try {
        await OfflineStorage.addBookmarkResource(id);
        return true;
    } catch (error) {
        console.error('Error adding bookmark:', error);
        return false;
    }
};

export const removeBookmark = async (id: string): Promise<boolean> => {
    try {
        await OfflineStorage.removeBookmarkResource(id);
        return true;
    } catch (error) {
        console.error('Error removing bookmark:', error);
        return false;
    }
};

export const isBookmarked = async (id: string): Promise<boolean> => {
    return OfflineStorage.isResourceBookmarked(id);
};

// Migration logic: Moves IDs from SecureStore to SQLite
export const migrateSecureStoreData = async () => {
    try {
        // 1. Migrate Favorites
        const oldFavsJson = await SecureStore.getItemAsync(FAVORITES_KEY);
        if (oldFavsJson) {
            const ids: string[] = JSON.parse(oldFavsJson);
            console.log(`🚚 Migrating ${ids.length} favorites to SQLite...`);
            for (const id of ids) {
                await OfflineStorage.addFavoriteVocab(id);
            }
            // Clear old key
            await SecureStore.deleteItemAsync(FAVORITES_KEY);
            // Also clear large data key if it exists
            await SecureStore.deleteItemAsync('favorite_vocabs_data');
        }

        // 2. Migrate Bookmarks
        const oldBookmarksJson = await SecureStore.getItemAsync(BOOKMARKS_KEY);
        if (oldBookmarksJson) {
            const ids: string[] = JSON.parse(oldBookmarksJson);
            console.log(`🚚 Migrating ${ids.length} bookmarks to SQLite...`);
            for (const id of ids) {
                await OfflineStorage.addBookmarkResource(id);
            }
            // Clear old key
            await SecureStore.deleteItemAsync(BOOKMARKS_KEY);
            // Also clear large data key if it exists
            await SecureStore.deleteItemAsync('bookmark_resources_data');
        }

        console.log('✅ SecureStore migration complete.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
};
// OpenRouter API Key
const OPENROUTER_API_KEY = 'openrouter_api_key';

export const getOpenRouterApiKey = async (): Promise<string | null> => {
    try {
        return await SecureStore.getItemAsync(OPENROUTER_API_KEY);
    } catch (error) {
        console.error('Error getting OpenRouter API key:', error);
        return null;
    }
};

export const setOpenRouterApiKey = async (apiKey: string): Promise<boolean> => {
    try {
        await SecureStore.setItemAsync(OPENROUTER_API_KEY, apiKey);
        return true;
    } catch (error) {
        console.error('Error setting OpenRouter API key:', error);
        return false;
    }
};

// AI Model
const AI_MODEL_KEY = 'ai_model';
const DEFAULT_MODEL = 'google/gemma-2-9b-it:free';

export const getAIModel = async (): Promise<string> => {
    try {
        const model = await SecureStore.getItemAsync(AI_MODEL_KEY);
        return model || DEFAULT_MODEL;
    } catch (error) {
        return DEFAULT_MODEL;
    }
};

export const setAIModel = async (model: string): Promise<boolean> => {
    try {
        await SecureStore.setItemAsync(AI_MODEL_KEY, model);
        return true;
    } catch (error) {
        console.error('Error setting AI model:', error);
        return false;
    }
};

// TTS Settings
const TTS_SETTINGS_KEY = 'tts_settings';

export interface TTSSettings {
    pitch: number;
    rate: number;
    voiceIdentifier?: string;
}

const DEFAULT_TTS: TTSSettings = {
    pitch: 1.0,
    rate: 1.0,
};

export const getTTSSettings = async (): Promise<TTSSettings> => {
    try {
        const data = await SecureStore.getItemAsync(TTS_SETTINGS_KEY);
        return data ? JSON.parse(data) : DEFAULT_TTS;
    } catch (error) {
        return DEFAULT_TTS;
    }
};

export const setTTSSettings = async (settings: TTSSettings): Promise<boolean> => {
    try {
        await SecureStore.setItemAsync(TTS_SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('Error setting TTS settings:', error);
        return false;
    }
};

// Chat Sessions
const CHAT_SESSIONS_KEY = 'chat_sessions';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatSession {
    vocabularyId: string;
    messages: ChatMessage[];
    updatedAt: number;
}

export const getChatSession = async (vocabularyId: string): Promise<ChatSession | null> => {
    try {
        const sessionsJson = await SecureStore.getItemAsync(CHAT_SESSIONS_KEY);
        if (!sessionsJson) return null;

        const sessions: Record<string, ChatSession> = JSON.parse(sessionsJson);
        return sessions[vocabularyId] || null;
    } catch (error) {
        console.error('Error getting chat session:', error);
        return null;
    }
};

export const saveChatSession = async (vocabularyId: string, messages: ChatMessage[]): Promise<boolean> => {
    try {
        const sessionsJson = await SecureStore.getItemAsync(CHAT_SESSIONS_KEY);
        const sessions: Record<string, ChatSession> = sessionsJson ? JSON.parse(sessionsJson) : {};

        sessions[vocabularyId] = {
            vocabularyId,
            messages,
            updatedAt: Date.now()
        };

        await SecureStore.setItemAsync(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
        return true;
    } catch (error) {
        console.error('Error saving chat session:', error);
        return false;
    }
};

// Notification Settings
const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export interface NotificationSettings {
    enabled: boolean;
    dailyReminderTime: { hour: number; minute: number };
    vocabularyNotifications: boolean;
    quizNotifications: boolean;
    notificationFrequency: 'daily' | 'twice' | 'thrice';
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
    enabled: false,
    dailyReminderTime: { hour: 9, minute: 0 },
    vocabularyNotifications: true,
    quizNotifications: true,
    notificationFrequency: 'daily',
};

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
    try {
        const data = await SecureStore.getItemAsync(NOTIFICATION_SETTINGS_KEY);
        return data ? JSON.parse(data) : DEFAULT_NOTIFICATION_SETTINGS;
    } catch (error) {
        console.error('Error getting notification settings:', error);
        return DEFAULT_NOTIFICATION_SETTINGS;
    }
};

export const setNotificationSettings = async (settings: NotificationSettings): Promise<boolean> => {
    try {
        await SecureStore.setItemAsync(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('Error setting notification settings:', error);
        return false;
    }
};

// Initial Sync State
const INITIAL_SYNC_COMPLETE_KEY = 'initial_sync_complete_v1';

export const getInitialSyncDone = async (): Promise<boolean> => {
    try {
        const val = await SecureStore.getItemAsync(INITIAL_SYNC_COMPLETE_KEY);
        return val === 'true';
    } catch (error) {
        return false;
    }
};

export const setInitialSyncDone = async (done: boolean): Promise<boolean> => {
    try {
        await SecureStore.setItemAsync(INITIAL_SYNC_COMPLETE_KEY, done ? 'true' : 'false');
        return true;
    } catch (error) {
        console.error('Error setting initial sync flag:', error);
        return false;
    }
};

// ===== STREAK TRACKING =====

const LAST_STUDY_DATE_KEY = 'last_study_date';
const STUDY_STREAK_KEY = 'study_streak';

export const updateStudyStreak = async () => {
    try {
        const today = new Date().toDateString();
        const lastStudyDate = await SecureStore.getItemAsync(LAST_STUDY_DATE_KEY);

        if (lastStudyDate === today) {
            // Already studied today
            return;
        }

        const currentStreak = await getStudyStreak();

        if (lastStudyDate) {
            const lastDate = new Date(lastStudyDate);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (lastDate.toDateString() === yesterday.toDateString()) {
                // Consecutive day - increment streak
                await SecureStore.setItemAsync(STUDY_STREAK_KEY, String(currentStreak + 1));
            } else {
                // Streak broken - reset to 1
                await SecureStore.setItemAsync(STUDY_STREAK_KEY, '1');
            }
        } else {
            // First time studying
            await SecureStore.setItemAsync(STUDY_STREAK_KEY, '1');
        }

        await SecureStore.setItemAsync(LAST_STUDY_DATE_KEY, today);
    } catch (error) {
        console.error('Error updating study streak:', error);
    }
};

export const getStudyStreak = async (): Promise<number> => {
    try {
        const streak = await SecureStore.getItemAsync(STUDY_STREAK_KEY);
        return streak ? parseInt(streak, 10) : 0;
    } catch (error) {
        return 0;
    }
};

export const getLastStudyDate = async (): Promise<string | null> => {
    try {
        return await SecureStore.getItemAsync(LAST_STUDY_DATE_KEY);
    } catch (error) {
        return null;
    }
};

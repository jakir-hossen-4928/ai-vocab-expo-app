
import { addToBookmarks, addToFavorites, getBookmarkedResources, getFavoriteVocabularies, removeFromBookmarks, removeFromFavorites, Resource, Vocabulary } from './api';

export interface FavoriteVocabulary extends Vocabulary { }
export interface FavoriteResource extends Resource { }

// Re-exporting from api.ts to maintain potential compatibility or future separation
export const fetchFavoriteVocabularies = getFavoriteVocabularies;
export const fetchFavoriteResources = getBookmarkedResources;
export const toggleVocabularyFavorite = async (id: string, currentState: boolean, vocabularyData?: any): Promise<boolean> => {
    if (currentState) {
        await removeFromFavorites(id);
        return false;
    } else {
        if (vocabularyData) {
            await addToFavorites(vocabularyData);
        }
        return true;
    }
};

export const toggleResourceBookmark = async (id: string, currentState: boolean, resourceData?: any): Promise<boolean> => {
    if (currentState) {
        await removeFromBookmarks(id);
        return false;
    } else {
        if (resourceData) {
            await addToBookmarks(resourceData);
        }
        return true;
    }
};

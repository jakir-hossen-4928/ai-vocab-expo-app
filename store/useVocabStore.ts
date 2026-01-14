import { getFavoriteVocabularies } from '@/services/api';
import { create } from 'zustand';

interface VocabState {
  searchQuery: string;
  selectedFilter: string;
  favorites: string[];
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedFilter: (filter: string) => void;
  setFavorites: (favorites: string[]) => void;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (id: string, isFav: boolean) => void;
}

export const useVocabStore = create<VocabState>((set) => ({
  searchQuery: '',
  selectedFilter: 'all',
  favorites: [],

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedFilter: (selectedFilter) => set({ selectedFilter }),
  setFavorites: (favorites) => set({ favorites }),

  loadFavorites: async () => {
    try {
      const favs = await getFavoriteVocabularies();
      set({ favorites: favs.map((f) => f.id) });
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  },

  toggleFavorite: (id, isFav) => {
    set((state) => {
      if (isFav) {
        return { favorites: state.favorites.filter((fId) => fId !== id) };
      } else {
        return { favorites: [...state.favorites, id] };
      }
    });
  },
}));

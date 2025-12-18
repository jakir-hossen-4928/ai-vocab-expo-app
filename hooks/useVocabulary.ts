import { fetchVocabularies, syncVocabularies } from '@/services/api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export const useVocabularies = (page: number, limit: number, partOfSpeech: string, search: string) => {
    return useQuery({
        queryKey: ['vocabularies', page, limit, partOfSpeech, search],
        queryFn: () => fetchVocabularies(page, limit, { partOfSpeech, search }),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5, // 5 minutes cache for UI reads
    });
};

export const useSyncVocabularies = () => {
    return useQuery({
        queryKey: ['vocab-sync'],
        queryFn: syncVocabularies,
        staleTime: 1000 * 60 * 10, // 10 minutes stale time for sync results
        gcTime: Infinity,
        refetchInterval: 1000 * 60 * 15, // Sync every 15 minutes
        refetchOnWindowFocus: true,     // Sync when app comes to foreground
    });
};

import { fetchResources, syncResources } from '@/services/api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export const useResources = (page: number, limit: number, search: string) => {
    return useQuery({
        queryKey: ['resources', page, limit, search],
        queryFn: () => fetchResources(page, limit, { search }),
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60 * 5, // 5 minutes cache for UI reads
    });
};

export const useSyncResources = () => {
    return useQuery({
        queryKey: ['resource-sync'],
        queryFn: syncResources,
        staleTime: 1000 * 60 * 10, // 10 minutes stale time for sync results
        gcTime: Infinity,
        refetchInterval: 1000 * 60 * 15, // Sync every 15 minutes
        refetchOnWindowFocus: true,     // Sync when app comes to foreground
    });
};

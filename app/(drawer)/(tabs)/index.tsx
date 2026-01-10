import { AppHeader } from '@/components/AppHeader';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getVocabularies, addToFavorites, isFavorited, removeFromFavorites, syncVocabularies } from '@/services/api';
import { useVocabularies, useSyncVocabularies } from '@/hooks/useVocabulary';
import type { Vocabulary, Resource, PaginatedResponse } from '@/types';
import { searchOnlineDictionary } from '@/services/onlineDictionary';
import * as SafeAreaContext from 'react-native-safe-area-context';

// import { refreshData } from '@/services/appInitService';
import { Skeleton } from '@/components/ui/Skeleton';
import { NetworkError } from '@/components/ui/NetworkError';
import { useDebounce } from 'use-debounce';
import { VocabularyCard } from '@/components/VocabularyCard';
import { useVocabularyShare } from '@/hooks/useVocabularyShare';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export default function HomeScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const router = useRouter();
    const navigation = useNavigation();
    const insets = SafeAreaContext.useSafeAreaInsets();

    // Search State
    const [searchText, setSearchText] = useState('');
    const [searchQuery] = useDebounce(searchText, 300); // More responsive

    // Data Fetching with React Query (Local DB)
    const { data: queryData, isLoading, isFetching, isPlaceholderData, isError, refetch: localRefetch } = useVocabularies(1, 50, '', searchQuery);
    const { isFetching: isSyncing, refetch: syncRefetch } = useSyncVocabularies();

    const vocabularies = queryData?.data || [];

    // Simple loading: only on initial load when cache is empty
    const showLoading = isLoading && vocabularies.length === 0 && !isPlaceholderData;

    // Online Search Query


    const hasLocalResults = useMemo(() => {
        return searchQuery.length > 0 && vocabularies.length > 0;
    }, [vocabularies.length, searchQuery]);

    const [favorites, setFavorites] = useState<string[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Online Search Query
    const {
        data: onlineResult,
        isLoading: isOnlineLoading,
    } = useQuery({
        queryKey: ['onlineVocabulary', searchQuery],
        queryFn: () => searchOnlineDictionary(searchQuery),
        enabled: !isLoading && !hasLocalResults && searchQuery.length > 1,
        retry: false,
    });

    // Load Favorites (Local DB) logic - simplified since we can check isFavorited per item or load all
    // But for performance, let's just load IDs of favorited items if we want to show hearts
    // Or we can just let 'isFavorite' check happen.
    // However, for a list, it's efficient to load all fav IDs.
    // The previous logic loaded all favorites. Let's replicate that efficiently or use our repo.
    useFocusEffect(
        useCallback(() => {
            const { getFavoriteVocabularies } = require('@/services/api');
            getFavoriteVocabularies().then((favs: any[]) => setFavorites(favs.map(f => f.id)));
        }, [])
    );

    // Refresh handler - Syncs from server!
    const onRefresh = useCallback(async () => {
        try {
            await localRefetch();
            await syncRefetch();
        } catch (error) {
            console.error('Refresh failed:', error);
        }
    }, [localRefetch, syncRefetch]);


    // Simplified to just pass through
    const filteredVocabularies = vocabularies;

    // Share Hook
    const { shareVocabularyImage, ShareHiddenView } = useVocabularyShare(colors);

    // Memoized handlers
    const handleSpeak = useCallback(async (text: string) => {
        try {
            await Speech.speak(text, { language: 'en' });
        } catch (e) {
            console.error(e);
        }
    }, []);

    const handleCopy = useCallback(async (text: string) => {
        await Clipboard.setStringAsync(text);
    }, []);

    const handleShare = useCallback(async (item: Vocabulary) => {
        await shareVocabularyImage(item);
    }, [shareVocabularyImage]);

    const handleToggleFavorite = useCallback(async (item: Vocabulary) => {
        try {
            const isFav = favorites.includes(item.id);
            if (isFav) {
                await removeFromFavorites(item.id);
                setFavorites(prev => prev.filter(id => id !== item.id));
            } else {
                await addToFavorites(item);
                setFavorites(prev => [...prev, item.id]);
            }
        } catch (error) {
            console.error(error);
        }
    }, [favorites]);

    const handleViewDetails = useCallback((item: Vocabulary) => {
        router.push(`/details/vocabulary/${item.id}` as any);
    }, [router]);

    const renderItem = useCallback(({ item, index }: { item: Vocabulary, index: number }) => (
        <VocabularyCard
            item={item}
            index={index}
            isFavorite={favorites.includes(item.id)}
            colors={colors}
            onPress={handleViewDetails}
            onToggleFavorite={handleToggleFavorite}
            onSpeak={handleSpeak}
            onShare={handleShare}
        />
    ), [favorites, colors, handleViewDetails, handleToggleFavorite, handleSpeak, handleShare]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader
                title="Ai Vocab"
                subtitle="Let's learn something new today"
                showSearch={true}
                searchQuery={searchText}
                onSearchChange={setSearchText}
                showMenuButton={true}
            />

            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                refreshControl={<RefreshControl refreshing={(isFetching || isSyncing) && !showLoading} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* Vocabularies Section */}
                <View style={styles.sectionContainer}>


                    {/* Online Result Section */}
                    {searchQuery.length > 1 && !hasLocalResults && (
                        <View style={{ marginBottom: 16 }}>
                            {isOnlineLoading ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                                    <Text style={{ color: colors.icon }}>Searching online dictionary...</Text>
                                </View>
                            ) : onlineResult ? (
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
                                        <Ionicons name="globe-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Found Online</Text>
                                    </View>
                                    <VocabularyCard
                                        item={onlineResult}
                                        index={0}
                                        isOnline={true}
                                        isFavorite={favorites.includes(onlineResult.id)}
                                        colors={colors}
                                        onSpeak={handleSpeak}
                                        onShare={handleShare}
                                        onToggleFavorite={handleToggleFavorite}
                                        // No onPress for online items to avoid navigation to detailed view if not persisted/supported yet, or handle appropriately
                                        onPress={undefined}
                                    />
                                </View>
                            ) : null}
                        </View>
                    )}

                    {isError ? (
                        <NetworkError
                            colors={colors}
                            onRetry={() => localRefetch()}
                        />
                    ) : showLoading ? (
                        <View style={{ gap: 16 }}>
                            {[1, 2, 3].map((i) => (
                                <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <View>
                                            <Skeleton width={120} height={24} style={{ marginBottom: 4 }} />
                                            <Skeleton width={100} height={20} />
                                        </View>
                                        <Skeleton width={24} height={24} borderRadius={12} />
                                    </View>
                                    <Skeleton width={60} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
                                    <Skeleton width="100%" height={20} style={{ marginBottom: 4 }} />
                                    <Skeleton width="80%" height={20} style={{ marginBottom: 12 }} />
                                    <View style={{ flexDirection: 'row', gap: 16 }}>
                                        <Skeleton width={80} height={30} />
                                        <Skeleton width={80} height={30} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : filteredVocabularies.length > 0 ? (
                        <FlatList
                            data={filteredVocabularies}
                            renderItem={renderItem}
                            style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={false}
                            contentContainerStyle={styles.listContent}
                            initialNumToRender={10}
                            maxToRenderPerBatch={5}
                            windowSize={10}
                            removeClippedSubviews={true}
                        />
                    ) : (
                        !isOnlineLoading && !onlineResult && (
                            <View style={styles.emptyState}>
                                <Ionicons name="search-outline" size={64} color={colors.icon} />
                                <Text style={[styles.emptyText, { color: colors.icon }]}>
                                    {searchQuery ? 'No results found' : 'No vocabularies yet'}
                                </Text>
                            </View>
                        )
                    )}
                </View>
            </ScrollView>
            <ShareHiddenView />
        </View>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    sectionContainer: {
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    count: {
        fontSize: 16,
        fontWeight: '600',
    },
    listContent: {
        gap: 16,
    },
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    cardTitleContainer: {
        flex: 1,
    },
    english: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bangla: {
        fontSize: 16,
    },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    explanation: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    exampleContainer: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    exampleText: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    cardFooter: {
        flexDirection: 'row',
        gap: 16,
    },
    footerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    footerButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
});

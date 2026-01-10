import { AppHeader } from '@/components/AppHeader';
import { Colors } from '@/constants/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { NetworkError } from '@/components/ui/NetworkError';
import { VocabularyCard } from '@/components/VocabularyCard';
import { useVocabularyShare } from '@/hooks/useVocabularyShare';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchVocabularies, addToFavorites, removeFromFavorites, getFavoriteVocabularies } from '@/services/api';
import type { Vocabulary } from '@/types';
import { useDebounce } from 'use-debounce';
import { useVocabularies, useSyncVocabularies } from '@/hooks/useVocabulary';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function VocabularyScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const [searchText, setSearchText] = useState('');
    const [searchQuery] = useDebounce(searchText, 300); // 300ms is more responsive
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [favorites, setFavorites] = useState<string[]>([]);

    // TanStack Query Hooks
    const { data: queryData, isLoading, isFetching, isPlaceholderData, error, refetch: localRefetch } = useVocabularies(1, 100, selectedFilter, searchQuery);
    const { isFetching: isSyncing, refetch: syncRefetch } = useSyncVocabularies();
    const vocabularies = queryData?.data || [];

    // Simple loading: only on initial load when cache is empty
    const showLoading = isLoading && vocabularies.length === 0 && !isPlaceholderData;

    const router = useRouter();

    // Only fetch favorites on focus (Local DB)
    useFocusEffect(
        useCallback(() => {
            const loadFavorites = async () => {
                const favs = await getFavoriteVocabularies();
                setFavorites(favs.map(f => f.id));
            };
            loadFavorites();
        }, [])
    );

    const filters = [
        { id: 'all', label: 'All', icon: 'apps' as const },
        { id: 'noun', label: 'Noun', icon: 'document-text' as const },
        { id: 'verb', label: 'Verb', icon: 'flash' as const },
        { id: 'adjective', label: 'Adjective', icon: 'star' as const },
        { id: 'adverb', label: 'Adverb', icon: 'time' as const },
        { id: 'pronoun', label: 'Pronoun', icon: 'person' as const },
        { id: 'preposition', label: 'Preposition', icon: 'git-branch' as const },
        { id: 'conjunction', label: 'Conjunction', icon: 'git-merge' as const },
        { id: 'interjection', label: 'Interjection', icon: 'chatbubble-ellipses' as const },
        { id: 'phrase', label: 'Phrase', icon: 'text' as const },
        { id: 'idiom', label: 'Idiom', icon: 'bulb' as const },
        { id: 'phrasal verb', label: 'Phrasal Verb', icon: 'flash-outline' as const },
    ];

    // API handles filtering, so we just use the data
    // API handles filtering, so we just use the data
    const filteredVocabularies = vocabularies;

    // Share Hook
    const { shareVocabularyImage, ShareHiddenView } = useVocabularyShare(colors);

    // Memoized handlers
    const handleSpeak = useCallback(async (text: string) => {
        try {
            await Speech.speak(text, { language: 'en' });
        } catch (error) {
            console.error(error);
        }
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
                title="Vocabulary"
                showSearch={true}
                searchQuery={searchText}
                onSearchChange={setSearchText}
                showAddButton={false} // Removed Plus Icon
            // onAddPress={() => router.push('/(drawer)/add-vocabulary' as any)} // Disabled
            />

            {/* Filters */}
            <View style={{ marginTop: 10 }}>
                {/* ... Filter List ... */}
                <FlatList
                    horizontal
                    data={filters}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: filter }) => (
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: selectedFilter === filter.id ? colors.primary : colors.card,
                                    borderColor: colors.border,
                                },
                            ]}
                            onPress={() => setSelectedFilter(filter.id)}
                        >
                            <Ionicons
                                name={filter.icon}
                                size={16}
                                color={selectedFilter === filter.id ? '#fff' : colors.icon}
                            />
                            <Text
                                style={[
                                    styles.filterText,
                                    { color: selectedFilter === filter.id ? '#fff' : colors.text },
                                ]}
                            >
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.filtersContainer}
                    showsHorizontalScrollIndicator={false}
                />
            </View>

            {/* Vocabulary List */}
            {error ? (
                <NetworkError
                    colors={colors}
                    onRetry={() => localRefetch()}
                />
            ) : showLoading ? (
                <View style={styles.listContainer}>
                    {[1, 2, 3, 4, 5].map((i) => (
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
            ) : (
                <FlatList
                    data={vocabularies}
                    renderItem={renderItem}
                    style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={5}
                    windowSize={10}
                    removeClippedSubviews={true}
                    refreshControl={
                        <RefreshControl
                            refreshing={(isFetching || isSyncing) && !isLoading}
                            onRefresh={() => {
                                localRefetch();
                                syncRefetch();
                            }}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="book-outline" size={64} color={colors.icon} />
                            <Text style={[styles.emptyText, { color: colors.icon }]}>
                                {searchText || selectedFilter !== 'all'
                                    ? 'No vocabularies found'
                                    : 'No vocabularies yet'}
                            </Text>
                        </View>
                    }
                />
            )}
            <ShareHiddenView />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filtersContainer: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 38,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
        marginRight: 8,
    },
    filterText: {
        fontSize: 14,
        fontWeight: '500',
    },
    listContainer: {
        padding: 16,
        paddingTop: 0,
    },
    card: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
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
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
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

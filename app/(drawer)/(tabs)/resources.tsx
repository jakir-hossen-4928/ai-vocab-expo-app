import { AppHeader } from '@/components/AppHeader';
import { NetworkError } from '@/components/ui/NetworkError';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useResources, useSyncResources } from '@/hooks/useResources';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useDebounce } from 'use-debounce';

import type { Resource } from '@/types';
import { fetchResources, getBookmarkedResources, addToBookmarks, removeFromBookmarks } from '@/services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>?/gm, '');
};

export default function ResourcesScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    // Search States
    const [searchText, setSearchText] = useState('');
    const [searchQuery] = useDebounce(searchText, 300);

    // View State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [bookmarks, setBookmarks] = useState<string[]>([]);
    const router = useRouter();

    // Data Fetching with React Query
    const { data: resourcesData, isLoading: loading, isFetching, isError, refetch: localRefetch } = useResources(1, 100, searchQuery);
    const { isFetching: isSyncing, refetch: syncRefetch } = useSyncResources();

    const resources = resourcesData?.data || [];
    const isLoading = loading && resources.length === 0;
    const error = isError ? 'Failed to load' : null;

    // Load bookmarks (Local DB)
    useFocusEffect(
        useCallback(() => {
            const loadBookmarks = async () => {
                const bookmarkedResources = await getBookmarkedResources();
                setBookmarks(bookmarkedResources.map(r => r.id));
            };
            loadBookmarks();
        }, [])
    );

    const handleToggleBookmark = async (e: any, item: any) => {
        e.stopPropagation();
        const id = item.id;
        try {
            const isCurrentlyBookmarked = bookmarks.includes(id);
            if (isCurrentlyBookmarked) {
                await removeFromBookmarks(id);
                setBookmarks(prev => prev.filter(b => b !== id));
            } else {
                await addToBookmarks(item);
                setBookmarks(prev => [...prev, id]);
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const handleViewDetails = (id: string) => {
        router.push(`/details/resource/${id}` as any);
    };

    const renderGridItem = ({ item }: { item: Resource }) => (
        <TouchableOpacity
            style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleViewDetails(item.id)}
            activeOpacity={0.7}
        >
            <Image
                source={{ uri: item.imageUrl || item.thumbnail || 'https://via.placeholder.com/300x200' }}
                style={styles.gridImage}
                resizeMode="cover"
            />
            <View style={styles.gridContent}>
                <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                </Text>
                {item.description && (
                    <Text style={[styles.gridDescription, { color: colors.icon }]} numberOfLines={2}>
                        {stripHtml(item.description)}
                    </Text>
                )}
            </View>
            <TouchableOpacity
                style={[styles.favoriteButton, { backgroundColor: colors.surface }]}
                onPress={(e) => handleToggleBookmark(e, item)}
            >
                <Ionicons
                    name={bookmarks.includes(item.id) ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={bookmarks.includes(item.id) ? colors.primary : colors.icon}
                />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const renderListItem = ({ item }: { item: Resource }) => (
        <TouchableOpacity
            style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleViewDetails(item.id)}
            activeOpacity={0.7}
        >
            <Image
                source={{ uri: item.imageUrl || item.thumbnail || 'https://via.placeholder.com/300x200' }}
                style={styles.listImage}
                resizeMode="cover"
            />
            <View style={styles.listContent}>
                <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                </Text>
                {item.description && (
                    <Text style={[styles.listDescription, { color: colors.icon }]} numberOfLines={2}>
                        {stripHtml(item.description)}
                    </Text>
                )}
                <View style={styles.listFooter}>
                    <View style={styles.dateContainer}>
                        <Ionicons name="calendar-outline" size={14} color={colors.icon} />
                        <Text style={[styles.dateText, { color: colors.icon }]}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                        </Text>
                    </View>
                </View>
            </View>
            <TouchableOpacity
                style={styles.listFavoriteButton}
                onPress={(e) => handleToggleBookmark(e, item)}
            >
                <Ionicons
                    name={bookmarks.includes(item.id) ? "bookmark" : "bookmark-outline"}
                    size={24}
                    color={bookmarks.includes(item.id) ? colors.primary : colors.icon}
                />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader
                title="Resources"
                showSearch={true}
                searchQuery={searchText}
                onSearchChange={setSearchText}
                showMenuButton={true}
                rightAction={
                    <TouchableOpacity onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
                        <Ionicons
                            name={viewMode === 'grid' ? 'list' : 'grid'}
                            size={24}
                            color="#fff"
                        />
                    </TouchableOpacity>
                }
            />

            {/* Resources List */}
            {isError ? (
                <NetworkError
                    colors={colors}
                    onRetry={() => localRefetch()}
                />
            ) : isLoading ? (
                <View style={styles.listContainer}>
                    {viewMode === 'grid' ? (
                        <View style={styles.gridRow}>
                            {[1, 2].map((i) => (
                                <View key={i} style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Skeleton width="100%" height={120} />
                                    <View style={styles.gridContent}>
                                        <Skeleton width="80%" height={20} style={{ marginBottom: 4 }} />
                                        <Skeleton width="60%" height={16} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View>
                            {[1, 2, 3].map((i) => (
                                <View key={i} style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
                                    <Skeleton width={100} height={100} />
                                    <View style={styles.listContent}>
                                        <Skeleton width="80%" height={20} style={{ marginBottom: 4 }} />
                                        <Skeleton width="100%" height={16} style={{ marginBottom: 4 }} />
                                        <Skeleton width="60%" height={16} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ) : (
                <FlatList
                    data={resources}
                    renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
                    keyExtractor={(item) => item.id}
                    numColumns={viewMode === 'grid' ? 2 : 1}
                    key={viewMode} // Force re-render when changing view mode
                    contentContainerStyle={styles.listContainer}
                    columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={(isFetching || isSyncing) && !loading}
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
                            <Ionicons name="library-outline" size={64} color={colors.icon} />
                            <Text style={[styles.emptyText, { color: colors.icon }]}>
                                No resources available
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    viewModeButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContainer: {
        padding: 16,
        paddingTop: 16,
    },
    gridRow: {
        justifyContent: 'space-between',
    },
    // Grid View Styles
    gridCard: {
        width: CARD_WIDTH,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    gridImage: {
        width: '100%',
        height: 120,
        backgroundColor: '#E0E0E0',
    },
    gridContent: {
        padding: 12,
    },
    gridTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    gridDescription: {
        fontSize: 12,
        lineHeight: 16,
    },
    favoriteButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // List View Styles
    listCard: {
        flexDirection: 'row',
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    listImage: {
        width: 100,
        height: 100,
        backgroundColor: '#E0E0E0',
    },
    listContent: {
        flex: 1,
        padding: 12,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    listDescription: {
        fontSize: 14,
        lineHeight: 18,
        marginBottom: 8,
    },
    listFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateText: {
        fontSize: 12,
    },
    listFavoriteButton: {
        padding: 12,
        justifyContent: 'center',
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

import { AppHeader } from '@/components/AppHeader';
import { NetworkError } from '@/components/ui/NetworkError';
import { Skeleton } from '@/components/ui/Skeleton';
import { VocabularyCard } from '@/components/VocabularyCard';
import { getResourceColors } from '@/constants/colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useVocabularyShare } from '@/hooks/useVocabularyShare';
import { fetchFavoriteResources, fetchFavoriteVocabularies, toggleResourceBookmark, toggleVocabularyFavorite } from '@/services/favorites';
import { Vocabulary } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>?/gm, '');
};

export default function FavoritesScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const [selectedTab, setSelectedTab] = useState<'words' | 'resources'>('words');
    const [favoriteWords, setFavoriteWords] = useState<any[]>([]);
    const [favoriteResources, setFavoriteResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const { shareVocabularyImage, ShareHiddenView } = useVocabularyShare(colors);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedTab])
    );

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            // Fetch from LOCAL STORAGE - no network calls!
            if (selectedTab === 'words') {
                const vocabs = await fetchFavoriteVocabularies();
                setFavoriteWords(vocabs);
            } else {
                const resources = await fetchFavoriteResources();
                setFavoriteResources(resources);
            }
        } catch (err) {
            console.error('Error loading favorites:', err);
            setError('Failed to load favorites');
        } finally {
            setLoading(false);
        }
    };

    const handleSpeak = useCallback(async (text: string) => {
        try {
            await Speech.speak(text, { language: 'en' });
        } catch (error) {
            console.error(error);
        }
    }, []);

    const handleShareWord = useCallback(async (item: Vocabulary) => {
        await shareVocabularyImage(item);
    }, [shareVocabularyImage]);

    const handleShareText = useCallback(async (e: any, text: string) => {
        e.stopPropagation();
        try {
            await Share.share({ message: text });
        } catch (error) {
            console.error(error);
        }
    }, []);


    const handleToggleFavorite = useCallback(async (item: Vocabulary) => {
        try {
            // In favorites screen, toggling always means removing
            await toggleVocabularyFavorite(item.id, true);
            setFavoriteWords(prev => prev.filter(i => i.id !== item.id));
        } catch (error) {
            console.error(error);
        }
    }, []);

    const handleViewDetails = useCallback((item: Vocabulary) => {
        router.push(`/details/vocabulary/${item.id}` as any);
    }, [router]);

    const handleViewResourceDetails = useCallback((id: string) => {
        router.push(`/details/resource/${id}` as any);
    }, [router]);

    const renderWordCard = useCallback(({ item, index }: { item: Vocabulary, index: number }) => (
        <VocabularyCard
            item={item}
            index={index}
            isFavorite={true} // Always favorite in this screen
            colors={colors}
            onPress={handleViewDetails}
            onToggleFavorite={handleToggleFavorite}
            onSpeak={handleSpeak}
            onShare={handleShareWord}
        />
    ), [colors, handleViewDetails, handleToggleFavorite, handleSpeak, handleShareWord]);

    const handleRemoveResource = useCallback(async (e: any, id: string) => {
        e.stopPropagation();
        try {
            await toggleResourceBookmark(id, true);
            setFavoriteResources(prev => prev.filter(item => item.id !== id));
        } catch (error) {
            console.error(error);
        }
    }, []);

    const renderResourceCard = ({ item }: { item: any }) => {
        const resourceColors = getResourceColors(item.id);
        const hasImage = !!(item.imageUrl || item.thumbnail);

        return (
            <TouchableOpacity
                style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleViewResourceDetails(item.id)}
                activeOpacity={0.7}
            >
                <View style={[styles.gridImageContainer, { backgroundColor: resourceColors.background }]}>
                    {hasImage ? (
                        <>
                            <Image
                                source={{ uri: item.imageUrl || item.thumbnail }}
                                style={styles.gridImage}
                                resizeMode="cover"
                            />
                            <View style={styles.titleOverlay}>
                                <Ionicons name="school-outline" size={48} color="rgba(255,255,255,0.9)" style={styles.overlayIcon} />
                                <Text style={styles.overlayTitle}>
                                    {item.title}
                                </Text>
                            </View>
                        </>
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <Ionicons name="school-outline" size={64} color="rgba(255,255,255,0.9)" style={styles.placeholderIcon} />
                            <Text style={styles.placeholderTitle}>
                                {item.title}
                            </Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.favoriteButton, { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.9)' }]}
                    onPress={(e) => handleRemoveResource(e, item.id)}
                >
                    <Ionicons
                        name="bookmark"
                        size={20}
                        color={colors.primary}
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };


    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
                <Ionicons
                    name={selectedTab === 'words' ? "heart-outline" : "bookmark-outline"}
                    size={64}
                    color={colors.icon}
                />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {selectedTab === 'words' ? 'No Favorited Words' : 'No Bookmarked Resources'}
            </Text>
            <Text style={[styles.emptyDescription, { color: colors.icon }]}>
                {selectedTab === 'words'
                    ? 'Favorites feature coming soon'
                    : 'Bookmarks feature coming soon'}
            </Text>
            <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push(selectedTab === 'words' ? '/(drawer)/(tabs)/vocabulary' as any : '/(drawer)/(tabs)/resources' as any)}
            >
                <Text style={styles.emptyButtonText}>
                    {selectedTab === 'words' ? 'Browse Vocabulary' : 'Browse Resources'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader
                title="Favorites"
                showMenuButton={true}
            />

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        {
                            backgroundColor: selectedTab === 'words' ? colors.primary : 'transparent',
                            borderColor: colors.border,
                        },
                    ]}
                    onPress={() => setSelectedTab('words')}
                >
                    <Ionicons
                        name="book"
                        size={20}
                        color={selectedTab === 'words' ? '#fff' : colors.icon}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: selectedTab === 'words' ? '#fff' : colors.text },
                        ]}
                    >
                        Words
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tab,
                        {
                            backgroundColor: selectedTab === 'resources' ? colors.primary : 'transparent',
                            borderColor: colors.border,
                        },
                    ]}
                    onPress={() => setSelectedTab('resources')}
                >
                    <Ionicons
                        name="library"
                        size={20}
                        color={selectedTab === 'resources' ? '#fff' : colors.icon}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: selectedTab === 'resources' ? '#fff' : colors.text },
                        ]}
                    >
                        Resources
                    </Text>
                </TouchableOpacity>
            </View>


            {/* Content */}
            {error ? (
                <NetworkError
                    colors={colors}
                    onRetry={loadData}
                    message={error}
                />
            ) : loading ? (
                <View style={styles.listContainer}>
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
                            <Skeleton width="80%" height={20} />
                        </View>
                    ))}
                </View>
            ) : selectedTab === 'words' ? (
                favoriteWords.length > 0 ? (
                    <FlatList
                        data={favoriteWords}
                        renderItem={renderWordCard}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={5}
                        windowSize={10}
                        removeClippedSubviews={true}
                    />
                ) : (
                    renderEmptyState()
                )
            ) : (
                favoriteResources.length > 0 ? (
                    <FlatList
                        data={favoriteResources}
                        renderItem={renderResourceCard}
                        keyExtractor={(item) => item.id}
                        numColumns={1}
                        key="list"
                        contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
                        showsVerticalScrollIndicator={false}
                    />
                ) : (
                    renderEmptyState()
                )
            )}
            <ShareHiddenView />
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
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        marginTop: 16,
        gap: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    listContainer: {
        padding: 16,
        paddingTop: 0,
    },
    gridRow: {
        justifyContent: 'space-between',
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
    // Grid View Styles for Resources
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
    gridImageContainer: {
        width: '100%',
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    titleOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 16,
        paddingTop: 60,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    overlayIcon: {
        marginBottom: 8,
    },
    overlayTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 22,
    },
    placeholderContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    placeholderIcon: {
        marginBottom: 16,
    },
    placeholderTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 16,
    },
    gridContent: {
        padding: 14,
        minHeight: 50,
    },
    gridTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 6,
        lineHeight: 20,
    },
    gridDescription: {
        fontSize: 13,
        lineHeight: 18,
        opacity: 0.7,
    },
    favoriteButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
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
    pronunciation: {
        fontSize: 14,
        fontStyle: 'italic',
        marginBottom: 8,
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
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyDescription: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    emptyButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

import { LexicalMarkdownRenderer } from '@/components/LexicalMarkdownRenderer';
import { getResourceColors } from '@/constants/colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResource } from '@/hooks/useResources';
import { addToBookmarks, isBookmarked, removeFromBookmarks } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResourceDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    // Fetch SINGLE resource for optimal performance
    const { data: resource, isLoading, error } = useResource(id);

    const [isBookmarkedState, setIsBookmarkedState] = useState(false);

    useEffect(() => {
        if (id) {
            checkBookmarkStatus();
        }
    }, [id]);

    const checkBookmarkStatus = async () => {
        try {
            const status = await isBookmarked(id!);
            setIsBookmarkedState(status);
        } catch (error) {
            console.error('Error checking bookmark status:', error);
        }
    };

    const handleToggleBookmark = async () => {
        if (!resource) return;
        try {
            if (isBookmarkedState) {
                await removeFromBookmarks(resource.id);
                setIsBookmarkedState(false);
            } else {
                await addToBookmarks(resource);
                setIsBookmarkedState(true);
            }
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const handleShare = async () => {
        if (!resource) return;
        try {
            const shareUrl = `https://ai-vocabulary-coach.netlify.app/resources/${resource.slug || resource.id}`;
            await Share.share({
                message: `Check out this resource: ${resource.title}\n\n${shareUrl}`,
                url: shareUrl,
            });
        } catch (error) {
            console.error(error);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (error || !resource) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Text style={{ color: colors.text, fontSize: 18, textAlign: 'center' }}>Resource not found or error occurred.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const resourceColors = getResourceColors(resource.id);
    const hasImage = !!resource.imageUrl;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Image Section */}
                <View style={[styles.imageContainer, { backgroundColor: hasImage ? undefined : resourceColors.background }]}>
                    {hasImage ? (
                        <Image
                            source={{ uri: resource.imageUrl }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <Ionicons name="school-outline" size={80} color="rgba(255,255,255,0.9)" />
                        </View>
                    )}

                    {/* Overlay Header Icons (Inside Image/Placeholder) */}
                    <SafeAreaView style={styles.overlayHeader} edges={['top']}>
                        <TouchableOpacity
                            style={styles.iconButtonBlur}
                            onPress={() => router.back()}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.headerActionsOverlay}>
                            <TouchableOpacity
                                style={styles.iconButtonBlur}
                                onPress={handleToggleBookmark}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons
                                    name={isBookmarkedState ? "bookmark" : "bookmark-outline"}
                                    size={24}
                                    color={isBookmarkedState ? resourceColors.primary : "#fff"}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.iconButtonBlur}
                                onPress={handleShare}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="share-social-outline" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>

                <View style={styles.content}>
                    {/* Title Section */}
                    <Text style={[styles.title, { color: colors.text }]}>{resource.title}</Text>

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                        <View style={[styles.dateBadge, { backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#f1f5f9' }]}>
                            <Ionicons name="calendar-outline" size={16} color={colors.icon} />
                            <Text style={[styles.dateText, { color: colors.icon }]}>
                                {new Date(resource.createdAt || Date.now()).toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </Text>
                        </View>
                    </View>

                    {/* Description/Main Content */}
                    <View style={styles.markdownContainer}>
                        <LexicalMarkdownRenderer markdown={resource.description || ''} />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    imageContainer: {
        width: '100%',
        height: 250, // Fixed height for image area
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative', // For overlay positioning
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10, // Adjust for safe area
        zIndex: 10,
    },
    headerActionsOverlay: {
        flexDirection: 'row',
        gap: 12,
    },
    iconButtonBlur: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)', // Semi-transparent black for contrast
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 36,
        marginBottom: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    dateText: {
        fontSize: 14,
        fontWeight: '600',
    },
    markdownContainer: {
        marginTop: 8,
    },
});

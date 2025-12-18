import { NetworkError } from '@/components/ui/NetworkError';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Resource } from '@/types';
import { getResourceById, addToBookmarks, isBookmarked, removeFromBookmarks } from '@/services/api'; // API for data
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Image,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function ResourceDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const [resource, setResource] = useState<Resource | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isBookmarkedState, setIsBookmarkedState] = useState(false);
    const [webViewHeight, setWebViewHeight] = useState(400); // Default fallback
    const [isScrolling, setIsScrolling] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);

    const onWebViewMessage = (event: any) => {
        const height = Number(event.nativeEvent.data);
        if (height) {
            setWebViewHeight(height + 20); // Add a little buffer
        }
    };

    const handleScroll = (event: any) => {
        const offset = event.nativeEvent.contentOffset.y;
        setScrollOffset(offset);
        if (!isScrolling) setIsScrolling(true);
    };

    const handleScrollEnd = () => {
        setIsScrolling(false);
    };

    useEffect(() => {
        if (id) {
            fetchResource(id);
        }
    }, [id]);

    const fetchResource = async (resourceId: string) => {
        try {
            setLoading(true);
            setError(null);

            // Fetch from Supabase
            const data = await getResourceById(resourceId);
            const bookmarkStatus = await isBookmarked(resourceId);

            setResource(data);
            setIsBookmarkedState(bookmarkStatus);
        } catch (err) {
            console.error('Error fetching resource:', err);
            setError('Unable to load resource details');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleBookmark = async () => {
        if (resource) {
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
        }
    };

    const handleShare = async () => {
        if (resource) {
            try {
                await Share.share({
                    message: `Check out this resource: ${resource.title}\n\n${resource.description || ''}`,
                });
            } catch (error) {
                console.error(error);
            }
        }
    };

    // Render skeleton loading state
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <ScrollView>
                    <Skeleton width="100%" height={250} />
                    <View style={{ padding: 20 }}>
                        <Skeleton width="80%" height={32} style={{ marginBottom: 8 }} />
                        <Skeleton width={120} height={20} style={{ marginBottom: 20 }} />
                        <Skeleton width="100%" height={200} borderRadius={12} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Render error state
    if (error) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <NetworkError
                    colors={colors}
                    onRetry={() => fetchResource(id as string)}
                    message={error}
                />
            </SafeAreaView>
        );
    }

    // Render when no resource found
    if (!resource) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.icon} />
                    <Text style={[styles.errorText, { color: colors.icon }]}>Resource not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[
                styles.header,
                {
                    borderBottomWidth: scrollOffset > 10 ? 1 : 0,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    elevation: scrollOffset > 10 && !isScrolling ? 4 : 0,
                    shadowOpacity: scrollOffset > 10 && !isScrolling ? 0.1 : 0
                }
            ]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleToggleBookmark}>
                        <Ionicons
                            name={isBookmarkedState ? "bookmark" : "bookmark-outline"}
                            size={24}
                            color={isBookmarkedState ? colors.primary : colors.text}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                        <Ionicons name="share-social-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Right Side Shadow Decor */}
            <View style={[
                styles.sideShadow,
                {
                    backgroundColor: colors.card,
                    shadowColor: '#000',
                    shadowOffset: { width: 5, height: 0 },
                    shadowOpacity: isScrolling ? 0.2 : 0.05,
                    shadowRadius: 10,
                    elevation: isScrolling ? 10 : 2,
                }
            ]} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                onScroll={handleScroll}
                onScrollBeginDrag={() => setIsScrolling(true)}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={handleScrollEnd}
                scrollEventThrottle={16}
            >
                {/* Content Header */}
                <View style={[styles.detailsContainer, { alignItems: 'center' }]}>
                    <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>{resource.title}</Text>

                    {resource.createdAt && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, opacity: 0.7 }}>
                            <Ionicons name="calendar-outline" size={14} color={colors.icon} style={{ marginRight: 6 }} />
                            <Text style={[styles.date, { color: colors.icon, marginBottom: 0 }]}>
                                {new Date(resource.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Featured Image */}
                {!!resource.imageUrl && (
                    <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                        <Image source={{ uri: resource.imageUrl }} style={[styles.image, { borderRadius: 16 }]} resizeMode="cover" />
                    </View>
                )}

                {/* Description */}
                {resource.description && (
                    <View style={{ marginTop: 8 }}>
                        <WebView
                            originWhitelist={['*']}
                            source={{
                                html: `
                                        <html>
                                        <head>
                                            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                            <style>
                                                body {
                                                    font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
                                                    color: ${colors.text};
                                                    background-color: transparent;
                                                    font-size: 16px;
                                                    line-height: 1.6;
                                                    padding: 0;
                                                    margin: 0;
                                                    text-align: center;
                                                }
                                                p { margin-bottom: 16px; }
                                                h1, h2, h3 { color: ${colors.primary}; margin-top: 24px; margin-bottom: 12px; }
                                                ul, ol { padding-left: 20px; margin-bottom: 16px; }
                                                li { margin-bottom: 8px; }
                                                img { max-width: 100%; height: auto; border-radius: 8px; }
                                                a { color: ${colors.primary}; text-decoration: none; }
                                            </style>
                                        </head>
                                        <body>
                                            <div id="content-height-wrapper">
                                                ${resource.description}
                                            </div>
                                            <script>
                                                function sendHeight() {
                                                    window.ReactNativeWebView.postMessage(document.getElementById('content-height-wrapper').scrollHeight);
                                                }
                                                window.onload = sendHeight;
                                                // Observe content changes (e.g. if images load later)
                                                const observer = new ResizeObserver(sendHeight);
                                                observer.observe(document.getElementById('content-height-wrapper'));
                                            </script>
                                        </body>
                                        </html>
                                    `
                            }}
                            style={{ backgroundColor: 'transparent', height: webViewHeight }}
                            scrollEnabled={false}
                            onMessage={onWebViewMessage}
                            scalesPageToFit={false}
                            javaScriptEnabled={true}
                            textInteractionEnabled={true}
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: 250,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    placeholderImage: {
        width: '100%',
        height: 250,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailsContainer: {
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 12,
        lineHeight: 34,
    },
    date: {
        fontSize: 14,
        marginBottom: 24,
        opacity: 0.7,
    },
    descriptionContainer: {
        borderRadius: 12,
    },
    sideShadow: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 1, // Visual anchor
        zIndex: 5,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
});

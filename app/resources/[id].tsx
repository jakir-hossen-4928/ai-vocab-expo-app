import { LexicalMarkdownRenderer } from '@/components/LexicalMarkdownRenderer';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useResource } from '@/hooks/useResources';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ResourceDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const [isBookmarkedState, setIsBookmarkedState] = useState(false);

    const { data: resource, isLoading, error } = useResource(id as string);

    const handleShare = async () => {
        if (!resource) return;
        try {
            const shareUrl = `https://ai-vocabulary-coach.netlify.app/resources/${resource.slug || resource.id}`;
            await Share.share({
                message: `Check out this resource: ${resource.title}\n${shareUrl}`,
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
            <Stack.Screen
                options={{
                    headerTitle: 'Resource Details',
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.text,
                    headerLeft: () => (
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => setIsBookmarkedState(!isBookmarkedState)}
                            >
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
                    ),
                }}
            />
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    {/* Title Section */}
                    <Text style={[styles.title, { color: colors.text }]}>{resource.title}</Text>

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                        <View style={[styles.dateBadge, { backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#f1f5f9' }]}>
                            <Ionicons name="calendar-outline" size={16} color={colors.icon} />
                            <Text style={[styles.dateText, { color: colors.icon }]}>
                                {new Date(resource.createdAt).toLocaleDateString('en-US', {
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    backButton: {
        padding: 8,
    },
    headerActions: {
        flexDirection: 'row',
        marginRight: 8,
        gap: 4,
    },
    actionButton: {
        padding: 8,
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

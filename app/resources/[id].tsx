import { Colors } from '@/constants/theme';
import { Resource } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function ResourceDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colors = Colors.light; // Force light theme colors
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Mock data - in a real app, fetch this based on the ID
    const resource: Resource = {
        id: id as string,
        title: 'English Grammar Guide',
        description: 'A comprehensive guide to English grammar rules, tenses, and usage patterns. Perfect for beginners and intermediate learners looking to strengthen their foundation.',
        imageUrl: 'https://via.placeholder.com/800x400/2196F3/FFFFFF?text=Grammar+Guide',
        createdAt: new Date().toISOString(),
        userId: 'user1',
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this resource: ${resource.title}\n\n${resource.description}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    headerTitle: '',
                    headerTransparent: true,
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
                                onPress={() => setIsBookmarked(!isBookmarked)}
                            >
                                <Ionicons
                                    name={isBookmarked ? "bookmark" : "bookmark-outline"}
                                    size={24}
                                    color={isBookmarked ? colors.primary : colors.text}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                                <Ionicons name="share-social-outline" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />
            <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Hero Image */}
                <Image
                    source={{ uri: resource.imageUrl }}
                    style={styles.heroImage}
                    resizeMode="cover"
                />

                {/* Content Container */}
                <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>{resource.title}</Text>
                        <View style={styles.metaContainer}>
                            <View style={styles.metaItem}>
                                <Ionicons name="calendar-outline" size={16} color={colors.icon} />
                                <Text style={[styles.metaText, { color: colors.icon }]}>
                                    {new Date(resource.createdAt).toLocaleDateString()}
                                </Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Ionicons name="person-outline" size={16} color={colors.icon} />
                                <Text style={[styles.metaText, { color: colors.icon }]}>By Admin</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                        <Text style={[styles.description, { color: colors.text }]}>
                            {resource.description}
                        </Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
                            <Ionicons name="book-outline" size={20} color="#fff" />
                            <Text style={styles.primaryButtonText}>Start Learning</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]}>
                            <Ionicons name="download-outline" size={20} color={colors.primary} />
                            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Download PDF</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Related Tags */}
                    <View style={styles.tagsContainer}>
                        {['Grammar', 'English', 'Beginner', 'Guide'].map((tag, index) => (
                            <View key={index} style={[styles.tag, { backgroundColor: colors.surface }]}>
                                <Text style={[styles.tagText, { color: colors.icon }]}>#{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backButton: {
        marginLeft: 16,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    headerActions: {
        flexDirection: 'row',
        marginRight: 16,
        gap: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
    },
    heroImage: {
        width: width,
        height: 250,
    },
    contentContainer: {
        flex: 1,
        marginTop: -20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    header: {
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    metaContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 14,
    },
    divider: {
        height: 1,
        width: '100%',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
    },
    actionButtonsContainer: {
        gap: 12,
        marginBottom: 32,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    tagText: {
        fontSize: 14,
    },
});

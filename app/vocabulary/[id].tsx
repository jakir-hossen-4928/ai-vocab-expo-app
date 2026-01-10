import { Colors } from '@/constants/theme';
import { Vocabulary } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function VocabularyDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colors = Colors.light; // Force light theme colors
    const [isFavorite, setIsFavorite] = useState(false);

    // Mock data - in a real app, fetch this based on the ID
    const vocabulary: Vocabulary = {
        id: id as string,
        bangla: 'আকস্মিক সৌভাগ্য',
        english: 'Serendipity',
        partOfSpeech: 'noun',
        pronunciation: '/ˌserənˈdɪpɪti/',
        examples: [
            { bn: 'এটি ছিল নিছক আকস্মিক সৌভাগ্য', en: 'It was pure serendipity' },
            { bn: 'তাদের দেখা হওয়াটা ছিল এক সুখকর আকস্মিকতা', en: 'Their meeting was a happy serendipity' },
        ],
        synonyms: ['chance', 'luck', 'fortune', 'accident'],
        antonyms: ['misfortune', 'bad luck', 'design', 'plan'],
        explanation: 'The occurrence and development of events by chance in a happy or beneficial way.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user1',
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this word: ${vocabulary.english} - ${vocabulary.bangla}\n\nMeaning: ${vocabulary.explanation}`,
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
                                onPress={() => setIsFavorite(!isFavorite)}
                            >
                                <Ionicons
                                    name={isFavorite ? "heart" : "heart-outline"}
                                    size={24}
                                    color={isFavorite ? "#F44336" : colors.text}
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
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>
                            {vocabulary.partOfSpeech}
                        </Text>
                    </View>
                    <Text style={[styles.englishWord, { color: colors.primary }]}>
                        {vocabulary.english}
                    </Text>
                    <Text style={[styles.banglaWord, { color: colors.text }]}>
                        {vocabulary.bangla}
                    </Text>
                    <View style={styles.pronunciationContainer}>
                        <Ionicons name="volume-medium" size={24} color={colors.icon} />
                        <Text style={[styles.pronunciation, { color: colors.icon }]}>
                            {vocabulary.pronunciation}
                        </Text>
                    </View>
                </View>

                {/* Explanation Section */}
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Explanation</Text>
                    <Text style={[styles.explanationText, { color: colors.text }]}>
                        {vocabulary.explanation}
                    </Text>
                </View>

                {/* Examples Section */}
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Examples</Text>
                    {vocabulary.examples.map((example, index) => (
                        <View key={index} style={styles.exampleItem}>
                            <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                            <View style={styles.exampleContent}>
                                <Text style={[styles.exampleEn, { color: colors.text }]}>{example.en}</Text>
                                <Text style={[styles.exampleBn, { color: colors.icon }]}>{example.bn}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Synonyms & Antonyms */}
                <View style={styles.row}>
                    <View style={[styles.halfSection, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.subTitle, { color: colors.primary }]}>Synonyms</Text>
                        <View style={styles.chipContainer}>
                            {vocabulary.synonyms.map((syn, index) => (
                                <View key={index} style={[styles.chip, { backgroundColor: colors.card }]}>
                                    <Text style={[styles.chipText, { color: colors.text }]}>{syn}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={[styles.halfSection, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.subTitle, { color: '#F44336' }]}>Antonyms</Text>
                        <View style={styles.chipContainer}>
                            {vocabulary.antonyms.map((ant, index) => (
                                <View key={index} style={[styles.chip, { backgroundColor: colors.card }]}>
                                    <Text style={[styles.chipText, { color: colors.text }]}>{ant}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
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
    header: {
        alignItems: 'center',
        padding: 24,
        paddingTop: 10,
    },
    badge: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    badgeText: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    englishWord: {
        fontSize: 36,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    banglaWord: {
        fontSize: 24,
        marginBottom: 16,
        textAlign: 'center',
    },
    pronunciationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    pronunciation: {
        fontSize: 16,
        fontStyle: 'italic',
    },
    section: {
        margin: 16,
        marginTop: 0,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    explanationText: {
        fontSize: 16,
        lineHeight: 24,
    },
    exampleItem: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    bullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 8,
    },
    exampleContent: {
        flex: 1,
    },
    exampleEn: {
        fontSize: 16,
        marginBottom: 4,
        fontWeight: '500',
    },
    exampleBn: {
        fontSize: 14,
    },
    row: {
        flexDirection: 'row',
        padding: 16,
        gap: 16,
        paddingBottom: 40,
    },
    halfSection: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
    },
    subTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    chipText: {
        fontSize: 12,
    },
});

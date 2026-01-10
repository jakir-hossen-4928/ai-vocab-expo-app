import { Colors } from '@/constants/theme';
import { Vocabulary } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ShareableVocabularyCardProps {
    item: Vocabulary;
    colors: typeof Colors.light;
}

export const ShareableVocabularyCard = ({ item, colors }: ShareableVocabularyCardProps) => {
    const firstExample = item.examples && item.examples.length > 0 ? item.examples[0] : null;

    return (
        <View style={[styles.container, { backgroundColor: colors.background, borderColor: colors.primary }]}>
            {/* Header / Branding */}
            <View style={styles.header}>
                <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
                    <Ionicons name="book" size={20} color="#fff" />
                </View>
                <Text style={[styles.appName, { color: colors.primary }]}>Ai Vocab</Text>
            </View>

            {/* Main Content */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

                {/* Part of Speech Badge */}
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>{item.partOfSpeech}</Text>
                </View>

                <View style={styles.titleContainer}>
                    <Text style={[styles.bangla, { color: colors.text }]}>{item.bangla}</Text>
                    <Text style={[styles.english, { color: colors.primary }]}>{item.english}</Text>
                </View>

                {/* Single Example */}
                {firstExample && (
                    <View style={[styles.exampleContainer, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.exampleLabel, { color: colors.primary }]}>Example:</Text>
                        <Text style={[styles.exampleText, { color: colors.text }]}>
                            "{firstExample.en}"
                        </Text>
                        {/* Optionally show Bangla translation if available? User asked for "example (only one)" */}
                        {firstExample.bn && (
                            <Text style={[styles.exampleTranslation, { color: colors.icon }]}>
                                {firstExample.bn}
                            </Text>
                        )}
                    </View>
                )}

                {/* Synonyms */}
                {item.synonyms && item.synonyms.length > 0 && (
                    <View style={styles.listSection}>
                        <Text style={[styles.sectionLabel, { color: colors.icon }]}>Synonyms:</Text>
                        <View style={styles.chipContainer}>
                            {item.synonyms.map((syn, idx) => (
                                <View key={idx} style={[styles.chip, { backgroundColor: colors.surface }]}>
                                    <Text style={[styles.chipText, { color: colors.text }]}>{syn}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Antonyms */}
                {item.antonyms && item.antonyms.length > 0 && (
                    <View style={styles.listSection}>
                        <Text style={[styles.sectionLabel, { color: colors.icon }]}>Antonyms:</Text>
                        <View style={styles.chipContainer}>
                            {item.antonyms.map((ant, idx) => (
                                <View key={idx} style={[styles.chip, { backgroundColor: colors.surface }]}>
                                    <Text style={[styles.chipText, { color: colors.text }]}>{ant}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

            </View>

            {/* Footer */}
            <Text style={[styles.footerText, { color: colors.icon }]}>Learn more with Ai Vocab App</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 20,
        width: '100%', // Responsive width
        maxWidth: 400, // Max width for photo-card
        minHeight: 500, // Minimum height, grows if needed
        borderWidth: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    logoContainer: {
        padding: 8,
        borderRadius: 8,
    },
    appName: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    card: {
        flex: 1, // Responsive height
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    badge: {
        alignSelf: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 16,
        marginBottom: 12,
    },
    badgeText: {
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    titleContainer: {
        marginBottom: 12,
        alignItems: 'center',
    },
    bangla: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 2,
        textAlign: 'center',
    },
    english: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 2,
        textAlign: 'center',
    },
    pronunciation: {
        fontSize: 16,
        fontStyle: 'italic',
        marginTop: 2,
    },
    explanation: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
        textAlign: 'center',
    },
    exampleContainer: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        width: '100%',
    },
    exampleLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    exampleText: {
        fontSize: 16,
        fontStyle: 'italic',
        lineHeight: 22,
        marginBottom: 4,
    },
    exampleTranslation: {
        fontSize: 14,
    },
    listSection: {
        marginTop: 8,
        flexDirection: 'column', // Stack vertically for better responsiveness
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    chip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 4,
        marginBottom: 4,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12, // Slightly larger
        fontWeight: '600',
        opacity: 0.8,
    },
});

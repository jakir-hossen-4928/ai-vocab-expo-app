import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { NetworkError } from '@/components/ui/NetworkError';
import { Skeleton } from '@/components/ui/Skeleton';
import { useVocabularyShare } from '@/hooks/useVocabularyShare';
import { getVocabularyById, addToFavorites, isFavorited, removeFromFavorites } from '@/services/api'; // API for data
import { getOpenRouterApiKey } from '@/services/storage';
import type { Vocabulary, VocabularyExample, RelatedWord } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert
} from 'react-native';
import * as SafeAreaContext from 'react-native-safe-area-context';

export default function VocabularyDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const insets = SafeAreaContext.useSafeAreaInsets();
    const colors = Colors[colorScheme ?? 'light'];
    const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const { shareVocabularyImage, ShareHiddenView } = useVocabularyShare(colors);

    useEffect(() => {
        if (id) {
            fetchVocabulary(id as string);
        }
    }, [id]);

    const fetchVocabulary = async (vocabId: string) => {
        try {
            setLoading(true);
            setError(null);

            // Fetch from local SQLite DB
            const data = await getVocabularyById(vocabId);
            const favStatus = await isFavorited(vocabId);

            if (!data) throw new Error('Vocabulary not found locally');

            setVocabulary(data);
            setIsFavorite(favStatus);
        } catch (err) {
            console.error('Error fetching vocabulary:', err);
            setError('Unable to load vocabulary details');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (vocabulary) {
            try {
                if (isFavorite) {
                    await removeFromFavorites(vocabulary.id);
                    setIsFavorite(false);
                } else {
                    await addToFavorites(vocabulary);
                    setIsFavorite(true);
                }
            } catch (error) {
                console.error('Error toggling favorite:', error);
            }
        }
    };

    const handleSpeak = async (text?: string) => {
        if (vocabulary) {
            try {
                await Speech.speak(text || vocabulary.english, { language: 'en' });
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleShare = async () => {
        if (vocabulary) {
            await shareVocabularyImage(vocabulary);
        }
    };

    const handleChatPress = async () => {
        const apiKey = await getOpenRouterApiKey();
        if (!apiKey) {
            Alert.alert(
                'API Key Required',
                'You need to set your OpenRouter API Key in Settings to use the AI Tutor.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Go to Settings', onPress: () => router.push('/(drawer)/settings') }
                ]
            );
        } else {
            router.push(`/details/vocabulary/chat/${id}`);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <LinearGradient
                    colors={[colors.primary, '#1976D2']}
                    style={[styles.headerGradient, { paddingTop: insets.top }]}
                >
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={{ flex: 1 }}>
                            <Skeleton width={180} height={36} style={{ marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                            <Skeleton width={120} height={24} style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        </View>
                    </View>
                </LinearGradient>
                <ScrollView style={styles.contentScroll}>
                    <View style={styles.contentInner}>
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Skeleton width={120} height={24} style={{ marginBottom: 12 }} />
                            <Skeleton width="100%" height={20} style={{ marginBottom: 8 }} />
                            <Skeleton width="90%" height={20} />
                        </View>
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Skeleton width={100} height={24} style={{ marginBottom: 12 }} />
                            <Skeleton width="100%" height={80} borderRadius={12} />
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <LinearGradient
                    colors={[colors.primary, '#1976D2']}
                    style={[styles.headerGradient, { paddingTop: insets.top }]}
                >
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </LinearGradient>
                <NetworkError
                    colors={colors}
                    onRetry={() => fetchVocabulary(id as string)}
                    message={error}
                />
            </View>
        );
    }

    if (!vocabulary) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <LinearGradient
                    colors={[colors.primary, '#1976D2']}
                    style={[styles.headerGradient, { paddingTop: insets.top }]}
                >
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </LinearGradient>
                <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.icon} />
                    <Text style={[styles.loadingText, { color: colors.icon }]}>Vocabulary not found</Text>
                </View>
            </View>
        );
    }


    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header with Background */}
            <LinearGradient
                colors={[colors.primary, '#1976D2']}
                style={[styles.headerGradient, { paddingTop: insets.top }]}
            >
                {/* Top Actions */}
                <View style={styles.headerActionsRow}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerIconBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.headerRightActions}>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleToggleFavorite}>
                            <Ionicons
                                name={isFavorite ? "heart" : "heart-outline"}
                                size={24}
                                color={isFavorite ? "#FFEB3B" : "#FFF"}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleChatPress}>
                            <Ionicons name="chatbubbles-outline" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerIconBtn} onPress={handleShare}>
                            <Ionicons name="share-social-outline" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Headword Info */}
                <View style={styles.headerContent}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                        <Text style={styles.headerBangla}>{vocabulary.bangla}</Text>
                        <Text style={styles.headerEnglish}>{vocabulary.english}</Text>
                        <View style={styles.headerMetaRow}>
                            <View style={styles.headerBadge}>
                                <Text style={styles.headerBadgeText}>{vocabulary.partOfSpeech}</Text>
                            </View>
                            {vocabulary.pronunciation && (
                                <Text
                                    style={styles.headerPronunciation}
                                >
                                    {vocabulary.pronunciation}
                                </Text>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.headerVoiceBtn}
                        onPress={() => handleSpeak()}
                    >
                        <Ionicons name="volume-medium" size={32} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.contentScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            >
                <View style={styles.contentInner}>


                    {/* Explanation */}
                    {vocabulary.explanation && (
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Explanation</Text>
                            <Text style={[styles.explanationText, { color: colors.text }]}>
                                {vocabulary.explanation}
                            </Text>
                        </View>
                    )}

                    {/* Verb Forms */}
                    {vocabulary.partOfSpeech === 'verb' && vocabulary.verbForms && (
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Verb Forms</Text>
                            <View style={styles.verbFormsContainer}>
                                {Array.isArray(vocabulary.verbForms) ? (
                                    // Backward compatibility for array structure
                                    vocabulary.verbForms.map((form: any, index: number) => {
                                        if (typeof form === 'string') {
                                            return (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[styles.verbFormItem, { backgroundColor: colors.surface }]}
                                                    onPress={() => handleSpeak(form)}
                                                >
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <Text style={[styles.verbFormText, { color: colors.text }]}>{form}</Text>
                                                        <Ionicons name="volume-medium" size={16} color={colors.primary} />
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        }
                                        const label = form.label || form.form || `V${index + 1}`;
                                        const value = form.value || form.word || form.text || '';
                                        return (
                                            <TouchableOpacity
                                                key={index}
                                                style={[styles.verbFormItem, { backgroundColor: colors.surface }]}
                                                onPress={() => handleSpeak(value)}
                                            >
                                                <Text style={[styles.verbFormLabel, { color: colors.icon }]}>{label}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Text style={[styles.verbFormValue, { color: colors.primary }]}>{value}</Text>
                                                    <Ionicons name="volume-medium" size={16} color={colors.primary} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    // New Object structure from Web App
                                    <>
                                        {[
                                            { label: 'Base', value: (vocabulary.verbForms as any).base },
                                            { label: 'V2 (Past)', value: (vocabulary.verbForms as any).v2 },
                                            { label: 'V3 (PP)', value: (vocabulary.verbForms as any).v3 },
                                            { label: 'ing form', value: (vocabulary.verbForms as any).ing },
                                            { label: 's/es form', value: (vocabulary.verbForms as any).s_es }
                                        ].filter(item => item.value).map((item, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[styles.verbFormItem, { backgroundColor: colors.surface }]}
                                                onPress={() => handleSpeak(item.value)}
                                            >
                                                <Text style={[styles.verbFormLabel, { color: colors.icon }]}>{item.label}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <Text style={[styles.verbFormValue, { color: colors.primary }]}>{item.value}</Text>
                                                    <Ionicons name="volume-medium" size={16} color={colors.primary} />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Related Words */}
                    {vocabulary.relatedWords && vocabulary.relatedWords.length > 0 && (
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Related Words</Text>
                            {vocabulary.relatedWords.map((related: RelatedWord, index: number) => (
                                <View key={index} style={[styles.relatedWordContainer, { backgroundColor: colors.surface, marginBottom: 8 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={[styles.relatedWord, { color: colors.text }]}>{related.word}</Text>
                                        <TouchableOpacity onPress={() => handleSpeak(related.word)}>
                                            <Ionicons name="volume-medium" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={[styles.relatedMeaning, { color: colors.icon }]}>{related.meaning}</Text>
                                    <Text style={[styles.relatedPartOfSpeech, { color: colors.primary, fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }]}>{related.partOfSpeech}</Text>
                                    {related.example && (
                                        <Text style={[styles.relatedExample, { color: colors.text }]}>&ldquo;{related.example}&rdquo;</Text>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Examples */}
                    {vocabulary.examples && vocabulary.examples.length > 0 && (
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Examples</Text>
                            {vocabulary.examples.map((ex: VocabularyExample, index: number) => (
                                <View key={index} style={[styles.exampleBox, { backgroundColor: colors.surface, marginBottom: 8 }]}>
                                    <TouchableOpacity
                                        onPress={() => handleSpeak(ex.en)}
                                        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
                                    >
                                        <Ionicons name="volume-medium" size={18} color={colors.primary} style={{ marginTop: 2 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.exampleText, { color: colors.text }]}>&ldquo;{ex.en}&rdquo;</Text>
                                            {ex.bn && <Text style={[styles.exampleTranslation, { color: colors.icon }]}>{ex.bn}</Text>}
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Synonyms */}
                    {vocabulary.synonyms && vocabulary.synonyms.length > 0 && (
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Synonyms</Text>
                            <View style={styles.chipContainer}>
                                {vocabulary.synonyms.map((syn: string, index: number) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.chip, { backgroundColor: colors.surface }]}
                                        onPress={() => handleSpeak(syn)}
                                    >
                                        <Ionicons name="volume-medium" size={14} color={colors.primary} />
                                        <Text style={[styles.chipText, { color: colors.text }]}>{syn}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Antonyms */}
                    {vocabulary.antonyms && vocabulary.antonyms.length > 0 && (
                        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Antonyms</Text>
                            <View style={styles.chipContainer}>
                                {vocabulary.antonyms.map((ant: string, index: number) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.chip, { backgroundColor: colors.surface }]}
                                        onPress={() => handleSpeak(ant)}
                                    >
                                        <Ionicons name="volume-medium" size={14} color={colors.primary} />
                                        <Text style={[styles.chipText, { color: colors.text }]}>{ant}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
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
    headerGradient: {
        paddingBottom: 32,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    headerActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    headerRightActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
    },
    headerBangla: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
        flexShrink: 1,
    },
    headerEnglish: {
        fontSize: 22,
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 12,
        flexShrink: 1,
    },
    headerMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    headerBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    headerBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
        textTransform: 'uppercase',
    },
    headerPronunciation: {
        fontSize: 14,
        fontStyle: 'italic',
        color: 'rgba(255, 255, 255, 0.8)',
        flex: 1,
        minWidth: 100,
    },
    headerVoiceBtn: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    contentScroll: {
        flex: 1,
    },
    contentInner: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    section: {
        marginBottom: 20,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    explanationText: {
        fontSize: 16,
        lineHeight: 24,
    },
    exampleBox: {
        padding: 16,
        borderRadius: 12,
    },
    exampleText: {
        fontSize: 16,
        fontStyle: 'italic',
        lineHeight: 24,
    },
    exampleTranslation: {
        fontSize: 14,
        marginTop: 4,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        elevation: 1,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: 16,
    },
    relatedWordContainer: {
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    relatedWord: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    relatedMeaning: {
        fontSize: 16,
        marginBottom: 4,
    },
    relatedExample: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    relatedPartOfSpeech: {
        fontSize: 10,
        textTransform: 'uppercase',
    },
    verbFormsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    verbFormItem: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: '47%',
        flexGrow: 1,
        elevation: 1,
    },
    verbFormLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    verbFormValue: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    verbFormText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

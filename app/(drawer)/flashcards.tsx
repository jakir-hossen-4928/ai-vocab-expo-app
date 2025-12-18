import { AppHeader } from '@/components/AppHeader';
import { NetworkError } from '@/components/ui/NetworkError';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFlashcards } from '@/services/api';
import { getCachedVocabularies } from '@/services/offlineStorage';
import { Vocabulary } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = height * 0.6;

type FlashcardMode = 'all' | 'new' | 'review' | 'hardest';

export default function FlashcardsScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [cards, setCards] = useState<Vocabulary[]>([]);
    const [totalVocabs, setTotalVocabs] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessionComplete, setSessionComplete] = useState(false);
    const [mode, setMode] = useState<FlashcardMode>('all');

    // Animation values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const rotateZ = useSharedValue(0);
    const scale = useSharedValue(1);
    const flipRotation = useSharedValue(0);

    // Initial load
    useEffect(() => {
        loadCards(mode);
    }, []);

    const loadCards = useCallback(async (selectedMode: FlashcardMode) => {
        try {
            setLoading(true);
            setError(null);

            let vocabs: Vocabulary[] = [];

            if (selectedMode === 'all') {
                // Load ALL vocabularies from SQL
                const cached = await getCachedVocabularies();
                vocabs = cached.data;
                // Shuffle for variety
                vocabs = vocabs.sort(() => Math.random() - 0.5);
            } else {
                // Load based on SRS mode (no limit)
                vocabs = await getFlashcards(10000, selectedMode);
            }

            setTotalVocabs(vocabs.length);

            if (vocabs.length === 0) {
                setSessionComplete(true);
                setCards([]);
            } else {
                setCards(vocabs);
                setCurrentIndex(0);
                setSessionComplete(false);
            }
        } catch (err) {
            console.error('Error loading flashcards:', err);
            setError('Unable to load flashcards');
            setCards([]);
            setSessionComplete(true);
        } finally {
            setLoading(false);
        }
    }, []);

    const playAudio = async (text: string) => {
        try {
            await Speech.speak(text, { language: 'en' });
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    };

    const handleFlip = () => {
        flipRotation.value = withTiming(flipRotation.value === 0 ? 180 : 0, {
            duration: 250,
        });
    };

    const handleAnswer = async (action: 'know' | 'forget') => {
        const currentCard = cards[currentIndex];
        if (!currentCard) return;

        console.log(`🎴 Flashcard: ${action} - ${currentCard.english}`);

        // Update study streak
        const { updateStudyStreak } = await import('@/services/storage');
        updateStudyStreak().catch((err: any) => console.error('Error updating streak:', err));

        // Record activity in SQL (Combined action for atomic performance)
        const { processFlashcardAction } = await import('@/services/offlineStorage');

        try {
            await processFlashcardAction(currentCard.id, action);
        } catch (dbError) {
            console.error('❌ Error updating progress:', dbError);
        }

        // Animate card away
        const direction = action === 'know' ? 1 : -1;
        translateX.value = withTiming(direction * width * 1.5, { duration: 300 });
        scale.value = withTiming(0.8, { duration: 300 });

        setTimeout(() => {
            // Move to next card
            if (currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
                translateX.value = 0;
                translateY.value = 0;
                rotateZ.value = 0;
                scale.value = 1;
                flipRotation.value = 0;
            } else {
                setSessionComplete(true);
            }
        }, 300);
    };

    // Enhanced gesture with rotation and scale
    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY * 0.5; // Less vertical movement
            rotateZ.value = event.translationX / 15;
            scale.value = 1 - Math.abs(event.translationX) / (width * 3);
        })
        .onEnd((event) => {
            if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
                const action = event.translationX > 0 ? 'know' : 'forget';
                runOnJS(handleAnswer)(action);
            } else {
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                rotateZ.value = withSpring(0);
                scale.value = withSpring(1);
            }
        });

    const cardStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotateZ: `${rotateZ.value}deg` },
                { scale: scale.value }
            ],
        };
    });

    const frontCardStyle = useAnimatedStyle(() => {
        const rotateY = interpolate(
            flipRotation.value,
            [0, 180],
            [0, 180],
            Extrapolation.CLAMP
        );
        const opacity = interpolate(
            flipRotation.value,
            [0, 90, 180],
            [1, 0, 0],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ rotateY: `${rotateY}deg` }],
            opacity,
            backfaceVisibility: 'hidden' as const,
        };
    });

    const backCardStyle = useAnimatedStyle(() => {
        const rotateY = interpolate(
            flipRotation.value,
            [0, 180],
            [180, 360],
            Extrapolation.CLAMP
        );
        const opacity = interpolate(
            flipRotation.value,
            [0, 90, 180],
            [0, 0, 1],
            Extrapolation.CLAMP
        );
        return {
            transform: [{ rotateY: `${rotateY}deg` }],
            opacity,
            backfaceVisibility: 'hidden' as const,
        };
    });

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <AppHeader title="Flashcards" showMenuButton={true} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.icon }]}>Loading flashcards...</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <AppHeader title="Flashcards" showMenuButton={true} />
                <NetworkError
                    colors={colors}
                    onRetry={() => loadCards(mode)}
                    message={error}
                />
            </View>
        );
    }

    if (sessionComplete) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <AppHeader title="Flashcards" showMenuButton={true} />
                <View style={styles.completeContainer}>
                    <Ionicons name="checkmark-circle" size={80} color={colors.primary} />
                    <Text style={[styles.completeTitle, { color: colors.text }]}>Session Complete!</Text>
                    <Text style={[styles.completeText, { color: colors.icon }]}>
                        You've reviewed all {totalVocabs} flashcards. Great job!
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary }]}
                        onPress={() => loadCards('all')}
                    >
                        <Text style={styles.buttonText}>Start Again</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const currentCard = cards[currentIndex];

    if (!currentCard) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <AppHeader title="Flashcards" showMenuButton={true} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader title="Flashcards" showMenuButton={true} />

            <View style={styles.content}>
                {/* Progress */}
                <View style={styles.progressContainer}>
                    <Text style={[styles.progressText, { color: colors.text }]}>
                        {currentIndex + 1} / {totalVocabs}
                    </Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: colors.primary,
                                    width: `${((currentIndex + 1) / totalVocabs) * 100}%`
                                }
                            ]}
                        />
                    </View>
                </View>

                {/* Card Stack Effect - Next Card */}
                {currentIndex < cards.length - 1 && (
                    <View style={[styles.cardShadow, { backgroundColor: colors.surface }]} />
                )}

                {/* Main Card */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.cardContainer, cardStyle]}>
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={handleFlip}
                            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                            {/* Front of card */}
                            <Animated.View style={[styles.cardFace, frontCardStyle]}>
                                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                                        {currentCard.partOfSpeech}
                                    </Text>
                                </View>
                                <Text style={[styles.word, { color: colors.text }]}>
                                    {currentCard.english}
                                </Text>
                                {currentCard.pronunciation && (
                                    <Text style={[styles.phonetic, { color: colors.icon }]}>
                                        {currentCard.pronunciation}
                                    </Text>
                                )}
                                <View style={styles.tapHint}>
                                    <Ionicons name="hand-left-outline" size={20} color={colors.primary} />
                                    <Text style={[styles.tapHintText, { color: colors.icon }]}>
                                        Tap to flip
                                    </Text>
                                </View>
                            </Animated.View>

                            {/* Back of card */}
                            <Animated.View style={[styles.cardFace, styles.cardBack, backCardStyle]}>
                                <TouchableOpacity
                                    onPress={() => playAudio(currentCard.english)}
                                    style={[styles.audioButton, { backgroundColor: colors.surface }]}
                                >
                                    <Ionicons name="volume-high" size={24} color={colors.primary} />
                                </TouchableOpacity>

                                <Text style={[styles.meaningLabel, { color: colors.primary }]}>MEANING</Text>
                                <Text style={[styles.meaning, { color: colors.text }]}>
                                    {currentCard.bangla}
                                </Text>

                                {currentCard.synonyms && currentCard.synonyms.length > 0 && (
                                    <View style={styles.synonymsContainer}>
                                        <Text style={[styles.meaningLabel, { color: colors.primary }]}>SYNONYMS</Text>
                                        <View style={styles.synonymsList}>
                                            {currentCard.synonyms.slice(0, 4).map((syn, idx) => (
                                                <View key={idx} style={[styles.synonymChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                                    <Text style={[styles.synonymText, { color: colors.text }]}>{syn}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </Animated.View>
                        </TouchableOpacity>
                    </Animated.View>
                </GestureDetector>

                {/* Action Buttons */}
                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.controlButton, styles.forgetButton]}
                        onPress={() => handleAnswer('forget')}
                    >
                        <Ionicons name="close" size={32} color="#fff" />
                        <Text style={styles.buttonLabel}>Forget</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.controlButton, styles.knowButton]}
                        onPress={() => handleAnswer('know')}
                    >
                        <Ionicons name="checkmark" size={32} color="#fff" />
                        <Text style={styles.buttonLabel}>Know</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressContainer: {
        width: '100%',
        marginBottom: 20,
    },
    progressText: {
        textAlign: 'center',
        marginBottom: 8,
        fontSize: 16,
        fontWeight: '700',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    cardShadow: {
        position: 'absolute',
        width: CARD_WIDTH - 20,
        height: CARD_HEIGHT - 20,
        borderRadius: 20,
        opacity: 0.3,
        top: '50%',
        marginTop: -CARD_HEIGHT / 2 + 10,
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
    },
    card: {
        flex: 1,
        borderRadius: 24,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    cardFace: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
    },
    cardBack: {
        transform: [{ rotateY: '180deg' }],
    },
    badge: {
        position: 'absolute',
        top: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    word: {
        fontSize: 36,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    phonetic: {
        fontSize: 18,
        fontFamily: 'monospace',
    },
    tapHint: {
        position: 'absolute',
        bottom: 24,
        alignItems: 'center',
        gap: 8,
    },
    tapHintText: {
        fontSize: 13,
        fontWeight: '500',
    },
    audioButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    meaningLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 1,
    },
    meaning: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 24,
    },
    synonymsContainer: {
        width: '100%',
        alignItems: 'center',
        marginTop: 16,
    },
    synonymsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        marginTop: 8,
    },
    synonymChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    synonymText: {
        fontSize: 13,
        fontWeight: '500',
    },
    controls: {
        flexDirection: 'row',
        marginTop: 30,
        gap: 20,
    },
    controlButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    forgetButton: {
        backgroundColor: '#FF5252',
    },
    knowButton: {
        backgroundColor: '#4CAF50',
    },
    buttonLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    hintContainer: {
        flexDirection: 'row',
        marginTop: 20,
        gap: 32,
    },
    hintItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    hintText: {
        fontSize: 12,
        fontWeight: '500',
    },
    completeContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    completeTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
    },
    completeText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    button: {
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 25,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Vocabulary } from '@/types';
import { Colors } from '@/constants/theme';

interface VocabularyCardProps {
    item: Vocabulary;
    index?: number;
    isOnline?: boolean;
    isFavorite: boolean;
    colors: typeof Colors.light;
    onPress?: (item: Vocabulary) => void;
    onToggleFavorite?: (item: Vocabulary) => void;
    onSpeak: (text: string) => void;
    onShare: (item: Vocabulary) => void;
}

export const VocabularyCard = memo(({
    item,
    index = 0,
    isOnline = false,
    isFavorite,
    colors,
    onPress,
    onToggleFavorite,
    onSpeak,
    onShare
}: VocabularyCardProps) => {
    const firstExample = item.examples && item.examples.length > 0 ? item.examples[0].en : null;

    const CardContent = (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors.card,
                    borderColor: isOnline ? colors.primary : colors.border
                }
            ]}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                    {/* Show BANGLA first (larger) */}
                    <Text style={[styles.bangla, { color: colors.text }]}>{item.bangla}</Text>
                    {/* Then English (smaller) */}
                    <Text style={[styles.english, { color: colors.icon }]}>{item.english}</Text>
                </View>
                {!isOnline && onToggleFavorite && (
                    <TouchableOpacity onPress={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(item);
                    }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={isFavorite ? "heart" : "heart-outline"}
                            size={24}
                            color={isFavorite ? "#F44336" : colors.primary}
                        />
                    </TouchableOpacity>
                )}
            </View>

            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{item.partOfSpeech}</Text>
            </View>

            {item.explanation && (
                <Text style={[styles.explanation, { color: colors.text }]} numberOfLines={2}>
                    {item.explanation}
                </Text>
            )}

            {firstExample && (
                <View style={[styles.exampleContainer, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.exampleText, { color: colors.text }]}>
                        "{firstExample}"
                    </Text>
                </View>
            )}

            <View style={styles.cardFooter}>
                <TouchableOpacity
                    style={styles.footerButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onSpeak(item.english);
                    }}
                >
                    <Ionicons name="volume-medium" size={20} color={colors.primary} />
                    <Text style={[styles.footerButtonText, { color: colors.primary }]}>Listen</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.footerButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onShare(item);
                    }}
                >
                    <Ionicons name="share-social" size={20} color={colors.primary} />
                    <Text style={[styles.footerButtonText, { color: colors.primary }]}>Share</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (onPress && !isOnline) {
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(item)}>
                <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
                    {CardContent}
                </Animated.View>
            </TouchableOpacity>
        );
    }

    return (
        <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            {CardContent}
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        fontSize: 14,
        marginBottom: 4,
    },
    bangla: {
        fontSize: 18,
        fontWeight: '600',
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
});

import { AppHeader } from '@/components/AppHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCachedVocabularies } from '@/services/offlineStorage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({ new: 0, learning: 0, review: 0, mastered: 0, difficult: 0 });
    const [totalVocabs, setTotalVocabs] = useState(0);
    const [streak, setStreak] = useState(0);

    useEffect(() => {
        loadAnalytics();
    }, []);

    const loadAnalytics = async () => {
        try {
            setLoading(true);

            // Get flashcard SRS stats
            const { getLearningStats } = await import('@/services/offlineStorage');
            const learningStats = await getLearningStats();

            // Set stats from SRS (mastered goes to known, difficult+learning to practice)
            setStats(learningStats);

            // Get total vocabulary count
            const cached = await getCachedVocabularies();
            setTotalVocabs(cached.data.length);

            // Get real study streak
            const { getStudyStreak } = await import('@/services/storage');
            const currentStreak = await getStudyStreak();
            setStreak(currentStreak);
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAnalytics();
        setRefreshing(false);
    };

    // Calculate metrics
    const wordsKnown = stats.mastered + stats.review;
    const wordsForgotten = stats.difficult;
    const wordsInProgress = stats.learning;
    const wordsNotStarted = stats.new;
    const totalStudied = wordsKnown + wordsForgotten + wordsInProgress;
    const studyProgress = totalVocabs > 0 ? Math.round((totalStudied / totalVocabs) * 100) : 0;
    const masteryRate = totalStudied > 0 ? Math.round((wordsKnown / totalStudied) * 100) : 0;

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <AppHeader title="Learning Analytics" showMenuButton={true} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.icon }]}>Loading analytics...</Text>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader title="Learning Analytics" showMenuButton={true} />

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                {/* Streak Card */}
                <View style={styles.streakSection}>
                    <View style={[styles.streakCard, { backgroundColor: colors.primary }]}>
                        <View style={styles.streakContent}>
                            <Ionicons name="flame" size={48} color="#FFF" />
                            <View style={styles.streakInfo}>
                                <Text style={styles.streakNumber}>{streak}</Text>
                                <Text style={styles.streakLabel}>Day Streak</Text>
                            </View>
                        </View>
                        <Text style={styles.streakMessage}>
                            {streak === 0 ? "Start studying to build your streak!" :
                                streak === 1 ? "Great start! Keep it going!" :
                                    streak < 7 ? "You're on fire! 🔥" :
                                        streak < 30 ? "Amazing dedication! 🌟" :
                                            "Legendary streak! 👑"}
                        </Text>
                    </View>
                </View>

                {/* Activity Overview */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Learning Overview</Text>

                    <View style={styles.activityGrid}>
                        <View style={[styles.activityCard, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
                            <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                            <Text style={[styles.activityNumber, { color: '#2E7D32' }]}>{wordsKnown}</Text>
                            <Text style={[styles.activityLabel, { color: '#2E7D32' }]}>Words Mastered</Text>
                        </View>

                        <View style={[styles.activityCard, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
                            <Ionicons name="school" size={32} color="#FF9800" />
                            <Text style={[styles.activityNumber, { color: '#E65100' }]}>{wordsInProgress + wordsForgotten}</Text>
                            <Text style={[styles.activityLabel, { color: '#E65100' }]}>Learning / Practice</Text>
                        </View>

                        <View style={[styles.activityCard, { backgroundColor: '#E3F2FD', borderColor: '#2196F3', width: width - 40 }]}>
                            <Ionicons name="sparkles" size={32} color="#2196F3" />
                            <Text style={[styles.activityNumber, { color: '#1565C0' }]}>{wordsNotStarted}</Text>
                            <Text style={[styles.activityLabel, { color: '#1565C0' }]}>Not Started Yet (Total: {totalVocabs})</Text>
                        </View>
                    </View>
                </View>

                {/* Progress Overview */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Learning Progress</Text>

                    <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.progressRow}>
                            <View style={styles.progressInfo}>
                                <Text style={[styles.progressLabel, { color: colors.icon }]}>Overall Mastery</Text>
                                <Text style={[styles.progressValue, { color: colors.text }]}>
                                    {wordsKnown} / {totalVocabs} words mastered
                                </Text>
                            </View>
                            <Text style={[styles.progressPercent, { color: '#4CAF50' }]}>
                                {totalVocabs > 0 ? Math.round((wordsKnown / totalVocabs) * 100) : 0}%
                            </Text>
                        </View>
                        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                            <View style={[styles.progressFill, { backgroundColor: '#4CAF50', width: `${totalVocabs > 0 ? (wordsKnown / totalVocabs) * 100 : 0}%` }]} />
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                {wordsForgotten > 0 && (
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: '#F44336' }]}
                            onPress={() => router.push('/(drawer)/flashcards')}
                        >
                            <Ionicons name="refresh" size={24} color="#fff" />
                            <View style={styles.actionButtonText}>
                                <Text style={styles.actionButtonTitle}>Practice Difficult Words</Text>
                                <Text style={styles.actionButtonSubtitle}>{wordsForgotten} words need review</Text>
                            </View>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                        onPress={() => router.push('/(drawer)/flashcards')}
                    >
                        <MaterialCommunityIcons name="cards" size={24} color="#fff" />
                        <View style={styles.actionButtonText}>
                            <Text style={styles.actionButtonTitle}>Continue Learning</Text>
                            <Text style={styles.actionButtonSubtitle}>Study all {totalVocabs} words</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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
    scrollView: {
        flex: 1,
    },
    streakSection: {
        padding: 20,
    },
    streakCard: {
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    streakContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 12,
    },
    streakInfo: {
        flex: 1,
    },
    streakNumber: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        lineHeight: 52,
    },
    streakLabel: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
    },
    streakMessage: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    activityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    activityCard: {
        width: (width - 52) / 2,
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
        gap: 8,
    },
    activityNumber: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    activityLabel: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
    },
    progressCard: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    progressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressInfo: {
        flex: 1,
    },
    progressLabel: {
        fontSize: 13,
        marginBottom: 4,
    },
    progressValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    progressPercent: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    stageCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    stageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    stageLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stageDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    stageLabel: {
        fontSize: 15,
        fontWeight: '600',
    },
    stageCount: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    stageBar: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    stageBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 16,
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    actionButtonText: {
        flex: 1,
    },
    actionButtonTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 2,
    },
    actionButtonSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
    },
});

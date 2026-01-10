import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';

export default function HelpSupportScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const router = useRouter();

    const helpTopics = [
        {
            id: '1',
            title: 'Getting Started',
            description: 'Learn how to use AI Vocab',
            icon: 'rocket',
        },
        {
            id: '2',
            title: 'Adding Vocabulary',
            description: 'How to add and manage your vocabulary',
            icon: 'add-circle',
        },
        {
            id: '3',
            title: 'Favorites & Bookmarks',
            description: 'Save and organize your favorite words',
            icon: 'heart',
        },
        {
            id: '4',
            title: 'Search & Filters',
            description: 'Find words quickly with search and filters',
            icon: 'search',
        },
    ];

    const contactOptions = [
        {
            id: 'email',
            title: 'Email Support',
            description: 'mdjakirkhan4928@gmail.com',
            icon: 'mail',
            action: () => Linking.openURL('mailto:mdjakirkhan4928@gmail.com'),
        },
        {
            id: 'whatsapp',
            title: 'WhatsApp',
            description: '+880 1647-470849',
            icon: 'logo-whatsapp',
            action: () => Linking.openURL('https://wa.me/8801647470849'),
        },
        {
            id: 'website',
            title: 'Visit Website',
            description: 'ai-vocabulary-coach.netlify.app',
            icon: 'globe',
            action: () => Linking.openURL('https://ai-vocabulary-coach.netlify.app/'),
        },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <AppHeader title="Help & Support" showMenuButton={true} />

            <ScrollView contentContainerStyle={styles.content}>
                {/* Help Topics */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Help Topics</Text>
                {helpTopics.map((topic) => (
                    <TouchableOpacity
                        key={topic.id}
                        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: colors.accent }]}>
                            <Ionicons name={topic.icon as any} size={24} color={colors.primary} />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>{topic.title}</Text>
                            <Text style={[styles.cardDescription, { color: colors.icon }]}>
                                {topic.description}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                    </TouchableOpacity>
                ))}

                {/* Contact Us */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
                    Contact Us
                </Text>
                {contactOptions.map((option) => (
                    <TouchableOpacity
                        key={option.id}
                        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={option.action}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: colors.accent }]}>
                            <Ionicons name={option.icon as any} size={24} color={colors.primary} />
                        </View>
                        <View style={styles.cardContent}>
                            <Text style={[styles.cardTitle, { color: colors.text }]}>{option.title}</Text>
                            <Text style={[styles.cardDescription, { color: colors.icon }]}>
                                {option.description}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.icon} />
                    </TouchableOpacity>
                ))}

                {/* FAQ */}
                <TouchableOpacity
                    style={[styles.faqButton, { backgroundColor: colors.primary }]}
                >
                    <Ionicons name="help-circle-outline" size={24} color="#fff" />
                    <Text style={styles.faqButtonText}>View Frequently Asked Questions</Text>
                </TouchableOpacity>
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
        padding: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    cardDescription: {
        fontSize: 14,
    },
    faqButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 24,
        gap: 8,
    },
    faqButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

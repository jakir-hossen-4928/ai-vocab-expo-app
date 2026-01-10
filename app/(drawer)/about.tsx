import { AppHeader } from '@/components/AppHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, Linking, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <AppHeader title="About AI Vocab" showMenuButton={true} />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.logoContainer, { backgroundColor: colors.primary, overflow: 'hidden' }]}>
                    <Image
                        source={require('../../assets/images/author-image.jpg')}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>AI Vocab</Text>
                <Text style={[styles.version, { color: colors.icon }]}>Version 1.0.0</Text>

                <Text style={[styles.description, { color: colors.text }]}>
                    AI Vocab is your personal vocabulary learning companion powered by artificial intelligence.
                    Learn new words, track your progress, and improve your language skills.
                </Text>

                <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="person" size={24} color={colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: colors.icon }]}>Author</Text>
                        <Text style={[styles.infoValue, { color: colors.text }]}>Jakir Hossen</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => Linking.openURL('https://jakirhossen.netlify.app')}
                >
                    <Ionicons name="globe" size={24} color={colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: colors.icon }]}>Author Website</Text>
                        <Text style={[styles.infoValue, { color: colors.text, textDecorationLine: 'underline' }]}>jakirhossen.netlify.app</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => Linking.openURL('https://ai-vocabulary-coach.netlify.app/')}
                >
                    <Ionicons name="desktop-outline" size={24} color={colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: colors.icon }]}>AI Vocab Website</Text>
                        <Text style={[styles.infoValue, { color: colors.text, textDecorationLine: 'underline' }]}>ai-vocabulary-coach.netlify.app</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    logoText: {
        fontSize: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    version: {
        fontSize: 14,
        marginBottom: 24,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
    },
    infoCard: {
        flexDirection: 'row',
        width: '100%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
        gap: 16,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
    },
});


// import { logger } from '@/services/logger';

import { AppHeader } from '@/components/AppHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DictionaryEntry, searchDictionaryAPI } from '@/services/dictionary';
import { translateText } from '@/services/translate';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function DictionaryScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    // Tabs state
    const [activeTab, setActiveTab] = useState<'native' | 'cambridge' | 'oxford'>('native');

    // Native Dictionary State
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DictionaryEntry | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [translating, setTranslating] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);

    React.useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const searchWord = async (word: string) => {
        if (!word.trim()) {
            Alert.alert("Error", "Please enter a word to search");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setTranslation(null);

        try {
            const data = await searchDictionaryAPI(word);

            if (data) {
                setResult(data);
                // Auto translate the word itself
                handleTranslate(word);
            } else {
                setError(`No definition found for "${word}"`);
            }
        } catch (err) {
            setError("Network error. Please check your connection.");
            console.error("Dictionary API error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        searchWord(searchQuery);
    };

    const handleTranslate = async (text: string) => {
        try {
            setTranslating(true);
            const res = await translateText(text);
            setTranslation(res.translatedText);
        } catch (error) {
            console.warn("Translation failed", error);
        } finally {
            setTranslating(false);
        }
    };

    const playAudio = async (audioUrl: string) => {
        try {
            if (sound) {
                await sound.unloadAsync();
            }

            const url = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
            const { sound: newSound } = await Audio.Sound.createAsync({ uri: url });
            setSound(newSound);
            await newSound.playAsync();
        } catch (error) {
            console.error("Audio playback error", error);
            Alert.alert("Error", "Failed to play audio");
        }
    };

    const renderTabs = () => (
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'native' && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab('native')}
            >
                <Text style={[styles.tabText, { color: activeTab === 'native' ? '#fff' : colors.text }]}>Dictionary</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'cambridge' && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab('cambridge')}
            >
                <Text style={[styles.tabText, { color: activeTab === 'cambridge' ? '#fff' : colors.text }]}>Cambridge</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeTab === 'oxford' && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab('oxford')}
            >
                <Text style={[styles.tabText, { color: activeTab === 'oxford' ? '#fff' : colors.text }]}>Oxford</Text>
            </TouchableOpacity>
        </View>
    );

    const renderNativeDictionary = () => (
        <>
            <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Search for a word..."
                    placeholderTextColor={colors.icon}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                />
                <TouchableOpacity onPress={handleSearch} disabled={loading} style={styles.searchButton}>
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (
                        <Ionicons name="search" size={24} color={colors.primary} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {error && (
                    <View style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={48} color="#F44336" />
                        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
                    </View>
                )}

                {!loading && !result && !error && (
                    <View style={styles.emptyState}>
                        <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
                            <Ionicons name="search-outline" size={64} color={colors.icon} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Search for a Word</Text>
                        <Text style={[styles.emptyText, { color: colors.icon }]}>
                            Enter any English word to get its definition, pronunciation, examples, and more.
                        </Text>
                    </View>
                )}

                {result && (
                    <View style={styles.resultContainer}>
                        {/* Translation Card */}
                        <View style={[styles.translationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.translationHeader, { backgroundColor: '#4285F4' }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="logo-google" size={18} color="#fff" />
                                    <Text style={styles.translationLabel}>Google Translate</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    {translating && <ActivityIndicator size="small" color="#fff" />}
                                    <TouchableOpacity onPress={() => handleTranslate(result.word)}>
                                        <Ionicons name="refresh" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.translationBody}>
                                <Text style={[styles.sourceText, { color: colors.icon }]}>English</Text>
                                <Text style={[styles.sourceWord, { color: colors.text }]}>{result.word}</Text>

                                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                                <Text style={[styles.targetText, { color: colors.icon }]}>Bengali</Text>
                                {translating ? (
                                    <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
                                ) : (
                                    <Text style={[styles.translatedWord, { color: colors.primary }]}>
                                        {translation || "Translation unavailable"}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.wordHeader}>
                                <View>
                                    <Text style={[styles.word, { color: colors.text }]}>{result.word}</Text>
                                    {result.phonetic && (
                                        <Text style={[styles.phonetic, { color: colors.icon }]}>
                                            {result.phonetic}
                                        </Text>
                                    )}
                                </View>
                                {result.phonetics.find(p => p.audio) && (
                                    <TouchableOpacity
                                        style={[styles.audioButton, { backgroundColor: colors.surface }]}
                                        onPress={() => {
                                            const audioPhonetic = result.phonetics.find(p => p.audio);
                                            if (audioPhonetic?.audio) {
                                                playAudio(audioPhonetic.audio);
                                            }
                                        }}
                                    >
                                        <Ionicons name="volume-high" size={24} color={colors.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {result.origin && (
                                <View style={[styles.originContainer, { backgroundColor: colors.surface }]}>
                                    <Text style={[styles.originLabel, { color: colors.icon }]}>Origin</Text>
                                    <Text style={[styles.originText, { color: colors.text }]}>{result.origin}</Text>
                                </View>
                            )}
                        </View>

                        {result.meanings.map((meaning, index) => (
                            <View key={index} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                                <View style={styles.partOfSpeechHeader}>
                                    <Ionicons name="book" size={20} color={colors.primary} />
                                    <Text style={[styles.partOfSpeech, { color: colors.primary }]}>
                                        {meaning.partOfSpeech}
                                    </Text>
                                </View>

                                {meaning.definitions.map((def, defIndex) => (
                                    <View key={defIndex} style={styles.definitionContainer}>
                                        <Text style={[styles.definition, { color: colors.text }]}>
                                            {defIndex + 1}. {def.definition}
                                        </Text>
                                        {def.example && (
                                            <View style={[styles.exampleContainer, { borderLeftColor: colors.primary }]}>
                                                <Text style={[styles.exampleText, { color: colors.icon }]}>
                                                    "{def.example}"
                                                </Text>
                                            </View>
                                        )}

                                        {def.synonyms.length > 0 && (
                                            <View style={styles.chipContainer}>
                                                <Text style={[styles.chipLabel, { color: colors.icon }]}>Synonyms:</Text>
                                                <View style={styles.chips}>
                                                    {def.synonyms.slice(0, 5).map((syn, i) => (
                                                        <TouchableOpacity
                                                            key={i}
                                                            style={[styles.chip, { backgroundColor: colors.surface }]}
                                                            onPress={() => {
                                                                setSearchQuery(syn);
                                                                searchWord(syn);
                                                            }}
                                                        >
                                                            <Text style={[styles.chipText, { color: colors.primary }]}>{syn}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        {def.antonyms.length > 0 && (
                                            <View style={styles.chipContainer}>
                                                <Text style={[styles.chipLabel, { color: colors.icon }]}>Antonyms:</Text>
                                                <View style={styles.chips}>
                                                    {def.antonyms.slice(0, 5).map((ant, i) => (
                                                        <TouchableOpacity
                                                            key={i}
                                                            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                                                            onPress={() => {
                                                                setSearchQuery(ant);
                                                                searchWord(ant);
                                                            }}
                                                        >
                                                            <Text style={[styles.chipText, { color: colors.text }]}>{ant}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </>
    );

    const renderWebView = (url: string) => (
        <WebView
            source={{ uri: url }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            )}
        />
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader
                title="Dictionary"
                showMenuButton={true}
                showBackButton={false}
            />

            {renderTabs()}

            {activeTab === 'native' ? (
                renderNativeDictionary()
            ) : activeTab === 'cambridge' ? (
                renderWebView(searchQuery.trim() ? `https://dictionary.cambridge.org/dictionary/english/${searchQuery}` : 'https://dictionary.cambridge.org/')
            ) : (
                renderWebView(searchQuery.trim() ? `https://www.oxfordlearnersdictionaries.com/definition/english/${searchQuery}` : 'https://www.oxfordlearnersdictionaries.com/')
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    tabContainer: {
        flexDirection: 'row',
        margin: 16,
        marginBottom: 8,
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        fontWeight: '600',
        fontSize: 14,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
    },
    searchButton: {
        padding: 8,
    },
    content: {
        padding: 16,
        paddingTop: 8,
        paddingBottom: 40,
    },
    errorContainer: {
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
    },
    resultContainer: {
        gap: 16,
    },
    card: {
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    wordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    word: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    phonetic: {
        fontSize: 16,
        fontFamily: 'monospace',
    },
    audioButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    originContainer: {
        padding: 12,
        borderRadius: 8,
    },
    originLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    originText: {
        fontSize: 14,
        lineHeight: 20,
    },
    partOfSpeechHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    partOfSpeech: {
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    definitionContainer: {
        marginBottom: 20,
    },
    definition: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 8,
    },
    exampleContainer: {
        paddingLeft: 12,
        borderLeftWidth: 3,
        marginBottom: 8,
    },
    exampleText: {
        fontSize: 14,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    chipContainer: {
        marginTop: 8,
    },
    chipLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    chipText: {
        fontSize: 12,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    translationCard: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 2,
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    translationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    translationLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
    translationBody: {
        padding: 16,
    },
    sourceText: {
        fontSize: 12,
        marginBottom: 4,
    },
    sourceWord: {
        fontSize: 18,
        fontWeight: '500',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        width: '100%',
        marginBottom: 12,
    },
    targetText: {
        fontSize: 12,
        marginBottom: 4,
    },
    translatedWord: {
        fontSize: 22,
        fontWeight: 'bold',
    },
});
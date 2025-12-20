import { AppHeader } from '@/components/AppHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAIModel, getOpenRouterApiKey, getTTSSettings, setAIModel, setOpenRouterApiKey, setTTSSettings, TTSSettings } from '@/services/storage';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as Speech from 'expo-speech';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    // OpenAI/OpenRouter Settings
    const [apiKey, setApiKey] = useState('');
    const [selectedModel, setSelectedModel] = useState('google/gemma-2-9b-it:free');
    const [loading, setLoading] = useState(false);

    // TTS Settings
    const [ttsSettings, setTtsSettingsState] = useState<TTSSettings>({ pitch: 1.0, rate: 1.0 });
    const [voices, setVoices] = useState<Speech.Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | undefined>(undefined);

    const availableModels = [
        {
            id: "meta-llama/llama-3.3-70b-instruct:free",
            name: "Llama 3.3 70B Instruct (Free)",
            description: "Best overall quality, clean output"
        },
        {
            id: "z-ai/glm-4.5-air:free",
            name: "GLM 4.5 Air (Free)",
            description: "Fast, concise, low token usage"
        },
        {
            id: "openai/gpt-oss-20b:free",
            name: "GPT OSS 20B (Free)",
            description: "Very stable instruction following"
        },
        {
            id: "moonshotai/kimi-k2:free",
            name: "Kimi K2 (Free)",
            description: "Clear explanations, minimal verbosity"
        },
        {
            id: "kwaipilot/kat-coder-pro:free",
            name: "Kat Coder Pro (Free)",
            description: "Surprisingly clean for short answers"
        }
    ];

    useEffect(() => {
        loadSettings();
        loadVoices();
    }, []);

    const loadSettings = async () => {
        const key = await getOpenRouterApiKey();
        if (key) setApiKey(key);

        const model = await getAIModel();
        setSelectedModel(model);

        const tts = await getTTSSettings();
        setTtsSettingsState(tts);
        if (tts.voiceIdentifier) setSelectedVoice(tts.voiceIdentifier);
    };

    const loadVoices = async () => {
        const available = await Speech.getAvailableVoicesAsync();
        const englishVoices = available.filter(v => v.language.startsWith('en'));
        setVoices(englishVoices.length > 0 ? englishVoices : available);
    };

    const handleSaveApiKey = async () => {
        if (apiKey.trim()) {
            await setOpenRouterApiKey(apiKey.trim());
            Alert.alert('Success', 'API Key saved securely.');
        }
    };

    const handleModelSelect = async (modelId: string) => {
        setSelectedModel(modelId);
        await setAIModel(modelId);
    };

    const handleTTSChange = async (key: keyof TTSSettings, value: any) => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettingsState(newSettings);
        if (key === 'voiceIdentifier') setSelectedVoice(value);
        await setTTSSettings(newSettings);
    };

    const testVoice = async () => {
        const options: Speech.SpeechOptions = {
            pitch: ttsSettings.pitch,
            rate: ttsSettings.rate,
        };
        if (selectedVoice) options.voice = selectedVoice;
        Speech.stop();
        Speech.speak('This is a test of your voice settings.', options);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <AppHeader title="Settings" showMenuButton={true} />
            <ScrollView contentContainerStyle={styles.content}>

                {/* AI Configuration Section */}
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        <Ionicons name="hardware-chip-outline" size={20} /> AI Configuration
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                        <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>OpenRouter API Key:</Text>
                        <TouchableOpacity onPress={() => Linking.openURL('https://openrouter.ai/keys')}>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Get Key ↗</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.apiKeyContainer}>
                        <TextInput
                            style={[
                                styles.input,
                                { flex: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }
                            ]}
                            placeholder="sk-or-..."
                            placeholderTextColor={colors.icon}
                            value={apiKey}
                            onChangeText={setApiKey}
                            secureTextEntry={true}
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.primary }]}
                            onPress={handleSaveApiKey}
                        >
                            <Ionicons name="save-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { color: colors.text, marginTop: 16 }]}>Select AI Model:</Text>
                    <View style={styles.modelList}>
                        {availableModels.map((model) => (
                            <TouchableOpacity
                                key={model.id}
                                style={[
                                    styles.modelOption,
                                    {
                                        backgroundColor: selectedModel === model.id ? colors.primary : colors.surface,
                                        borderColor: colors.border
                                    }
                                ]}
                                onPress={() => handleModelSelect(model.id)}
                            >
                                <Text style={[
                                    styles.modelText,
                                    { color: selectedModel === model.id ? '#fff' : colors.text }
                                ]}>
                                    {model.name}
                                </Text>
                                {selectedModel === model.id && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Text-to-Speech Section */}
                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                        <Ionicons name="volume-high-outline" size={20} /> Voice Settings (TTS)
                    </Text>

                    <Text style={[styles.label, { color: colors.text }]}>Pitch: {ttsSettings.pitch.toFixed(1)}</Text>
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0.5}
                        maximumValue={2.0}
                        step={0.1}
                        value={ttsSettings.pitch}
                        onSlidingComplete={(val) => handleTTSChange('pitch', val)}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                    />

                    <Text style={[styles.label, { color: colors.text }]}>Speed: {ttsSettings.rate.toFixed(1)}x</Text>
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={0.5}
                        maximumValue={2.0}
                        step={0.1}
                        value={ttsSettings.rate}
                        onSlidingComplete={(val) => handleTTSChange('rate', val)}
                        minimumTrackTintColor={colors.primary}
                        maximumTrackTintColor={colors.border}
                    />

                    <Text style={[styles.label, { color: colors.text, marginTop: 8 }]}>Voice Selection:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                        {voices.slice(0, 10).map((voice) => (
                            <TouchableOpacity
                                key={voice.identifier}
                                style={[
                                    styles.voiceChip,
                                    {
                                        backgroundColor: selectedVoice === voice.identifier ? colors.primary : colors.surface,
                                        borderColor: colors.border
                                    }
                                ]}
                                onPress={() => handleTTSChange('voiceIdentifier', voice.identifier)}
                            >
                                <Text style={{ color: selectedVoice === voice.identifier ? '#fff' : colors.text, fontSize: 13 }}>
                                    {voice.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.testButton, { borderColor: colors.primary }]}
                        onPress={testVoice}
                        accessibilityLabel="Test Voice Button"
                        accessibilityHint="Plays a sample text with the selected voice settings"
                    >
                        <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
                        <Text style={[styles.testButtonText, { color: colors.primary }]}>Test Voice</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.testButton, { borderColor: colors.icon, marginTop: 8 }]}
                        onPress={() => Linking.openSettings()}
                        accessibilityLabel="Manage System Voices"
                        accessibilityHint="Opens system settings to download or manage voices"
                    >
                        <Ionicons name="download-outline" size={20} color={colors.icon} />
                        <Text style={[styles.testButtonText, { color: colors.icon }]}>Manage System Voices</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center' }]}>
                    <Text style={{ color: colors.icon, fontSize: 12 }}>App Version 1.0.0</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 20,
    },
    section: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3.84,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    apiKeyContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
    },
    saveButton: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    modelList: {
        gap: 8,
    },
    modelOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    modelText: {
        fontSize: 14,
        fontWeight: '500',
    },
    voiceChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 12,
        gap: 8,
    },
    testButtonText: {
        fontWeight: '600',
    },
});

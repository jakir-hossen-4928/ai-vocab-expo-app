import { getOpenRouterApiKey, setOpenRouterApiKey } from '@/services/storage';
import { chatWithVocabulary } from '@/services/openRouterService';
import { Vocabulary } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ChatModalProps {
    visible: boolean;
    onClose: () => void;
    vocabulary: Vocabulary | null;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export function ChatModal({ visible, onClose, vocabulary }: ChatModalProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [apiKey, setApiKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        checkApiKey();
    }, [visible]);

    useEffect(() => {
        // Clear chat when vocabulary changes or modal opens
        if (visible && vocabulary) {
            setMessages([
                {
                    role: 'assistant',
                    content: `Hi! I'm your AI tutor. Ask me anything about the word "${vocabulary.english}".`,
                },
            ]);
        }
    }, [visible, vocabulary]);

    const checkApiKey = async () => {
        const key = await getOpenRouterApiKey();
        if (key) {
            setHasKey(true);
            setApiKey(key);
        } else {
            setHasKey(false);
        }
    };

    const handleSaveKey = async () => {
        if (apiKey.trim()) {
            await setOpenRouterApiKey(apiKey.trim());
            setHasKey(true);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() || !vocabulary) return;

        const userMessage = { role: 'user' as const, content: inputText.trim() };
        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setLoading(true);
        Keyboard.dismiss();

        try {
            // Include conversation history
            const history = [...messages, userMessage];

            // Only send the last few messages to save context/tokens if needed,
            // but for now sending full history is fine for short chats.

            const response = await chatWithVocabulary(vocabulary, history);

            if (response && response.content) {
                setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: response.content || "I couldn't generate a response." },
                ]);
            }
        } catch (error: any) {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `Error: ${error.message}` },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>AI Chat Tutor</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close-circle" size={30} color={colors.icon} />
                    </TouchableOpacity>
                </View>

                {!hasKey ? (
                    <View style={styles.keyContainer}>
                        <Ionicons name="key-outline" size={64} color={colors.primary} />
                        <Text style={[styles.keyTitle, { color: colors.text }]}>API Key Required</Text>
                        <Text style={[styles.keyDesc, { color: colors.icon }]}>
                            To use the AI Tutor, please enter your OpenRouter API key.
                            It will be stored securely on your device.
                        </Text>
                        <TextInput
                            style={[styles.keyInput, {
                                color: colors.text,
                                borderColor: colors.border,
                                backgroundColor: colors.card
                            }]}
                            placeholder="sk-or-..."
                            placeholderTextColor={colors.icon}
                            value={apiKey}
                            onChangeText={setApiKey}
                            autoCapitalize="none"
                            secureTextEntry
                        />
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.primary }]}
                            onPress={handleSaveKey}
                        >
                            <Text style={styles.saveButtonText}>Save API Key</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                    >
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.chatContainer}
                            contentContainerStyle={{ paddingVertical: 20 }}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                        >
                            {messages.map((msg, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.messageBubble,
                                        msg.role === 'user'
                                            ? [styles.userBubble, { backgroundColor: colors.primary }]
                                            : [styles.botBubble, { backgroundColor: colors.card }],
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.messageText,
                                            { color: msg.role === 'user' ? '#fff' : colors.text },
                                        ]}
                                    >
                                        {msg.content}
                                    </Text>
                                </View>
                            ))}
                            {loading && (
                                <View style={[styles.botBubble, { backgroundColor: colors.card, width: 60, alignItems: 'center' }]}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            )}
                        </ScrollView>

                        <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                            <TextInput
                                style={[styles.input, {
                                    backgroundColor: colors.surface,
                                    color: colors.text,
                                    borderColor: colors.border
                                }]}
                                placeholder="Ask about this word..."
                                placeholderTextColor={colors.icon}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, { backgroundColor: inputText.trim() ? colors.primary : colors.border }]}
                                onPress={handleSend}
                                disabled={!inputText.trim() || loading}
                            >
                                <Ionicons name="send" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                )}
            </View>
        </Modal>
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
        paddingTop: Platform.OS === 'android' ? 16 : 0, // Adjust if needed
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    keyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    keyTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    keyDesc: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    keyInput: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        fontSize: 16,
        marginBottom: 16,
    },
    saveButton: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    chatContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    messageBubble: {
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        maxWidth: '85%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    botBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 100,
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        borderWidth: 1,
        marginRight: 12,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

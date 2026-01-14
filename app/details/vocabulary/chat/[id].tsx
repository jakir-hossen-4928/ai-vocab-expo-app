import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getVocabularyById } from "@/services/api";
import { chatWithVocabulary } from "@/services/openRouterService";
import {
  getAIModel,
  getChatSession,
  getOpenRouterApiKey,
  saveChatSession,
} from "@/services/storage";
import { Vocabulary } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const flatListRef = useRef<FlashList<Message>>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (id) {
      setupChat();
    }
  }, [id]);

  const setupChat = async () => {
    try {
      // Fetch vocabulary details
      const data = await getVocabularyById(id as string);
      setVocabulary(data);

      // Load existing chat session if available
      const session = await getChatSession(id as string);
      if (session && session.messages.length > 0) {
        setMessages(session.messages);
      } else {
        // Set initial message
        setMessages([
          {
            id: "1",
            role: "assistant",
            content: `Hi! I'm your AI tutor. Ask me anything about "${data.english}".`,
          },
        ]);
      }
    } catch (error) {
      console.error("Error setting up chat:", error);
      router.back();
    } finally {
      setInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !vocabulary) {
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const apiKey = await getOpenRouterApiKey();
      const model = await getAIModel();

      if (!apiKey) {
        console.warn("[ChatScreen] No API Key found");
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content:
              "Please set your OpenRouter API Key in Settings to chat with AI.",
          },
        ]);
        return;
      }

      // Prepare history for API (exclude IDs)
      // Use the current messages state (which now includes the user's message)
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatWithVocabulary(
        vocabulary,
        history,
        apiKey,
        model
      );

      if (response && response.content) {
        // Ensure the content is treated as a string for Markdown
        const content =
          typeof response.content === "string"
            ? response.content
            : JSON.stringify(response.content);

        const newAssistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: content,
        };

        // Update messages with the assistant's response
        setMessages((prev) => {
          const updatedMessages = [...prev, newAssistantMsg];
          // Save session
          if (vocabulary) {
            saveChatSession(vocabulary.id, updatedMessages);
          }
          return updatedMessages;
        });
      } else {
        console.warn("[ChatScreen] Response was empty or missing content");
      }
    } catch (error: any) {
      console.error("[ChatScreen] Error during send:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        accessible={true}
        accessibilityLabel={`${isUser ? "You said" : "AI said"}: ${
          item.content
        }`}
        accessibilityRole="text"
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.botBubble,
          {
            backgroundColor: isUser ? colors.primary : colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {!isUser && (
          <View style={styles.botIcon}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
          </View>
        )}
        <Text
          selectable
          style={[styles.messageText, { color: isUser ? "#fff" : colors.text }]}
        >
          {item.content}
        </Text>
      </View>
    );
  };

  const renderList = () => (
    <FlashList
      ref={flatListRef}
      data={messages}
      renderItem={renderMessage}
      estimatedItemSize={80}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.chatContent}
      onContentSizeChange={() =>
        flatListRef.current?.scrollToEnd({ animated: true })
      }
      onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
    />
  );

  const renderInput = () => (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Ask about this word..."
        placeholderTextColor={colors.icon}
        value={inputText}
        onChangeText={setInputText}
        multiline
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          {
            backgroundColor: inputText.trim() ? colors.primary : colors.border,
          },
          loading && { opacity: 0.7 },
        ]}
        onPress={handleSend}
        disabled={!inputText.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="send" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );

  if (initializing) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Chat: {vocabulary?.english}
          </Text>
          {vocabulary?.bangla && (
            <Text style={[styles.headerSubtitle, { color: colors.icon }]}>
              {vocabulary.bangla}
            </Text>
          )}
        </View>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
      >
        {renderList()}
        {renderInput()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 12,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
    maxWidth: "85%",
    flexDirection: "row",
    gap: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  botIcon: {
    marginTop: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    marginRight: 10,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});

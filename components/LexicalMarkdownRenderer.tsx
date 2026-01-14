import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Clipboard from "expo-clipboard";
import React, { useMemo } from "react";
import { Linking, StyleSheet, useWindowDimensions, View } from "react-native";
import { Markdown } from "react-native-remark";

interface LexicalMarkdownRendererProps {
  markdown: string;
}

/**
 * LexicalMarkdownRenderer
 * Renders Lexical-generated Markdown content in Expo React Native using react-native-remark.
 */
export const LexicalMarkdownRenderer = ({
  markdown,
}: LexicalMarkdownRendererProps) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { width } = useWindowDimensions();

  const processedMarkdown = useMemo(() => {
    if (!markdown) return "";

    let processed = markdown;

    // Step 1: Extract image URLs from HTML <img> tags and convert to markdown
    // Matches: <img src="url" ...> or <img data-full-url="url" ...>
    const htmlImageRegex =
      /<img[^>]+(?:src|data-full-url)=["']([^"']+)["'][^>]*>/gi;
    processed = processed.replace(htmlImageRegex, (match, url) => {
      // Use data-full-url if available, otherwise use src
      const fullUrlMatch = match.match(/data-full-url=["']([^"']+)["']/i);
      const imageUrl = fullUrlMatch ? fullUrlMatch[1] : url;
      return `![Image](${imageUrl})`;
    });

    // Step 2: Remove any remaining HTML tags (p, br, etc.)
    processed = processed.replace(/<\/?[^>]+(>|$)/g, "");

    // Step 3: Convert bare image URLs to markdown format (if not already converted)
    // Regex to find bare image URLs (ends with jpg, png, etc.) that are NOT already in markdown format
    const bareImageUrlRegex =
      /(^|\s)(https?:\/\/[^\s$.?#].[^\s]*\.(?:jpg|jpeg|gif|png|webp|bmp))(\s|$)/gi;
    processed = processed.replace(bareImageUrlRegex, (match, p1, p2, p3) => {
      return `${p1}![Image](${p2})${p3}`;
    });

    return processed.trim();
  }, [markdown]);

  const handleLinkPress = (url: string) => {
    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        }
      });
    }
  };

  const handleCodeCopy = (code: string) => {
    Clipboard.setStringAsync(code);
  };

  const customStyles = {
    container: {
      backgroundColor: "transparent",
    },
    text: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 26,
      fontFamily: "System",
    },
    h1: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "bold",
      marginVertical: 12,
    },
    h2: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "bold",
      marginVertical: 10,
    },
    h3: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      marginVertical: 8,
    },
    h4: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "bold",
      marginVertical: 6,
    },
    paragraph: {
      marginBottom: 16,
      color: colors.text,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      backgroundColor:
        colorScheme === "dark"
          ? "rgba(33, 150, 243, 0.1)"
          : "rgba(33, 150, 243, 0.05)",
      paddingHorizontal: 20,
      paddingVertical: 12,
      marginVertical: 16,
      borderRadius: 4,
    },
    inlineCode: {
      backgroundColor:
        colorScheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
      color: colorScheme === "dark" ? "#90CAF9" : colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      fontFamily: "System",
      fontSize: 14,
      fontWeight: "600",
    },
    codeBlock: {
      backgroundColor: colorScheme === "dark" ? "#1E1E1E" : "#F8F9FA",
      padding: 16,
      borderRadius: 12,
      marginVertical: 16,
      borderWidth: 1,
      borderColor: colorScheme === "dark" ? "#333333" : "#E0E0E0",
    },
    link: {
      color: colors.primary,
      textDecorationLine: "underline",
      fontWeight: "600",
    },
    listItem: {
      marginBottom: 8,
    },
    image: {
      borderRadius: 12,
      marginVertical: 16,
      width: width - 40,
      aspectRatio: 16 / 9,
    },
  };

  const customRenderers = {
    h1: ({ children }: any) => {
      const RNText = require("react-native").Text;
      return <RNText style={(customStyles as any).h1}>{children}</RNText>;
    },
    h2: ({ children }: any) => {
      const RNText = require("react-native").Text;
      return <RNText style={(customStyles as any).h2}>{children}</RNText>;
    },
    h3: ({ children }: any) => {
      const RNText = require("react-native").Text;
      return <RNText style={(customStyles as any).h3}>{children}</RNText>;
    },
    paragraph: ({ children }: any) => {
      const RNText = require("react-native").Text;
      return (
        <RNText style={(customStyles as any).paragraph}>{children}</RNText>
      );
    },
  };

  return (
    <View style={styles.content}>
      <Markdown
        markdown={processedMarkdown}
        onLinkPress={handleLinkPress}
        onCodeCopy={handleCodeCopy}
        customStyles={customStyles as any}
        customRenderers={customRenderers as any}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});

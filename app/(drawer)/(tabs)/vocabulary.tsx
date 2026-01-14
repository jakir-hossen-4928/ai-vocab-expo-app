import { AppHeader } from "@/components/AppHeader";
import { NetworkError } from "@/components/ui/NetworkError";
import { Skeleton } from "@/components/ui/Skeleton";
import { VocabularyCard } from "@/components/VocabularyCard";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSyncVocabularies, useVocabularies } from "@/hooks/useVocabulary";
import { useVocabularyShare } from "@/hooks/useVocabularyShare";
import { addToFavorites, removeFromFavorites } from "@/services/api";
import { searchOnlineDictionary } from "@/services/onlineDictionary";
import { translateTextAuto } from "@/services/translate";
import type { Vocabulary } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import * as Speech from "expo-speech";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDebounce } from "use-debounce";

import { useVocabStore } from "@/store/useVocabStore";

export default function VocabularyScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const {
    searchQuery: searchText,
    setSearchQuery: setSearchText,
    selectedFilter,
    setSelectedFilter,
    favorites,
    loadFavorites,
    toggleFavorite,
  } = useVocabStore();

  const [searchQuery] = useDebounce(searchText, 300); // 300ms is more responsive

  // TanStack Query Hooks
  const {
    data: queryData,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    refetch: localRefetch,
  } = useVocabularies(1, 100, selectedFilter, searchQuery);
  const { isFetching: isSyncing, refetch: syncRefetch } = useSyncVocabularies();
  const vocabularies = queryData?.data || [];

  const hasLocalResults = useMemo(() => {
    return searchQuery.length > 0 && vocabularies.length > 0;
  }, [vocabularies.length, searchQuery]);

  // Online Search Query
  const { data: onlineResult, isLoading: isOnlineLoading } = useQuery({
    queryKey: ["onlineVocabulary", searchQuery, selectedFilter],
    queryFn: () => searchOnlineDictionary(searchQuery),
    enabled:
      !isLoading &&
      !hasLocalResults &&
      searchQuery.length > 1 &&
      selectedFilter === "all",
    retry: false,
  });

  // Translation Fallback Query
  const { data: translationResult, isLoading: isTranslating } = useQuery({
    queryKey: ["translation", searchQuery],
    queryFn: async () => {
      const result = await translateTextAuto(searchQuery);
      return result;
    },
    enabled:
      !isLoading &&
      !hasLocalResults &&
      !isOnlineLoading &&
      !onlineResult &&
      searchQuery.length > 1 &&
      selectedFilter === "all",
    retry: false,
  });

  // Simple loading: only on initial load when cache is empty
  const showLoading =
    isLoading && vocabularies.length === 0 && !isPlaceholderData;

  const router = useRouter();

  // Only fetch favorites on focus (Local DB)
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const filters = [
    { id: "all", label: "All", icon: "apps" as const },
    { id: "noun", label: "Noun", icon: "document-text" as const },
    { id: "verb", label: "Verb", icon: "flash" as const },
    { id: "adjective", label: "Adjective", icon: "star" as const },
    { id: "adverb", label: "Adverb", icon: "time" as const },
    { id: "pronoun", label: "Pronoun", icon: "person" as const },
    { id: "preposition", label: "Preposition", icon: "git-branch" as const },
    { id: "conjunction", label: "Conjunction", icon: "git-merge" as const },
    {
      id: "interjection",
      label: "Interjection",
      icon: "chatbubble-ellipses" as const,
    },
    { id: "phrase", label: "Phrase", icon: "text" as const },
    { id: "idiom", label: "Idiom", icon: "bulb" as const },
    {
      id: "phrasal verb",
      label: "Phrasal Verb",
      icon: "flash-outline" as const,
    },
  ];

  // API handles filtering, so we just use the data
  const filteredVocabularies = vocabularies;

  // Share Hook
  const { shareVocabularyImage, ShareHiddenView } = useVocabularyShare(colors);

  // Memoized handlers
  const handleSpeak = useCallback(async (text: string) => {
    try {
      await Speech.speak(text, { language: "en" });
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleShare = useCallback(
    async (item: Vocabulary) => {
      await shareVocabularyImage(item);
    },
    [shareVocabularyImage]
  );

  const handleToggleFavorite = useCallback(
    async (item: Vocabulary) => {
      try {
        const isFav = favorites.includes(item.id);
        if (isFav) {
          await removeFromFavorites(item.id);
        } else {
          await addToFavorites(item);
        }
        toggleFavorite(item.id, isFav);
      } catch (error) {
        console.error(error);
      }
    },
    [favorites, toggleFavorite]
  );

  const handleViewDetails = useCallback(
    (item: Vocabulary) => {
      router.push(`/details/vocabulary/${item.id}` as any);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Vocabulary; index: number }) => (
      <VocabularyCard
        item={item}
        index={index}
        isFavorite={favorites.includes(item.id)}
        colors={colors}
        onPress={handleViewDetails}
        onToggleFavorite={handleToggleFavorite}
        onSpeak={handleSpeak}
        onShare={handleShare}
      />
    ),
    [
      favorites,
      colors,
      handleViewDetails,
      handleToggleFavorite,
      handleSpeak,
      handleShare,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Vocabulary"
        showSearch={true}
        searchQuery={searchText}
        onSearchChange={setSearchText}
        showAddButton={false}
      />

      <FlashList
        data={vocabularies}
        renderItem={renderItem}
        estimatedItemSize={200}
        style={{ opacity: isPlaceholderData ? 0.6 : 1 }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Filters */}
            <View style={{ marginTop: 10 }}>
              <FlashList
                horizontal
                data={filters}
                keyExtractor={(item) => item.id}
                estimatedItemSize={100}
                renderItem={({ item: filter }) => (
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor:
                          selectedFilter === filter.id
                            ? colors.primary
                            : colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setSelectedFilter(filter.id)}
                  >
                    <Ionicons
                      name={filter.icon}
                      size={16}
                      color={
                        selectedFilter === filter.id ? "#fff" : colors.icon
                      }
                    />
                    <Text
                      style={[
                        styles.filterText,
                        {
                          color:
                            selectedFilter === filter.id ? "#fff" : colors.text,
                        },
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.filtersContainer}
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Online/Translation Results */}
            <View style={styles.resultsWrapper}>
              {/* Online Result Section */}
              {searchQuery.length > 1 &&
                !hasLocalResults &&
                selectedFilter === "all" && (
                  <View style={{ marginBottom: 16 }}>
                    {isOnlineLoading ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 16,
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={{ color: colors.icon }}>
                          Searching online dictionary...
                        </Text>
                      </View>
                    ) : onlineResult ? (
                      <View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 12,
                            paddingHorizontal: 4,
                          }}
                        >
                          <Ionicons
                            name="globe-outline"
                            size={20}
                            color={colors.primary}
                            style={{ marginRight: 8 }}
                          />
                          <Text
                            style={{ color: colors.primary, fontWeight: "600" }}
                          >
                            Found Online
                          </Text>
                        </View>
                        <VocabularyCard
                          item={onlineResult}
                          index={0}
                          isOnline={true}
                          isFavorite={favorites.includes(onlineResult.id)}
                          colors={colors}
                          onSpeak={handleSpeak}
                          onShare={handleShare}
                          onToggleFavorite={handleToggleFavorite}
                          onPress={undefined}
                        />
                      </View>
                    ) : null}
                  </View>
                )}

              {/* Translation Fallback Section */}
              {searchQuery.length > 1 &&
                !hasLocalResults &&
                !onlineResult &&
                translationResult &&
                selectedFilter === "all" && (
                  <View style={{ marginBottom: 16 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: 12,
                        paddingHorizontal: 4,
                      }}
                    >
                      <Ionicons
                        name="language-outline"
                        size={20}
                        color={colors.primary}
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={{ color: colors.primary, fontWeight: "600" }}
                      >
                        Translation
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.fallbackCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View style={{ marginBottom: 12 }}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "600",
                            color: colors.text,
                            marginBottom: 4,
                          }}
                        >
                          {translationResult.originalText}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.icon }}>
                          {translationResult.sourceLanguage === "en"
                            ? "English"
                            : "বাংলা"}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Ionicons
                          name="arrow-down"
                          size={20}
                          color={colors.icon}
                        />
                      </View>
                      <View>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: colors.text,
                            marginBottom: 4,
                          }}
                        >
                          {translationResult.translatedText}
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.icon }}>
                          {translationResult.targetLanguage === "en"
                            ? "English"
                            : "বাংলা"}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

              {isError ? (
                <NetworkError colors={colors} onRetry={() => localRefetch()} />
              ) : showLoading ? (
                <View style={{ gap: 16 }}>
                  {[1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.fallbackCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <View>
                          <Skeleton
                            width={120}
                            height={24}
                            style={{ marginBottom: 4 }}
                          />
                          <Skeleton width={100} height={20} />
                        </View>
                        <Skeleton width={24} height={24} borderRadius={12} />
                      </View>
                      <Skeleton
                        width={60}
                        height={24}
                        borderRadius={12}
                        style={{ marginBottom: 8 }}
                      />
                      <Skeleton
                        width="100%"
                        height={20}
                        style={{ marginBottom: 4 }}
                      />
                      <Skeleton
                        width="80%"
                        height={20}
                        style={{ marginBottom: 12 }}
                      />
                      <View style={{ flexDirection: "row", gap: 16 }}>
                        <Skeleton width={80} height={30} />
                        <Skeleton width={80} height={30} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={(isFetching || isSyncing) && !showLoading}
            onRefresh={() => {
              localRefetch();
              syncRefetch();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !isOnlineLoading &&
          !onlineResult &&
          !isTranslating &&
          !translationResult &&
          !showLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color={colors.icon} />
              <Text style={[styles.emptyText, { color: colors.icon }]}>
                {searchText || selectedFilter !== "all"
                  ? "No vocabularies found"
                  : "No vocabularies yet"}
              </Text>
            </View>
          ) : null
        }
      />
      <ShareHiddenView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitleContainer: {
    flex: 1,
  },
  english: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  bangla: {
    fontSize: 16,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
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
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    gap: 16,
  },
  footerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  resultsWrapper: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  fallbackCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

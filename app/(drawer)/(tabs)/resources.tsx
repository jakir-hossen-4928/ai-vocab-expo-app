import { AppHeader } from "@/components/AppHeader";
import { NetworkError } from "@/components/ui/NetworkError";
import { Skeleton } from "@/components/ui/Skeleton";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useResources, useSyncResources } from "@/hooks/useResources";
import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  Image,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useDebounce } from "use-debounce";

import { getResourceColors } from "@/constants/colors";
import {
  addToBookmarks,
  getBookmarkedResources,
  removeFromBookmarks,
} from "@/services/api";
import type { Resource } from "@/types";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;

const stripHtml = (html: string) => {
  return html.replace(/<[^>]*>?/gm, "");
};

export default function ResourcesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Search States
  const [searchText, setSearchText] = useState("");
  const [searchQuery] = useDebounce(searchText, 300);

  // View State
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const router = useRouter();

  // Data Fetching with React Query
  const {
    data: resourcesData,
    isLoading: loading,
    isFetching,
    isError,
    refetch: localRefetch,
  } = useResources(1, 100, searchQuery);
  const { isFetching: isSyncing, refetch: syncRefetch } = useSyncResources();

  const resources = resourcesData?.data || [];
  const isLoading = loading && resources.length === 0;
  const error = isError ? "Failed to load" : null;

  // Load bookmarks (Local DB)
  useFocusEffect(
    useCallback(() => {
      const loadBookmarks = async () => {
        const bookmarkedResources = await getBookmarkedResources();
        setBookmarks(bookmarkedResources.map((r) => r.id));
      };
      loadBookmarks();
    }, [])
  );

  const handleToggleBookmark = async (e: any, item: any) => {
    e.stopPropagation();
    const id = item.id;
    try {
      const isCurrentlyBookmarked = bookmarks.includes(id);
      if (isCurrentlyBookmarked) {
        await removeFromBookmarks(id);
        setBookmarks((prev) => prev.filter((b) => b !== id));
      } else {
        await addToBookmarks(item);
        setBookmarks((prev) => [...prev, id]);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    }
  };

  const handleViewDetails = (id: string) => {
    router.push(`/details/resource/${id}` as any);
  };

  const handleShare = async (item: Resource) => {
    try {
      const shareUrl = `https://ai-vocabulary-coach.netlify.app/resources/${
        item.slug || item.id
      }`;
      await Share.share({
        message: `Check out this resource: ${item.title}\n\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const renderRightActions = (item: Resource) => {
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: colors.primary }]}
          onPress={() => handleShare(item)}
        >
          <Ionicons name="share-social" size={24} color="#fff" />
          <Text style={styles.swipeActionText}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.swipeAction, { backgroundColor: "#EF4444" }]}
          onPress={(e) => handleToggleBookmark(e, item)}
        >
          <Ionicons
            name={bookmarks.includes(item.id) ? "bookmark" : "bookmark-outline"}
            size={24}
            color="#fff"
          />
          <Text style={styles.swipeActionText}>
            {bookmarks.includes(item.id) ? "Remove" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderGridItem = ({ item }: { item: Resource }) => {
    const resourceColors = getResourceColors(item.id);
    const hasImage = !!(item.imageUrl || item.thumbnail);

    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[
            styles.gridCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => handleViewDetails(item.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.gridImageContainer,
              { backgroundColor: resourceColors.background },
            ]}
          >
            {hasImage ? (
              <>
                <Image
                  source={{ uri: item.imageUrl || item.thumbnail }}
                  style={styles.gridImage}
                  resizeMode="cover"
                />
                <View style={styles.titleOverlay}>
                  <Ionicons
                    name="school-outline"
                    size={48}
                    color="rgba(255,255,255,0.9)"
                    style={styles.overlayIcon}
                  />
                  <Text style={styles.overlayTitle}>{item.title}</Text>
                </View>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <Ionicons
                  name="school-outline"
                  size={64}
                  color="rgba(255,255,255,0.9)"
                  style={styles.placeholderIcon}
                />
                <Text style={styles.placeholderTitle}>{item.title}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.favoriteButton,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "rgba(0,0,0,0.6)"
                    : "rgba(255,255,255,0.9)",
              },
            ]}
            onPress={(e) => handleToggleBookmark(e, item)}
          >
            <Ionicons
              name={
                bookmarks.includes(item.id) ? "bookmark" : "bookmark-outline"
              }
              size={20}
              color={bookmarks.includes(item.id) ? colors.primary : colors.icon}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Resources"
        showSearch={true}
        searchQuery={searchText}
        onSearchChange={setSearchText}
        showMenuButton={true}
        rightAction={null}
      />

      {/* Resources List */}
      {isError ? (
        <NetworkError colors={colors} onRetry={() => localRefetch()} />
      ) : isLoading ? (
        <View style={styles.listContainer}>
          <View style={styles.gridRow}>
            {[1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.gridCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Skeleton width="100%" height={120} />
                <View style={styles.gridContent}>
                  <Skeleton
                    width="80%"
                    height={20}
                    style={{ marginBottom: 4 }}
                  />
                  <Skeleton width="60%" height={16} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlashList
          data={resources}
          renderItem={renderGridItem}
          keyExtractor={(item: Resource) => item.id}
          estimatedItemSize={250}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={(isFetching || isSyncing) && !loading}
              onRefresh={() => {
                localRefetch();
                syncRefetch();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="library-outline" size={64} color={colors.icon} />
              <Text style={[styles.emptyText, { color: colors.icon }]}>
                No resources available
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  viewModeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    padding: 16,
    paddingTop: 16,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  // Grid View Styles
  gridCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gridImageContainer: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  titleOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 16,
    paddingTop: 60,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  overlayIcon: {
    marginBottom: 8,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    lineHeight: 22,
  },
  placeholderContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  placeholderIcon: {
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 8,
  },
  swipeActionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    height: 200, // Match card height
    marginRight: 16,
  },
  swipeAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    borderRadius: 16,
  },
  swipeActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  gridContent: {
    padding: 14,
    minHeight: 50,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 20,
  },
  gridDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  // List View Styles
  listCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listImageContainer: {
    width: 100,
    height: 100,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  listImage: {
    width: "100%",
    height: "100%",
  },
  listPlaceholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    flex: 1,
    padding: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  listDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  listFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    fontSize: 12,
  },
  listFavoriteButton: {
    padding: 12,
    justifyContent: "center",
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
});

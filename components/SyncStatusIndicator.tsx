import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSyncStore } from "@/store/useSyncStore";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function SyncStatusIndicator() {
  const { isActive, vocabularyProgress, resourceProgress, isOffline } =
    useSyncStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Don't show if not syncing and online
  if (!isActive && !isOffline) {
    return null;
  }

  // Calculate overall progress
  const calculateProgress = () => {
    if (!vocabularyProgress && !resourceProgress) return 0;

    let totalItems = 0;
    let syncedItems = 0;

    if (vocabularyProgress) {
      totalItems +=
        vocabularyProgress.totalItems || vocabularyProgress.syncedItems;
      syncedItems += vocabularyProgress.syncedItems;
    }

    if (resourceProgress) {
      totalItems += resourceProgress.totalItems || resourceProgress.syncedItems;
      syncedItems += resourceProgress.syncedItems;
    }

    if (totalItems === 0) return 0;
    return Math.round((syncedItems / totalItems) * 100);
  };

  const progress = calculateProgress();

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {isOffline ? (
        <View style={styles.offlineContainer}>
          <Ionicons name="cloud-offline" size={16} color="#ef4444" />
          <Text style={[styles.offlineText, isDark && styles.offlineTextDark]}>
            Offline
          </Text>
        </View>
      ) : isActive ? (
        <View style={styles.syncingContainer}>
          <ActivityIndicator
            size="small"
            color={isDark ? "#60a5fa" : "#3b82f6"}
          />
          <Text style={[styles.syncingText, isDark && styles.syncingTextDark]}>
            Syncing {progress > 0 ? `${progress}%` : "..."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  containerDark: {
    backgroundColor: "#1f2937",
  },
  offlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
  },
  offlineTextDark: {
    color: "#f87171",
  },
  syncingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3b82f6",
  },
  syncingTextDark: {
    color: "#60a5fa",
  },
});

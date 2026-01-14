import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSyncStore } from "@/store/useSyncStore";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface SyncProgressModalProps {
  visible: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function SyncProgressModal({
  visible,
  onClose,
  showCloseButton = true,
}: SyncProgressModalProps) {
  const {
    isActive,
    vocabularyProgress,
    resourceProgress,
    lastSyncTime,
    startSync,
    cancelSync,
  } = useSyncStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const formatETA = (ms: number) => {
    if (!ms || ms <= 0) return "";
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressBarContainer}>
      <View
        style={[
          styles.progressBarFill,
          { width: `${progress}%` },
          isDark && styles.progressBarFillDark,
        ]}
      />
    </View>
  );

  const renderCollectionProgress = (
    title: string,
    progress: any,
    icon: string
  ) => {
    if (!progress) return null;

    const percentage =
      progress.totalItems > 0
        ? Math.round((progress.syncedItems / progress.totalItems) * 100)
        : 0;

    return (
      <View
        style={[styles.collectionCard, isDark && styles.collectionCardDark]}
      >
        <View style={styles.collectionHeader}>
          <View style={styles.collectionTitleRow}>
            <Ionicons
              name={icon as any}
              size={20}
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text
              style={[
                styles.collectionTitle,
                isDark && styles.collectionTitleDark,
              ]}
            >
              {title}
            </Text>
          </View>
          {progress.isComplete ? (
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          ) : (
            <ActivityIndicator
              size="small"
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
          )}
        </View>

        {renderProgressBar(percentage)}

        <View style={styles.statsRow}>
          <Text style={[styles.statsText, isDark && styles.statsTextDark]}>
            {progress.syncedItems} /{" "}
            {progress.totalItems || progress.syncedItems} items
          </Text>
          {progress.estimatedTimeRemaining && !progress.isComplete ? (
            <Text style={[styles.etaText, isDark && styles.etaTextDark]}>
              ETA: {formatETA(progress.estimatedTimeRemaining)}
            </Text>
          ) : null}
        </View>

        {progress.error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{progress.error}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View
          style={[styles.modalContainer, isDark && styles.modalContainerDark]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons
                name={isActive ? "sync" : "checkmark-circle"}
                size={24}
                color={isActive ? (isDark ? "#60a5fa" : "#3b82f6") : "#10b981"}
              />
              <Text style={[styles.title, isDark && styles.titleDark]}>
                {isActive ? "Syncing Data" : "Sync Complete"}
              </Text>
            </View>
            {showCloseButton && onClose ? (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Last Sync Info */}
            <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
              <Text style={[styles.infoLabel, isDark && styles.infoLabelDark]}>
                Last Sync
              </Text>
              <Text style={[styles.infoValue, isDark && styles.infoValueDark]}>
                {formatTime(lastSyncTime)}
              </Text>
            </View>

            {/* Progress Cards */}
            {renderCollectionProgress(
              "Vocabularies",
              vocabularyProgress,
              "book"
            )}
            {renderCollectionProgress("Resources", resourceProgress, "images")}

            {/* Actions */}
            {!isActive && (
              <TouchableOpacity
                style={[styles.syncButton, isDark && styles.syncButtonDark]}
                onPress={startSync}
              >
                <Ionicons name="sync" size={20} color="#fff" />
                <Text style={styles.syncButtonText}>Sync Now</Text>
              </TouchableOpacity>
            )}

            {isActive && (
              <TouchableOpacity
                style={[styles.cancelButton, isDark && styles.cancelButtonDark]}
                onPress={cancelSync}
              >
                <Ionicons
                  name="stop-circle"
                  size={20}
                  color={isDark ? "#f87171" : "#ef4444"}
                />
                <Text
                  style={[
                    styles.cancelButtonText,
                    isDark && styles.cancelButtonTextDark,
                  ]}
                >
                  Cancel Sync
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 500,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainerDark: {
    backgroundColor: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  titleDark: {
    color: "#f9fafb",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  infoCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 16,
  },
  infoCardDark: {
    backgroundColor: "#374151",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  infoLabelDark: {
    color: "#9ca3af",
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },
  infoValueDark: {
    color: "#f9fafb",
  },
  collectionCard: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
  },
  collectionCardDark: {
    backgroundColor: "#374151",
  },
  collectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  collectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  collectionTitleDark: {
    color: "#f9fafb",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  progressBarFillDark: {
    backgroundColor: "#60a5fa",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  statsTextDark: {
    color: "#9ca3af",
  },
  etaText: {
    fontSize: 13,
    color: "#3b82f6",
    fontWeight: "600",
  },
  etaTextDark: {
    color: "#60a5fa",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    flex: 1,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    marginTop: 8,
  },
  syncButtonDark: {
    backgroundColor: "#2563eb",
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    marginTop: 8,
  },
  cancelButtonDark: {
    backgroundColor: "#7f1d1d",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
  cancelButtonTextDark: {
    color: "#f87171",
  },
});

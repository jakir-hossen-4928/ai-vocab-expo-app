import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { router, Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { ErrorBoundary } from "@/components/ErrorBoundary";

import { SyncProgressModal } from "@/components/SyncProgressModal";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { unsubscribeFromDataChanges } from "@/services/api";
import { queryClient } from "@/services/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Prevent the splash screen from autsso-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Custom theme with blue colors
const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.notification,
  },
};

const BlueDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.notification,
  },
};

import { LoadingScreen } from "@/components/LoadingScreen";
import { useAppStore } from "@/store/useAppStore";
import { useSyncStore } from "@/store/useSyncStore";

export default function RootLayout() {
  console.log("🏗️ ROOT LAYOUT INITIALIZING...");
  const colorScheme = useColorScheme();
  const { isReady, initialize } = useAppStore();
  const { showSyncModal, updateFromOrchestrator } = useSyncStore();

  useEffect(() => {
    initialize();

    // Poll sync status every second
    const interval = setInterval(() => {
      updateFromOrchestrator();
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribeFromDataChanges();
    };
  }, []);

  // Restore navigation state once the app is ready and mounted
  useEffect(() => {
    if (!isReady) return;

    const restoreNavigation = async () => {
      try {
        const savedPath = await AsyncStorage.getItem("last_visited_path");
        console.log("Checking saved path:", savedPath);
        if (savedPath && savedPath !== "/") {
          console.log("Restoring navigation state to:", savedPath);
          setTimeout(() => {
            router.push(savedPath as any);
          }, 100);
        }
      } catch (e) {
        console.warn("Failed to restore path:", e);
      }
    };

    restoreNavigation();
  }, [isReady]);

  const pathname = usePathname();

  useEffect(() => {
    if (pathname && pathname !== "/") {
      AsyncStorage.setItem("last_visited_path", pathname).catch((e) =>
        console.warn("Failed to save path", e)
      );
    }
  }, [pathname]);

  useEffect(() => {
    // Handle notification taps with deep linking
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        // Handle new deep linking types
        if (data?.type === "review" || data?.type === "new") {
          // Navigate to flashcards with specific mode
          router.push({
            pathname: "/(drawer)/flashcards",
            params: { mode: data.mode },
          } as any);
        } else if (data?.type === "streak") {
          // Navigate to analytics dashboard
          router.push("/(drawer)/analytics");
        } else if (data?.vocabularyId) {
          // Legacy: Navigate to vocabulary details
          router.push(`/details/vocabulary/${data.vocabularyId}`);
        }
      }
    );

    // Handle cold start notifications
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;

      const data = response.notification.request.content.data;

      setTimeout(() => {
        if (data?.type === "review" || data?.type === "new") {
          router.push({
            pathname: "/(drawer)/flashcards",
            params: { mode: data.mode },
          } as any);
        } else if (data?.type === "streak") {
          router.push("/(drawer)/analytics");
        } else if (data?.vocabularyId) {
          router.push(`/details/vocabulary/${data.vocabularyId}`);
        }
      }, 500);
    });

    return () => subscription.remove();
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider
            value={colorScheme === "dark" ? BlueDarkTheme : LightTheme}
          >
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(drawer)" />
              {/* Detail Screens - These are outside drawer */}
              <Stack.Screen
                name="details/vocabulary/[id]"
                options={{
                  presentation: "card",
                  animation: "slide_from_right",
                }}
              />
              <Stack.Screen
                name="details/resource/[id]"
                options={{
                  presentation: "card",
                  animation: "slide_from_right",
                }}
              />
            </Stack>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />

            {/* Sync Progress Modal */}
            <SyncProgressModal
              visible={showSyncModal}
              showCloseButton={false}
            />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscribeToDataChanges, unsubscribeFromDataChanges } from '@/services/api';
import { initDatabase } from '@/services/offlineStorage';
import { queryClient } from '@/services/queryClient';
import { migrateSecureStoreData } from '@/services/storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

export default function RootLayout() {
  console.log('🏗️ ROOT LAYOUT INITIALIZING...');
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize offline-first SQLite database
        await initDatabase();
        // Migrate legacy favorites/bookmarks from SecureStore to SQLite
        await migrateSecureStoreData();


        // Start real-time sync listeners
        subscribeToDataChanges();

      } catch (e) {
        console.warn('Error initializing app:', e);
      } finally {
        // Tell the application to render
        setIsReady(true);
        // Hide splash screen
        await SplashScreen.hideAsync();
      }
    }

    prepare();

    return () => {
      unsubscribeFromDataChanges();
    };
  }, []);

  // Restore navigation state once the app is ready and mounted
  useEffect(() => {
    if (!isReady) return;

    const restoreNavigation = async () => {
      try {
        const savedPath = await AsyncStorage.getItem('last_visited_path');
        console.log('Checking saved path:', savedPath);
        if (savedPath && savedPath !== '/') {
          // Use push to ensure back button (if any context exists) or replace if it's a deep link restart
          // But normally, 'push' onto the initial '/' stack preserves the ability to go back home
          // unless the savedPath IS a taboo route.
          console.log('Restoring navigation state to:', savedPath);
          // We use a small timeout to ensure the root navigator is fully mounted
          // This is safer than doing it in the same tick as setIsReady(true)
          setTimeout(() => {
            router.push(savedPath as any);
          }, 100);
        }
      } catch (e) {
        console.warn('Failed to restore path:', e);
      }
    };

    restoreNavigation();
  }, [isReady]);

  const pathname = usePathname();

  useEffect(() => {
    if (pathname && pathname !== '/') {
      AsyncStorage.setItem('last_visited_path', pathname).catch(e => console.warn('Failed to save path', e));
    }
  }, [pathname]);

  useEffect(() => {
    // Handle notification taps with deep linking
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      // Handle new deep linking types
      if (data?.type === 'review' || data?.type === 'new') {
        // Navigate to flashcards with specific mode
        router.push({
          pathname: '/(drawer)/flashcards',
          params: { mode: data.mode }
        } as any);
      } else if (data?.type === 'streak') {
        // Navigate to analytics dashboard
        router.push('/(drawer)/analytics');
      } else if (data?.vocabularyId) {
        // Legacy: Navigate to vocabulary details
        router.push(`/details/vocabulary/${data.vocabularyId}`);
      }
    });

    // Handle cold start notifications
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;

      const data = response.notification.request.content.data;

      setTimeout(() => {
        if (data?.type === 'review' || data?.type === 'new') {
          router.push({
            pathname: '/(drawer)/flashcards',
            params: { mode: data.mode }
          } as any);
        } else if (data?.type === 'streak') {
          router.push('/(drawer)/analytics');
        } else if (data?.vocabularyId) {
          router.push(`/details/vocabulary/${data.vocabularyId}`);
        }
      }, 500);
    });

    return () => subscription.remove();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? BlueDarkTheme : LightTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(drawer)" />
              {/* Detail Screens - These are outside drawer */}
              <Stack.Screen
                name="details/vocabulary/[id]"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="details/resource/[id]"
                options={{
                  presentation: 'card',
                  animation: 'slide_from_right',
                }}
              />
            </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getCachedVocabularies, getDueCardsCount, getNewVocabCount } from "./offlineStorage";

// 1. Configure Notification Handler (MANDATORY)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Notification Settings Interface
export interface NotificationSettings {
    enabled: boolean;
    dailyReminderTime: { hour: number; minute: number };
    vocabularyNotifications: boolean;
    quizNotifications: boolean;
    notificationFrequency: 'daily' | 'twice' | 'thrice';
}

// Helper: Get random vocabularies from SQL
async function getRandomVocabularies(count: number = 1) {
    try {
        const cached = await getCachedVocabularies();
        const vocabularies = cached.data;

        if (vocabularies.length === 0) return [];

        // Shuffle and return requested count
        const shuffled = vocabularies.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    } catch (error) {
        console.error('Error fetching vocabularies for notifications:', error);
        return [];
    }
}

// 2. Ask Permission Properly
export async function requestNotificationPermission() {
    if (!Device.isDevice) {
        console.warn("Must use a physical device for Push Notifications");
        return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") {
        return false;
    }

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
        });

        // Create a channel for vocabulary notifications
        await Notifications.setNotificationChannelAsync("vocabulary", {
            name: "Vocabulary Reminders",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#4CAF50",
        });
    }

    return true;
}

// 3. Get Random Vocabulary from Storage
async function getRandomVocabulary() {
    try {
        const vocabularies = await getRandomVocabularies(1);
        if (vocabularies.length === 0) return null;
        return vocabularies[0];
    } catch (error) {
        console.error('Error getting random vocabulary:', error);
        return null;
    }
}

// 4. Send Instant Notification (Test)
export async function sendInstantNotification() {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "Time to study 📘",
            body: "Learn 5 new vocabulary words now",
        },
        trigger: null, // immediate
    });
}

// 5. Send Vocabulary Notification
export async function sendVocabularyNotification() {
    const vocab = await getRandomVocabulary();

    if (!vocab) {
        // Fallback if no vocabularies in storage
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Add Favorites! ⭐",
                body: "Add some vocabulary words to your favorites to get personalized notifications",
            },
            trigger: null,
        });
        return;
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title: `📚 ${vocab.english || 'New Word'}`,
            body: vocab.bangla || 'Tap to learn more',
            data: { vocabularyId: vocab.id, type: 'vocabulary' },
        },
        trigger: null,
    });
}

// 6. Send Quiz-Style Notification
export async function sendQuizNotification() {
    const vocab = await getRandomVocabulary();

    if (!vocab) {
        await sendVocabularyNotification();
        return;
    }

    const quizTypes = [
        {
            title: "🎯 Quick Quiz!",
            body: `What does "${vocab.english}" mean in Bangla?`,
        },
        {
            title: "🧠 Test Your Memory",
            body: `Can you recall the meaning of "${vocab.english}"?`,
        },
        {
            title: "💡 Word Challenge",
            body: `Do you remember: ${vocab.english}?`,
        }
    ];

    const randomQuiz = quizTypes[Math.floor(Math.random() * quizTypes.length)];

    await Notifications.scheduleNotificationAsync({
        content: {
            title: randomQuiz.title,
            body: randomQuiz.body,
            data: { vocabularyId: vocab.id, type: 'quiz', answer: vocab.bangla },
        },
        trigger: null,
    });
}

// 7. Schedule Daily Reminder with Vocabulary
export async function scheduleDailyReminder(hour: number, minute: number, settings?: NotificationSettings) {
    // Cancel existing to avoid duplicates
    await cancelAllNotifications();

    const vocab = await getRandomVocabulary();

    const notificationContent = vocab ? {
        title: "Daily Vocabulary 📚",
        body: `${vocab.english} - ${vocab.bangla}`,
        data: { vocabularyId: vocab.id, type: 'daily' },
    } : {
        title: "Daily Vocabulary 📚",
        body: "Consistency beats motivation. Open the app to keep your streak! 🔥",
    };

    await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
        },
    });

    // Schedule additional notifications based on frequency
    if (settings?.notificationFrequency === 'twice') {
        const secondHour = (hour + 8) % 24;
        await scheduleVocabularyReminder(secondHour, minute);
    } else if (settings?.notificationFrequency === 'thrice') {
        const secondHour = (hour + 6) % 24;
        const thirdHour = (hour + 12) % 24;
        await scheduleVocabularyReminder(secondHour, minute);
        await scheduleVocabularyReminder(thirdHour, minute);
    }
}

// 8. Schedule Vocabulary Reminder at Specific Time
async function scheduleVocabularyReminder(hour: number, minute: number) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: "Vocabulary Time! 📖",
            body: "Ready to learn something new?",
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
        },
    });
}

// 9. Schedule Word of the Day
export async function scheduleWordOfTheDay(hour: number = 9, minute: number = 0) {
    const vocab = await getRandomVocabulary();

    if (!vocab) return;

    await Notifications.scheduleNotificationAsync({
        content: {
            title: "🌟 Word of the Day",
            body: `${vocab.english} - ${vocab.bangla}`,
            data: { vocabularyId: vocab.id, type: 'word_of_day' },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            hour,
            minute,
            repeats: true,
        },
    });
}

// 10. Schedule Hourly Notifications (7 AM to 10 PM)
export async function scheduleHourlyNotifications() {
    await cancelAllNotifications();

    // Get enough random vocabularies for the hours 7 to 22 (16 hours)
    const vocabularies = await getRandomVocabularies(16);
    let vocabIndex = 0;

    // Loop from 7 to 22 (10 PM)
    for (let hour = 7; hour <= 22; hour++) {
        let title = "Time to Learn! ⏰";
        let body = "Open the app to learn a new word.";
        let data: any = { type: 'hourly' };

        // Use a unique vocabulary for each hour if available
        if (vocabularies.length > 0) {
            const vocab = vocabularies[vocabIndex % vocabularies.length];
            title = `📚 ${vocab.english}`;
            body = vocab.bangla ? `${vocab.bangla} - Tap to see details` : 'Tap to see details';
            data = { vocabularyId: vocab.id, type: 'vocabulary' };
            vocabIndex++;
        }

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: true,
                    ...(Platform.OS === 'android' ? { channelId: 'vocabulary' } : {}),
                },
                trigger: {
                    hour: hour,
                    minute: 0,
                    repeats: true,
                },
            });
        } catch (error) {
            console.warn(`Failed to schedule notification for ${hour}:00`, error);
        }
    }
}

// 11. Get Scheduled Notifications Count
export async function getScheduledNotificationsCount(): Promise<number> {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications.length;
}

// 12. Cancel Notifications
export async function cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// ===== NEW: SQL-BASED NOTIFICATIONS WITH DEEP LINKING =====

// 13. Schedule Daily Review Reminder (SQL-based)
export async function scheduleDailyReviewReminder(hour: number = 9, minute: number = 0) {
    try {
        const dueCount = await getDueCardsCount();

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "📚 Time to Review!",
                body: dueCount > 0
                    ? `You have ${dueCount} flashcards due for review today`
                    : "Keep your streak alive! Review your flashcards",
                data: {
                    type: 'review',
                    screen: 'flashcards',
                    mode: 'review'
                },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                hour,
                minute,
                repeats: true,
            },
        });

        console.log(`✅ Daily review reminder scheduled for ${hour}:${minute}`);
    } catch (error) {
        console.error('Error scheduling daily review reminder:', error);
    }
}

// 14. Schedule New Vocabulary Notification
export async function scheduleNewVocabNotification() {
    try {
        const newCount = await getNewVocabCount();

        if (newCount === 0) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "✨ New Vocabulary Available!",
                body: `${newCount} new words are waiting for you to learn`,
                data: {
                    type: 'new',
                    screen: 'flashcards',
                    mode: 'new'
                },
            },
            trigger: null, // Send immediately
        });

        console.log(`✅ New vocabulary notification sent (${newCount} words)`);
    } catch (error) {
        console.error('Error sending new vocab notification:', error);
    }
}

// 15. Schedule Study Streak Milestone Notification
export async function scheduleStreakMilestoneNotification(streak: number) {
    try {
        const milestones = [3, 7, 14, 30, 60, 100];

        if (!milestones.includes(streak)) return;

        const messages = {
            3: "🔥 3-day streak! You're building a great habit!",
            7: "🎉 One week streak! Keep up the amazing work!",
            14: "⭐ 2-week streak! You're on fire!",
            30: "🏆 30-day streak! Incredible dedication!",
            60: "💎 2-month streak! You're a vocabulary master!",
            100: "👑 100-day streak! Legendary achievement!"
        };

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "🎊 Milestone Achieved!",
                body: messages[streak as keyof typeof messages],
                data: {
                    type: 'streak',
                    screen: 'analytics',
                    streak
                },
            },
            trigger: null, // Send immediately
        });

        console.log(`✅ Streak milestone notification sent (${streak} days)`);
    } catch (error) {
        console.error('Error sending streak milestone notification:', error);
    }
}

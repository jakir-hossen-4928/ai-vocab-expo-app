import { AppHeader } from '@/components/AppHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    cancelAllNotifications,
    getScheduledNotificationsCount,
    requestNotificationPermission,
    scheduleHourlyNotifications,
    sendInstantNotification,
    sendQuizNotification,
    sendVocabularyNotification
} from '@/services/notifications';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function NotificationScreen() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [scheduledCount, setScheduledCount] = useState(0);

    useEffect(() => {
        loadScheduledCount();
    }, [notificationsEnabled]);

    const loadScheduledCount = async () => {
        const count = await getScheduledNotificationsCount();
        setScheduledCount(count);
    };

    const toggleSwitch = async () => {
        const newValue = !notificationsEnabled;
        setNotificationsEnabled(newValue);

        if (newValue) {
            const result = await requestNotificationPermission();
            if (result) {
                // permission granted - Schedule Hourly
                await scheduleHourlyNotifications();
                await loadScheduledCount();
            } else {
                setNotificationsEnabled(false);
                Alert.alert("Permission Denied", "Enable notifications in settings.");
            }
        } else {
            await cancelAllNotifications();
            await loadScheduledCount();
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <AppHeader title="Notifications" showMenuButton={true} />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.title, { color: colors.text }]}>Hourly Reminders</Text>
                            <Text style={[styles.subtitle, { color: colors.icon }]}>
                                Get vocabulary updates every hour from 7 AM to 10 PM.
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#767577", true: colors.primary }}
                            thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
                            onValueChange={toggleSwitch}
                            value={notificationsEnabled}
                        />
                    </View>
                </View>

                {scheduledCount > 0 && (
                    <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.infoText, { color: colors.text }]}>
                            📅 {scheduledCount} notifications scheduled
                        </Text>
                    </View>
                )}

                <Text style={[styles.sectionTitle, { color: colors.text }]}>Test Notifications</Text>

                <TouchableOpacity
                    style={[styles.testButton, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                        await sendInstantNotification();
                    }}
                >
                    <Text style={styles.testButtonText}>📘 Send Test Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.testButton, { backgroundColor: '#4CAF50', marginTop: 12 }]}
                    onPress={async () => {
                        await sendVocabularyNotification();
                        await loadScheduledCount();
                    }}
                >
                    <Text style={styles.testButtonText}>📚 Send Vocabulary Notification</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.testButton, { backgroundColor: '#FF9800', marginTop: 12 }]}
                    onPress={async () => {
                        await sendQuizNotification();
                        await loadScheduledCount();
                    }}
                >
                    <Text style={styles.testButtonText}>🎯 Send Quiz Notification</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20 },
    card: {
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    subtitle: { fontSize: 14 },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingTop: 20,
    },
    label: { fontSize: 16, fontWeight: '600' },
    timeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    timeText: { fontSize: 18, fontWeight: 'bold' },
    infoCard: {
        marginTop: 16,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    infoText: {
        fontSize: 14,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 24,
        marginBottom: 8,
    },
    testButton: {
        marginTop: 20,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    testButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

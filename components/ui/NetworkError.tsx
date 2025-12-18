import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NetworkErrorProps {
    onRetry?: () => void;
    message?: string;
    colors: {
        background: string;
        text: string;
        icon: string;
        primary: string;
        surface: string;
    };
}

export function NetworkError({ onRetry, message, colors }: NetworkErrorProps) {
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}>
                <Ionicons name="cloud-offline-outline" size={64} color={colors.icon} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
                Connection Error
            </Text>
            <Text style={[styles.message, { color: colors.icon }]}>
                {message || 'Unable to connect to the server. Please check your internet connection and try again.'}
            </Text>
            <View style={styles.tipContainer}>
                <Text style={[styles.tipTitle, { color: colors.text }]}>
                    💡 Quick Fix:
                </Text>
                <Text style={[styles.tipText, { color: colors.icon }]}>
                    • Make sure the backend server is running
                </Text>
                <Text style={[styles.tipText, { color: colors.icon }]}>
                    • Check your device's internet connection
                </Text>
                <Text style={[styles.tipText, { color: colors.icon }]}>
                    • For physical devices, update .env with your computer's IP
                </Text>
            </View>
            {onRetry && (
                <TouchableOpacity
                    style={[styles.retryButton, { backgroundColor: colors.primary }]}
                    onPress={onRetry}
                >
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    tipContainer: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    tipTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
    },
    tipText: {
        fontSize: 14,
        lineHeight: 22,
        marginLeft: 8,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

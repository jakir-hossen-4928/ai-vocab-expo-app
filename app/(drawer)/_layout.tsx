import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';
import * as SafeAreaContext from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

function CustomDrawerContent(props: any) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];
    const insets = SafeAreaContext.useSafeAreaInsets();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Enhanced Header with Gradient-like Effect */}
            <View style={[styles.header, {
                backgroundColor: colors.primary,
                paddingTop: insets.top + 20,
            }]}>
                <View style={styles.headerContent}>
                    <Image
                        source={require('../../assets/images/icon.png')}
                        style={styles.appIcon}
                    />
                    <View style={styles.headerText}>
                        <Text style={styles.appName}>AI Vocab</Text>
                        <Text style={styles.appTagline}>Master English Vocabulary</Text>
                    </View>
                </View>
            </View>

            {/* Menu Items */}
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.menuSection}>

                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>


        </View>
    );
}

export default function DrawerLayout() {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    return (
        <Drawer
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveTintColor: '#fff',
                drawerInactiveTintColor: colors.text,
                drawerActiveBackgroundColor: colors.primary,
                drawerType: 'slide',
                overlayColor: 'rgba(0,0,0,0.5)',
                drawerStyle: {
                    backgroundColor: colors.background,
                    width: Math.min(width * 0.85, 320),
                },
                drawerLabelStyle: {
                    marginLeft: 8,
                    fontSize: 15,
                    fontWeight: '600',
                },
                drawerItemStyle: {
                    borderRadius: 12,
                    marginHorizontal: 12,
                    marginVertical: 3,
                    paddingVertical: 4,
                    paddingLeft: 12,
                }
            }}
        >
            {/* Main Screens */}
            <Drawer.Screen
                name="(tabs)"
                options={{
                    drawerLabel: 'Home',
                    drawerIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? "home" : "home-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="flashcards"
                options={{
                    drawerLabel: 'Smart Flashcards',
                    drawerIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "cards" : "cards-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="analytics"
                options={{
                    drawerLabel: 'Learning Analytics',
                    drawerIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? "stats-chart" : "stats-chart-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            {/* Hidden from drawer - accessible via tabs only */}
            <Drawer.Screen
                name="dictionary"
                options={{
                    drawerItemStyle: { display: 'none' }
                }}
            />


            {/* IELTS Section */}
            <Drawer.Screen
                name="ielts-practice"
                options={{
                    drawerLabel: 'IELTS Practice',
                    drawerIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name={focused ? "pencil-box" : "pencil-box-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="ielts-vocabulary"
                options={{
                    drawerLabel: 'IELTS Vocabulary',
                    drawerIcon: ({ color, focused }) => (
                        <MaterialCommunityIcons
                            name="book-alphabet"
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            {/* Settings & Info */}
            <Drawer.Screen
                name="notification"
                options={{
                    drawerLabel: 'Notifications',
                    drawerIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? "notifications" : "notifications-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />

            <Drawer.Screen
                name="settings"
                options={{
                    drawerLabel: 'Settings',
                    drawerIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? "settings" : "settings-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="about"
                options={{
                    drawerLabel: 'About AI Vocab',
                    drawerIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? "information-circle" : "information-circle-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="help"
                options={{
                    drawerLabel: 'Help & Support',
                    drawerIcon: ({ color, focused }) => (
                        <Ionicons
                            name={focused ? "help-circle" : "help-circle-outline"}
                            size={24}
                            color={color}
                        />
                    ),
                }}
            />
        </Drawer>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    appIcon: {
        width: 52,
        height: 52,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    headerText: {
        flex: 1,
    },
    appName: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    appTagline: {
        fontSize: 13,
        marginTop: 2,
        color: 'rgba(255,255,255,0.85)',
        fontWeight: '500',
    },
    scrollContent: {
        paddingTop: 8,
        paddingBottom: 8,
    },
    menuSection: {
        marginTop: 8,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
        marginLeft: 24,
        marginBottom: 8,
        marginTop: 8,
    },
});

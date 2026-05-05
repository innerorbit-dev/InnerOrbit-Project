import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Pressable, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { select, isWeb, isAndroid, isIOS } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Notifications from 'expo-notifications'; // Removed top-level import
import { requestNotificationPermissions } from '../../lib/notification-service';
import { Logger } from '../../lib/logger';

// Lazy load Notifications for native platforms
let Notifications;
if (!isWeb) {
    try {
        Notifications = require('expo-notifications');
    } catch (e) {
        Logger.warn('expo-notifications not available', e);
    }
}

/**
 * Comprehensive Notification Settings Component
 * Compatible with:
 * - Android 5.0+ (API 21+) through Android 16
 * - iOS 10+
 * - Web browsers
 * - Windows Desktop (.exe via Electron)
 * Matches social media app notification controls
 */

// Detect platform
const isElectron = isWeb &&
    typeof window !== 'undefined' &&
    window.electron?.isElectron;

const isWindows = isWeb &&
    typeof navigator !== 'undefined' &&
    navigator.platform.toLowerCase().includes('win');

export function NotificationSettings({ theme, isInline }) {
    return null; // Advanced notification system is currently disabled for security optimization.

    // Notification Preferences
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [messageNotifications, setMessageNotifications] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [showPreview, setShowPreview] = useState(true);
    const [inAppNotifications, setInAppNotifications] = useState(true);
    const [notificationLight, setNotificationLight] = useState(true);

    // Privacy Settings
    const [muteAllNotifications, setMuteAllNotifications] = useState(false);
    const [doNotDisturb, setDoNotDisturb] = useState(false);

    // Specific Contact Settings
    const [allowFromContacts, setAllowFromContacts] = useState(true);
    const [allowFromUnknown, setAllowFromUnknown] = useState(true);

    // Load saved preferences
    useEffect(() => {
        loadNotificationPreferences();
    }, []);

    const loadNotificationPreferences = async () => {
        try {
            const prefs = await AsyncStorage.getItem('notificationPreferences');
            if (prefs) {
                const parsed = JSON.parse(prefs);
                setNotificationsEnabled(parsed.notificationsEnabled ?? true);
                setMessageNotifications(parsed.messageNotifications ?? true);
                setSoundEnabled(parsed.soundEnabled ?? true);
                setVibrationEnabled(parsed.vibrationEnabled ?? true);
                setShowPreview(parsed.showPreview ?? true);
                setInAppNotifications(parsed.inAppNotifications ?? true);
                setNotificationLight(parsed.notificationLight ?? true);
                setMuteAllNotifications(parsed.muteAllNotifications ?? false);
                setDoNotDisturb(parsed.doNotDisturb ?? false);
                setAllowFromContacts(parsed.allowFromContacts ?? true);
                setAllowFromUnknown(parsed.allowFromUnknown ?? true);
            }
        } catch (error) {
            Logger.log('Error loading notification preferences:', error);
        }
    };

    const saveNotificationPreferences = async (newPrefs) => {
        try {
            await AsyncStorage.setItem('notificationPreferences', JSON.stringify(newPrefs));

            // Update notification handler based on preferences
            if (Notifications) {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowBanner: newPrefs.notificationsEnabled && newPrefs.inAppNotifications,
                        shouldShowList: newPrefs.notificationsEnabled && newPrefs.inAppNotifications,
                        shouldPlaySound: newPrefs.soundEnabled && !newPrefs.muteAllNotifications,
                        shouldSetBadge: newPrefs.notificationsEnabled,
                    }),
                });
            }
        } catch (error) {
            Logger.log('Error saving notification preferences:', error);
        }
    };

    const handleToggle = async (key, value, setter) => {
        if (key === 'notificationsEnabled' && value === true) {
            const granted = await requestNotificationPermissions();
            if (!granted) {
                if (isWeb) {
                    alert('Notifications not allowed. Enable them in your browser settings.');
                } else {
                    Alert.alert('Permission Denied', 'Please enable notifications in your system settings.');
                }
                setter(false);
                return;
            }
        }

        setter(value);
        const newPrefs = {
            notificationsEnabled,
            messageNotifications,
            soundEnabled,
            vibrationEnabled,
            showPreview,
            inAppNotifications,
            notificationLight,
            muteAllNotifications,
            doNotDisturb,
            allowFromContacts,
            allowFromUnknown,
            [key]: value,
        };
        saveNotificationPreferences(newPrefs);
    };

    const openSystemSettings = async () => {
        if (isElectron) {
            // Windows desktop - show instructions for Windows notification settings
            alert('To configure Windows notification settings:\n\n1. Open Windows Settings\n2. Go to System > Notifications\n3. Find CalcX in the app list\n4. Configure your preferences');
        } else if (isAndroid) {
            await Linking.openSettings();
        } else if (isIOS) {
            await Linking.openURL('app-settings:');
        } else if (isWeb) {
            // Web browser - show browser notification settings info
            alert('To configure browser notifications:\n\n1. Click the lock icon in your address bar\n2. Select "Site settings"\n3. Adjust notification permissions');
        }
    };

    const SettingRow = ({ icon, title, description, value, onValueChange, disabled }) => (
        <View style={[styles.settingRow, disabled && styles.settingRowDisabled, isInline && { paddingHorizontal: 12, paddingVertical: 6 }]}>
            <View style={[styles.settingIcon, isInline && { width: 28, height: 28, borderRadius: 14, marginRight: 8 }]}>
                <Feather name={icon} size={isInline ? 14 : 20} color={disabled ? theme.textSecondary : theme.primary} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: theme.text }, disabled && styles.disabledText, isInline && { fontSize: 13, marginBottom: 0 }]}>
                    {title}
                </Text>
                {description && (
                    <Text style={[styles.settingDescription, { color: theme.textSecondary }, isInline && { fontSize: 11, lineHeight: 14 }]}>
                        {description}
                    </Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={value ? '#fff' : '#f4f3f4'}
                ios_backgroundColor={theme.border}
                style={isInline ? { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] } : {}}
            />
        </View>
    );

    const SectionHeader = ({ title, icon }) => (
        <View style={[styles.sectionHeader, isInline && { paddingHorizontal: 12, paddingVertical: 4, marginBottom: 2 }]}>
            <Feather name={icon} size={isInline ? 14 : 18} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.text }, isInline && { fontSize: 13 }]}>{title}</Text>
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: isInline ? 'transparent' : theme.background }]}>
            {/* Master Control */}
            <View style={[styles.section, isInline && { marginBottom: 8 }]}>
                <SectionHeader title="Notification Control" icon="bell" />

                <SettingRow
                    icon="bell"
                    title="Enable Notifications"
                    description="Master switch for all notifications"
                    value={notificationsEnabled}
                    onValueChange={(val) => handleToggle('notificationsEnabled', val, setNotificationsEnabled)}
                />

                <SettingRow
                    icon="bell-off"
                    title="Mute All Notifications"
                    description="Temporarily silence all notifications"
                    value={muteAllNotifications}
                    onValueChange={(val) => handleToggle('muteAllNotifications', val, setMuteAllNotifications)}
                    disabled={!notificationsEnabled}
                />
            </View>

            {/* Message Notifications */}
            <View style={[styles.section, isInline && { marginBottom: 12 }]}>
                <SectionHeader title="Message Notifications" icon="message-circle" />

                <SettingRow
                    icon="message-square"
                    title="New Messages"
                    description="Get notified when you receive new messages"
                    value={messageNotifications}
                    onValueChange={(val) => handleToggle('messageNotifications', val, setMessageNotifications)}
                    disabled={!notificationsEnabled || muteAllNotifications}
                />

                <SettingRow
                    icon="eye"
                    title="Show Message Preview"
                    description="Display message content in notifications"
                    value={showPreview}
                    onValueChange={(val) => handleToggle('showPreview', val, setShowPreview)}
                    disabled={!notificationsEnabled || !messageNotifications}
                />
            </View>

            {/* Sound & Vibration */}
            <View style={[styles.section, isInline && { marginBottom: 8 }]}>
                <SectionHeader title="Sound & Alerts" icon="volume-2" />

                <SettingRow
                    icon="volume-2"
                    title="Notification Sound"
                    description="Play sound for new notifications"
                    value={soundEnabled}
                    onValueChange={(val) => handleToggle('soundEnabled', val, setSoundEnabled)}
                    disabled={!notificationsEnabled || muteAllNotifications}
                />

                <SettingRow
                    icon="smartphone"
                    title="Vibration"
                    description="Vibrate on new notifications"
                    value={vibrationEnabled}
                    onValueChange={(val) => handleToggle('vibrationEnabled', val, setVibrationEnabled)}
                    disabled={!notificationsEnabled || muteAllNotifications}
                />

                {isAndroid && (
                    <SettingRow
                        icon="sun"
                        title="Notification Light"
                        description="LED indicator for notifications (if supported)"
                        value={notificationLight}
                        onValueChange={(val) => handleToggle('notificationLight', val, setNotificationLight)}
                        disabled={!notificationsEnabled}
                    />
                )}
            </View>

            {/* In-App Notifications */}
            <View style={[styles.section, isInline && { marginBottom: 12 }]}>
                <SectionHeader title="In-App Alerts" icon="monitor" />

                <SettingRow
                    icon="monitor"
                    title="In-App Notifications"
                    description="Show notifications while using the app"
                    value={inAppNotifications}
                    onValueChange={(val) => handleToggle('inAppNotifications', val, setInAppNotifications)}
                    disabled={!notificationsEnabled}
                />
            </View>

            {/* Privacy Controls */}
            <View style={[styles.section, isInline && { marginBottom: 12 }]}>
                <SectionHeader title="Privacy & Filtering" icon="shield" />

                <SettingRow
                    icon="users"
                    title="Notifications from Contacts"
                    description="Allow notifications from saved contacts"
                    value={allowFromContacts}
                    onValueChange={(val) => handleToggle('allowFromContacts', val, setAllowFromContacts)}
                    disabled={!notificationsEnabled}
                />

                <SettingRow
                    icon="user-x"
                    title="Notifications from Unknown"
                    description="Allow notifications from users not in contacts"
                    value={allowFromUnknown}
                    onValueChange={(val) => handleToggle('allowFromUnknown', val, setAllowFromUnknown)}
                    disabled={!notificationsEnabled}
                />

                <SettingRow
                    icon="moon"
                    title="Do Not Disturb Mode"
                    description="Silence notifications during specific hours"
                    value={doNotDisturb}
                    onValueChange={(val) => handleToggle('doNotDisturb', val, setDoNotDisturb)}
                    disabled={!notificationsEnabled}
                />
            </View>

            {/* System Settings Link */}
            <View style={[styles.section, isInline && { marginBottom: 8 }]}>
                <Pressable
                    style={[styles.systemSettingsButton, { backgroundColor: theme.surface }, isInline && { padding: 10, marginHorizontal: 12 }]}
                    onPress={openSystemSettings}
                >
                    <Feather name="settings" size={18} color={theme.primary} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { color: theme.text }, isInline && { fontSize: 13 }]}>
                            Advanced System Settings
                        </Text>
                        <Text style={[styles.settingDescription, { color: theme.textSecondary }, isInline && { fontSize: 11 }]}>
                            Configure notification channels, priority, and more
                        </Text>
                    </View>
                    <Feather name="external-link" size={16} color={theme.textSecondary} />
                </Pressable>
            </View>

            {/* Info Footer */}
            <View style={[styles.infoFooter, isInline && { padding: 12, marginBottom: 20 }]}>
                <Feather name="info" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    Notification settings are saved locally and apply across all your conversations.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    settingRowDisabled: {
        opacity: 0.5,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(251, 113, 133, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
        lineHeight: 18,
    },
    disabledText: {
        opacity: 0.5,
    },
    systemSettingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 20,
        borderRadius: 12,
        borderWidth: 0,
        borderColor: 'transparent',
    },
    infoFooter: {
        flexDirection: 'row',
        padding: 20,
        marginTop: 8,
        marginBottom: 40,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
    },
});



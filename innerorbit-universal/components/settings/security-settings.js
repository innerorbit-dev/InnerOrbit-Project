import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { isIOS, isAndroid } from '../../utils/platform';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import SecureStorage from '../../lib/secure-storage-service';
import { auth } from '../../lib/firebase';
import { updatePassword, updateEmail } from 'firebase/auth';

/**
 * Security Settings Component
 * Manages login persistence, biometrics, and security preferences
 */
export function SecuritySettings({ theme }) {
    // Login Persistence State
    const [loginPersistenceEnabled, setLoginPersistenceEnabled] = useState(false);
    const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
    const [manualLoginCount, setManualLoginCount] = useState(0);
    const [declineCount, setDeclineCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [keyBackupEnabled, setKeyBackupEnabled] = useState(true);
    const [autoRecoveryEnabled, setAutoRecoveryEnabled] = useState(true);
    const [backgroundSyncEnabled, setBackgroundSyncEnabled] = useState(true);

    // Load current settings
    useEffect(() => {
        loadSecuritySettings();
    }, []);

    const loadSecuritySettings = async () => {
        try {
            setLoading(true);

            // Check if persistence is enabled
            const isEnabled = await SecureStorage.isPersistenceEnabled();
            setLoginPersistenceEnabled(!!isEnabled);

            // Check if credentials are stored
            const { email, password, userId } = await SecureStorage.getCredentials();
            setHasStoredCredentials(!!(email || password || userId));

            // Get tracking stats
            const loginCount = await SecureStorage.getManualLoginCount();
            const declines = await SecureStorage.getDeclineCount();
            setManualLoginCount(loginCount);
            setDeclineCount(declines);

            // Check if key backup is enabled in Firestore
            const { getUserProfile } = await import('../../lib/firestore-service');
            const profile = await getUserProfile(auth.currentUser.uid);
            // Default to TRUE unless explicitly set to false
            setKeyBackupEnabled(profile?.settings?.keyBackupEnabled !== false);
            setAutoRecoveryEnabled(profile?.settings?.autoRecoveryEnabled !== false);
            setBackgroundSyncEnabled(profile?.settings?.backgroundSyncEnabled !== false);
        } catch (error) {
            console.error('Error loading security settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePersistence = async (value) => {
        try {
            if (value) {
                // Enabling persistence
                Alert.alert(
                    'Enable Login Persistence?',
                    `This will securely save your login credentials using ${isIOS ? 'iOS Keychain' : isAndroid ? 'Android Keystore' : 'secure storage'}.\n\nYou can disable this anytime.`,
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                        },
                        {
                            text: 'Enable',
                            onPress: async () => {
                                await SecureStorage.setPersistenceEnabled(true);
                                setLoginPersistenceEnabled(true);
                                await loadSecuritySettings();
                            },
                        },
                    ]
                );
            } else {
                // Disabling persistence
                Alert.alert(
                    'Disable Login Persistence?',
                    'This will delete all saved login credentials from secure storage. You\'ll need to log in manually next time.',
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                        },
                        {
                            text: 'Disable & Clear',
                            style: 'destructive',
                            onPress: async () => {
                                await SecureStorage.setPersistenceEnabled(false);
                                await SecureStorage.clearAllCredentials();
                                setLoginPersistenceEnabled(false);
                                setHasStoredCredentials(false);
                                await loadSecuritySettings();
                            },
                        },
                    ]
                );
            }
        } catch (error) {
            console.error('Error toggling persistence:', error);
            Alert.alert('Error', 'Failed to update login persistence setting.');
        }
    };

    const handleClearCredentials = () => {
        Alert.alert(
            'Clear Saved Credentials?',
            'This will delete your saved login credentials but keep persistence enabled. You\'ll be asked to save credentials again on your next login.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        await SecureStorage.clearAllCredentials();
                        setHasStoredCredentials(false);
                        await loadSecuritySettings();
                    },
                },
            ]
        );
    };

    const handleSetPassword = async () => {
        const user = auth.currentUser;
        if (!user) return;

        // Detection: Check if Google is prime provider
        const isGoogleUser = user.providerData.some(p => p.providerId === 'google.com');

        Alert.prompt(
            'Set Account Password',
            isGoogleUser
                ? 'Create a password to allow manual email login (independent of Google).'
                : 'Enter a new password for your account.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Update',
                    onPress: async (newPassword) => {
                        if (!newPassword || newPassword.length < 6) {
                            Alert.alert('Error', 'Password must be at least 6 characters.');
                            return;
                        }

                        try {
                            setLoading(true);
                            await updatePassword(user, newPassword);
                            Alert.alert('Success', 'Your account password has been set.');
                        } catch (error) {
                            console.error('Password Update Error:', error);
                            if (error.code === 'auth/requires-recent-login') {
                                Alert.alert(
                                    'Action Required',
                                    'For security, please sign out and sign back in before changing your password.',
                                    [{ text: 'OK' }]
                                );
                            } else {
                                Alert.alert('Error', 'Failed to update password. Try again later.');
                            }
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ],
            'secure-text'
        );
    };

    const handleToggleKeyBackup = async (value) => {
        try {
            setLoading(true);
            const { updateUserProfile } = await import('../../lib/firestore-service');
            await updateUserProfile(auth.currentUser.uid, {
                'settings.keyBackupEnabled': value
            });
            setKeyBackupEnabled(value);
            
            if (value) {
                Alert.alert(
                    'Recovery Enabled',
                    'Your message keys will now be backed up using your PIN. If you log in on another device, you can restore your chat history using your InnerOrbit PIN.'
                );
            }
        } catch (error) {
            console.error('Error toggling key backup:', error);
            Alert.alert('Error', 'Failed to update recovery setting.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAutoRecovery = async (value) => {
        try {
            setLoading(true);
            const { updateUserProfile } = await import('../../lib/firestore-service');
            await updateUserProfile(auth.currentUser.uid, {
                'settings.autoRecoveryEnabled': value
            });
            setAutoRecoveryEnabled(value);
            
            if (!value) {
                Alert.alert(
                    'Manual PIN Required',
                    'You will now be prompted to enter your PIN manually whenever restoring your chat history on a new device.'
                );
            }
        } catch (error) {
            console.error('Error toggling auto recovery:', error);
            Alert.alert('Error', 'Failed to update auto recovery setting.');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleBackgroundSync = async (value) => {
        try {
            setLoading(true);
            const { updateUserProfile } = await import('../../lib/firestore-service');
            await updateUserProfile(auth.currentUser.uid, {
                'settings.backgroundSyncEnabled': value
            });
            setBackgroundSyncEnabled(value);
            
            if (value) {
                Alert.alert(
                    'Background Sync Active',
                    'The app will now automatically synchronize encryption keys and messages while in the background.'
                );
            }
        } catch (error) {
            console.error('Error toggling background sync:', error);
            Alert.alert('Error', 'Failed to update background sync setting.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetTracking = () => {
        Alert.alert(
            'Reset Persistence Tracking?',
            'This will reset login attempt counters and allow the persistence prompt to appear again. Use this for testing or if you want to be asked again.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Reset',
                    onPress: async () => {
                        await SecureStorage.resetPersistenceTracking();
                        await loadSecuritySettings();
                        Alert.alert('Success', 'Persistence tracking has been reset.');
                    },
                },
            ]
        );
    };

    const SettingRow = ({ icon, title, description, value, onValueChange, disabled, iconBg }) => (
        <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
            <View style={[styles.settingIcon, { backgroundColor: iconBg || 'rgba(251, 113, 133, 0.1)' }]}>
                <Feather name={icon} size={20} color={disabled ? theme.textSecondary : theme.primary} />
            </View>
            <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: theme.text }, disabled && styles.disabledText]}>
                    {title}
                </Text>
                {description && (
                    <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                        {description}
                    </Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                disabled={disabled || loading}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={value ? '#fff' : '#f4f3f4'}
                ios_backgroundColor={theme.border}
            />
        </View>
    );

    const SectionHeader = ({ title, icon }) => (
        <View style={styles.sectionHeader}>
            <Feather name={icon} size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        </View>
    );

    const InfoCard = ({ icon, title, value, color }) => (
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: 'transparent' }]}>
            <Feather name={icon} size={20} color={color || theme.primary} />
            <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[styles.infoCardTitle, { color: theme.textSecondary }]}>{title}</Text>
                <Text style={[styles.infoCardValue, { color: theme.text }]}>{value}</Text>
            </View>
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Login Persistence Section */}
            <View style={styles.section}>
                <SectionHeader title="Login Persistence" icon="shield" />

                <SettingRow
                    icon="key"
                    title="Save Login for Faster Sign-In"
                    description={`Securely store credentials using ${isIOS ? 'iOS Keychain' : isAndroid ? 'Android Keystore' : 'secure storage'}`}
                    value={loginPersistenceEnabled}
                    onValueChange={handleTogglePersistence}
                    iconBg="rgba(16, 185, 129, 0.1)"
                />

                {/* Status Cards */}
                {loginPersistenceEnabled && (
                    <View style={styles.statusContainer}>
                        <InfoCard
                            icon={hasStoredCredentials ? "check-circle" : "alert-circle"}
                            title="Stored Credentials"
                            value={hasStoredCredentials ? "Active" : "None"}
                            color={hasStoredCredentials ? "#10B981" : "#F59E0B"}
                        />
                        <InfoCard
                            icon="log-in"
                            title="Manual Logins"
                            value={`${manualLoginCount} times`}
                            color="#3B82F6"
                        />
                    </View>
                )}
            </View>

            {/* Credential Management */}
            {loginPersistenceEnabled && hasStoredCredentials && (
                <View style={styles.section}>
                    <SectionHeader title="Credential Management" icon="database" />

                    <Pressable
                        style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: 'transparent' }]}
                        onPress={handleClearCredentials}
                    >
                        <Feather name="trash-2" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingTitle, { color: '#EF4444' }]}>
                                Clear Saved Credentials
                            </Text>
                            <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                                Delete stored credentials but keep persistence enabled
                            </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </Pressable>
                </View>
            )}

            {/* Advanced Options */}
            <View style={styles.section}>
                <SectionHeader title="Advanced" icon="settings" />

                <SettingRow
                    icon="refresh-cw"
                    title="Cross-Device Recovery"
                    description="Backup encryption keys using your PIN. Required for multi-device usage or when changing phones."
                    value={keyBackupEnabled}
                    onValueChange={handleToggleKeyBackup}
                    iconBg="rgba(108, 99, 255, 0.1)"
                />
                
                {keyBackupEnabled && (
                    <>
                        <SettingRow
                            icon="unlock"
                            title="Auto-Decrypt Backups"
                            description="Silently unlock chat history using your cached PIN. If off, you will be prompted to enter your PIN manually."
                            value={autoRecoveryEnabled}
                            onValueChange={handleToggleAutoRecovery}
                            iconBg="rgba(59, 130, 246, 0.1)"
                        />

                        <SettingRow
                            icon="activity"
                            title="Background Synchronization"
                            description="Automatically sync encryption keys and fetch messages while the app is in the background."
                            value={backgroundSyncEnabled}
                            onValueChange={handleToggleBackgroundSync}
                            iconBg="rgba(16, 185, 129, 0.1)"
                        />
                    </>
                )}

                <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: 'transparent', marginTop: 12 }]}
                    onPress={handleResetTracking}
                >
                    <Feather name="refresh-cw" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>
                            Reset Persistence Tracking
                        </Text>
                        <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                            Reset login counters and prompt history
                        </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </Pressable>

                <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: 'transparent', marginTop: 12 }]}
                    onPress={handleSetPassword}
                >
                    <Feather name="lock" size={20} color="#3B82F6" style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>
                            Set Account Password
                        </Text>
                        <Text style={[styles.settingDescription, { color: theme.textSecondary }]}>
                            Establish or update your manual login password
                        </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                </Pressable>
            </View>

            {/* Privacy Notice */}
            <View style={styles.privacyNotice}>
                <Feather name="info" size={16} color={theme.textSecondary} style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={[styles.privacyText, { color: theme.textSecondary }]}>
                    <Text style={{ fontWeight: '700' }}>Privacy First:</Text> Your credentials are encrypted and stored only on this device. They are never sent to our servers or shared with third parties. You can disable this feature anytime.
                </Text>
            </View>

            {/* Debug Info (only if tracking exists) */}
            {(manualLoginCount > 0 || declineCount > 0) && (
                <View style={styles.debugInfo}>
                    <Text style={[styles.debugTitle, { color: theme.textSecondary }]}>Tracking Stats</Text>
                    <Text style={[styles.debugText, { color: theme.textSecondary }]}>
                        • Manual logins: {manualLoginCount}
                    </Text>
                    <Text style={[styles.debugText, { color: theme.textSecondary }]}>
                        • Times declined: {declineCount}
                    </Text>
                    <Text style={[styles.debugText, { color: theme.textSecondary }]}>
                        • Prompt will {declineCount >= 3 ? 'never' : 'eventually'} appear {declineCount >= 3 ? 'again (permanently declined)' : 'after 3-5 logins'}
                    </Text>
                </View>
            )}
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
    statusContainer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        gap: 12,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 0,
    },
    infoCardTitle: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },
    infoCardValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 20,
        borderRadius: 12,
        borderWidth: 0,
    },
    privacyNotice: {
        flexDirection: 'row',
        padding: 20,
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 24,
        backgroundColor: 'rgba(251, 113, 133, 0.05)',
        borderRadius: 12,
        borderWidth: 0,
        borderColor: 'rgba(251, 113, 133, 0.2)',
    },
    privacyText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
    },
    debugInfo: {
        padding: 20,
        marginHorizontal: 20,
        marginBottom: 40,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        borderWidth: 0,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    debugTitle: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    debugText: {
        fontSize: 11,
        lineHeight: 16,
        fontFamily: isIOS ? 'Courier' : 'monospace',
    },
});

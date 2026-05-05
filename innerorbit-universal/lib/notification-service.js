/** Purpose: Cross-platform notification management (Expo Notifications for Mobile, Web Notification API, and Electron Desktop). */
import { isWeb } from '../utils/platform';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from './logger';

// Platform-specific imports - expo-notifications only works on native
let Notifications;
try {
    if (!isWeb) {
        // Use require to avoid crashing if module is missing
        Notifications = require('expo-notifications');

        // Configure notification behavior (only on native)
        // Wrap in try-catch to prevent crashes in Expo Go or if module is unstable
        try {
            Notifications.setNotificationHandler({
                handleNotification: async () => {
                    const prefs = await getNotificationPreferences();
                    if (!prefs) return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true };

                    return {
                        shouldShowBanner: !!(prefs.notificationsEnabled && prefs.inAppNotifications),
                        shouldShowList: !!(prefs.notificationsEnabled && prefs.inAppNotifications),
                        shouldPlaySound: !!(prefs.soundEnabled && !prefs.muteAllNotifications),
                        shouldSetBadge: !!prefs.notificationsEnabled,
                    };
                },
            });

            // 🛡️ Set up Actionable Notifications (Quick Reply)
            Notifications.setNotificationCategoryAsync('MESSAGE_REPLY', [
                {
                    identifier: 'reply',
                    buttonTitle: 'Reply',
                    options: {
                        opensAppToForeground: false,
                    },
                    textInput: {
                        placeholder: 'Type your reply...',
                        submitButtonTitle: 'Send',
                    },
                },
            ]);

            // 👂 Listen for notification responses (Quick Reply background handler)
            Notifications.addNotificationResponseReceivedListener(async (response) => {
                const { actionIdentifier, userText, notification } = response;
                const { conversationId } = notification.request.content.data;

                if (actionIdentifier === 'reply' && userText && conversationId) {
                    try {
                        // Dynamically import to avoid circular dependency or early loading issues
                        const { sendMessage } = require('./firestore-service');
                        const { auth } = require('./firebase');
                        
                        const user = auth.currentUser;
                        if (user) {
                            await sendMessage(conversationId, user.uid, userText);
                            Logger.log(`[Notification] ✅ Quick reply sent to ${conversationId}`);
                        }
                    } catch (error) {
                        Logger.error('[Notification] Failed to send quick reply:', error);
                    }
                }
            });
        } catch (handlerError) {
            Logger.warn('Failed to set notification handler or categories:', handlerError);
        }
    }
} catch (error) {
    Logger.log('Notifications module not available on web or missing native module');
}

// Detect if running in Electron (Windows .exe)
const isElectron = isWeb &&
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('electron');

// 🖥️ Set up Desktop (Electron) Notification Reply Listener
if (isElectron && typeof window !== 'undefined' && window.electron && window.electron.onNotificationReply) {
    window.electron.onNotificationReply(async (conversationId, replyText) => {
        if (conversationId && replyText) {
            try {
                const { sendMessage } = require('./firestore-service');
                const { auth } = require('./firebase');
                
                const user = auth.currentUser;
                if (user) {
                    await sendMessage(conversationId, user.uid, replyText);
                    Logger.log(`[Notification-Desktop] ✅ Quick reply sent to ${conversationId}`);
                }
            } catch (error) {
                Logger.error('[Notification-Desktop] Failed to send quick reply:', error);
            }
        }
    });
}

/**
 * Request notification permissions
 * Works on Android, iOS, Web, and Windows Desktop
 * @returns {Promise<boolean>} Whether permissions were granted
 */
export async function requestNotificationPermissions() {
    // Windows Desktop (Electron) - notifications are always available
    if (isElectron) {
        return true;
    }

    // Web Browser - use Web Notification API
    if (isWeb) {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    // Mobile (Android/iOS)
    if (!Notifications) return false;

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        return finalStatus === 'granted';
    } catch (error) {
        Logger.error('Error requesting notification permissions:', error);
        return false;
    }
}

/**
 * Show a local notification
 * Cross-platform: Android, iOS, Web, Windows Desktop
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data
 */
export async function showLocalNotification(title, body, data = {}) {
    // Windows Desktop (Electron)
    if (isElectron && window.electron) {
        try {
            window.electron.showNotification(title, body, data);
            return;
        } catch (error) {
            Logger.error('Electron notification error:', error);
        }
    }

    // Web Browser
    if (isWeb && !isElectron) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body,
                    icon: '/icon.png',
                    badge: '/icon.png',
                    tag: data.conversationId || 'cipherplay',
                    requireInteraction: false,
                    silent: false,
                });
            } catch (error) {
                Logger.error('Web notification error:', error);
            }
        }
        return;
    }

    // Mobile (Android/iOS)
    if (!Notifications) return;

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
                vibrate: [0, 250, 250, 250],
                badge: 1,
                categoryIdentifier: data.type === 'message' ? 'MESSAGE_REPLY' : undefined,
            },
            trigger: null, // Show immediately
        });
    } catch (error) {
        Logger.error('Error showing notification:', error);
    }
}

/**
 * Show notification for new message
 * @param {string} senderName - Name of the sender
 * @param {string} message - Message preview
 * @param {string} conversationId - ID of the conversation
 */
export async function showMessageNotification(senderName, message, conversationId) {
    await showLocalNotification(
        `New message from ${senderName}`,
        message,
        { type: 'message', conversationId }
    );
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications() {
    if (isWeb || !Notifications) {
        // Web/Electron - can't programmatically cancel
        return;
    }

    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
        Logger.error('Error canceling notifications:', error);
    }
}

/**
 * Set up notification badge count
 * Works on all platforms including Windows desktop
 * @param {number} count - Badge count
 */
export async function setBadgeCount(count) {
    // Web/Desktop - use Badge API
    if (isWeb) {
        if ('setAppBadge' in navigator) {
            try {
                if (count > 0) {
                    await navigator.setAppBadge(count);
                } else {
                    await navigator.clearAppBadge();
                }
            } catch (error) {
                Logger.error('Error setting badge:', error);
            }
        }
        return;
    }

    // Mobile badge count
    if (!Notifications) return;

    try {
        await Notifications.setBadgeCountAsync(count);
    } catch (error) {
        Logger.error('Error setting badge count:', error);
    }
}

/**
 * Play notification sound (cross-platform)
 */
export function playNotificationSound() {
    if (isWeb || isElectron) {
        try {
            // Check if audio is supported and try to play
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(err => {
                // If the file is missing or blocked by browser policy, log it silently
                Logger.log('Notification audio play prevented or file missing');
            });
        } catch (error) {
            // Audio API not supported
        }
    }
}

/**
 * Get current notification preferences
 * Use this to check if notifications should be shown
 */
export async function getNotificationPreferences() {
    try {
        const prefs = await AsyncStorage.getItem('notificationPreferences');
        if (prefs) {
            return JSON.parse(prefs);
        }
        // Default preferences
        return {
            notificationsEnabled: true,
            messageNotifications: true,
            soundEnabled: true,
            vibrationEnabled: true,
            showPreview: true,
            inAppNotifications: true,
            notificationLight: true,
            muteAllNotifications: false,
            doNotDisturb: false,
            allowFromContacts: true,
            allowFromUnknown: true,
        };
    } catch (error) {
        Logger.log('Error getting notification preferences:', error);
        return null;
    }
}

/**
 * Check if notification should be shown based on preferences
 * @param {string} senderUid - UID of message sender
 * @param {boolean} isContact - Whether sender is in contacts
 */
export async function shouldShowNotification(senderUid, isContact = false) {
    const prefs = await getNotificationPreferences();
    if (!prefs) return true; // Default to showing if can't load prefs

    // Check master switches
    if (!prefs.notificationsEnabled || prefs.muteAllNotifications) {
        return false;
    }

    // Check message notifications
    if (!prefs.messageNotifications) {
        return false;
    }

    // Check privacy filters
    if (isContact && !prefs.allowFromContacts) {
        return false;
    }
    if (!isContact && !prefs.allowFromUnknown) {
        return false;
    }

    // Check do not disturb
    if (prefs.doNotDisturb) {
        const hour = new Date().getHours();
        // DND from 10 PM to 8 AM
        if (hour >= 22 || hour < 8) {
            return false;
        }
    }

    return true;
}

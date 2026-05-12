/**
 * Purpose: Manages incoming connection notifications from other users. Handles real-time Firestore
 * synchronization, local dismissal via AsyncStorage, and notification response logic.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firestoreService from '../lib/firestore-service';
import { Logger } from '../lib/logger';

const DISMISSED_NOTIFICATIONS_KEY = 'dismissed_connection_notifications';

export function useConnectionNotifications(user, isDecoyMode) {
    const [notifications, setNotifications] = useState([]);
    const [latestNotification, setLatestNotification] = useState(null);
    const [dismissedNotificationIds, setDismissedNotificationIds] = useState(new Set());
    const [isResponding, setIsResponding] = useState(false);

    // Load dismissed IDs on mount
    useEffect(() => {
        const loadDismissed = async () => {
            try {
                const stored = await AsyncStorage.getItem(DISMISSED_NOTIFICATIONS_KEY);
                if (stored) {
                    setDismissedNotificationIds(new Set(JSON.parse(stored)));
                }
            } catch (e) {
                Logger.error("[useConnectionNotifications] Error loading dismissed IDs:", e);
            }
        };
        loadDismissed();
    }, []);

    useEffect(() => {
        if (!user || isDecoyMode) {
            setNotifications([]);
            setLatestNotification(null);
            return;
        };

        const unsubscribe = firestoreService.subscribeToIncomingRequests(user.uid, (data) => {
            Logger.log("[useConnectionNotifications] Received notifications:", data.length);
            setNotifications(data);

            // Find the latest one that HASN'T been dismissed and IS pending
            const newLatest = data.find(req => !dismissedNotificationIds.has(req.id) && req.status === 'pending');
            setLatestNotification(newLatest || null);
        });

        return unsubscribe;
    }, [user, isDecoyMode, dismissedNotificationIds]);

    const handleRespond = async (notificationId, status, senderId) => {
        if (isResponding) return;
        setIsResponding(true);
        try {
            await firestoreService.respondToConnectionRequest(notificationId, status, senderId, user.uid);
        } catch (error) {
            Logger.error("Error responding to notification:", error);
        } finally {
            setIsResponding(false);
        }
    };

    const dismissNotification = async (notificationId) => {
        const newSet = new Set(dismissedNotificationIds).add(notificationId);
        setDismissedNotificationIds(newSet);
        setLatestNotification(null);

        try {
            await AsyncStorage.setItem(DISMISSED_NOTIFICATIONS_KEY, JSON.stringify([...newSet]));
            Logger.log("[useConnectionNotifications] Persisted dismissal for:", notificationId);
        } catch (e) {
            Logger.error("[useConnectionNotifications] Error persisting dismissal:", e);
        }
    };

    return { notifications, latestNotification, handleRespond, dismissNotification, isResponding };
}

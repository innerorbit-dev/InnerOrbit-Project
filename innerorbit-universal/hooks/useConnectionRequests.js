/**
 * Purpose: Manages incoming connection requests from other users. Handles real-time Firestore
 * synchronization, local dismissal via AsyncStorage, and request response logic.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firestoreService from '../lib/firestore-service';
import { Logger } from '../lib/logger';

const DISMISSED_REQUESTS_KEY = 'dismissed_connection_requests';

export function useConnectionRequests(user, isDecoyMode) {
    const [requests, setRequests] = useState([]);
    const [latestRequest, setLatestRequest] = useState(null);
    const [dismissedRequestIds, setDismissedRequestIds] = useState(new Set());
    const [isResponding, setIsResponding] = useState(false);

    // Load dismissed IDs on mount
    useEffect(() => {
        const loadDismissed = async () => {
            try {
                const stored = await AsyncStorage.getItem(DISMISSED_REQUESTS_KEY);
                if (stored) {
                    setDismissedRequestIds(new Set(JSON.parse(stored)));
                }
            } catch (e) {
                Logger.error("[useConnectionRequests] Error loading dismissed IDs:", e);
            }
        };
        loadDismissed();
    }, []);

    useEffect(() => {
        if (!user || isDecoyMode) {
            setRequests([]);
            setLatestRequest(null);
            return;
        };

        const unsubscribe = firestoreService.subscribeToIncomingRequests(user.uid, (data) => {
            Logger.log("[useConnectionRequests] Received requests:", data.length);
            setRequests(data);

            // Find the latest one that HASN'T been dismissed and IS pending
            const newLatest = data.find(req => !dismissedRequestIds.has(req.id) && req.status === 'pending');
            setLatestRequest(newLatest || null);
        });

        return unsubscribe;
    }, [user, isDecoyMode, dismissedRequestIds]);

    const handleRespond = async (requestId, status, senderId) => {
        if (isResponding) return;
        setIsResponding(true);
        try {
            await firestoreService.respondToConnectionRequest(requestId, status, senderId, user.uid);
        } catch (error) {
            Logger.error("Error responding to request:", error);
        } finally {
            setIsResponding(false);
        }
    };

    const dismissRequest = async (requestId) => {
        const newSet = new Set(dismissedRequestIds).add(requestId);
        setDismissedRequestIds(newSet);
        setLatestRequest(null);

        try {
            await AsyncStorage.setItem(DISMISSED_REQUESTS_KEY, JSON.stringify([...newSet]));
            Logger.log("[useConnectionRequests] Persisted dismissal for:", requestId);
        } catch (e) {
            Logger.error("[useConnectionRequests] Error persisting dismissal:", e);
        }
    };

    return { requests, latestRequest, handleRespond, dismissRequest, isResponding };
}

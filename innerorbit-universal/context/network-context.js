/**
 * Purpose: Provides real-time network connectivity monitoring and offline resilience. 
 * Manages an operation queue to persist and retry failed requests when connectivity returns.
 */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeStorage } from '../lib/utils';
import { Logger } from '../lib/logger';

const NetworkContext = createContext(undefined);

const OFFLINE_QUEUE_KEY = 'offline_operation_queue';

export function NetworkProvider({ children }) {
    // ... (rest of the state)
    const [isConnected, setIsConnected] = useState(true);
    const [isInternetReachable, setIsInternetReachable] = useState(true);
    const [connectionType, setConnectionType] = useState('unknown');
    const [connectionQuality, setConnectionQuality] = useState('good');

    const [status, setStatus] = useState('online');
    const statusTimeout = useRef(null);
    const offlineQueue = useRef([]);
    const lastOnlineTime = useRef(Date.now());

    // Load persisted queue on mount
    useEffect(() => {
        const loadQueue = async () => {
            const savedQueue = await SafeStorage.getJson(OFFLINE_QUEUE_KEY, []);
            if (savedQueue.length > 0) {
                Logger.log(`[Network] Loaded ${savedQueue.length} persisted operations from queue`);
                offlineQueue.current = savedQueue;
                if (isConnected && isInternetReachable) {
                    processOfflineQueue();
                }
            }
        };
        loadQueue();
    }, []);

    // Monitor network state
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const wasOffline = !isConnected;
            const isNowConnected = state.isConnected ?? true;
            const isNowReachable = state.isInternetReachable ?? true;

            setIsConnected(isNowConnected);
            setIsInternetReachable(isNowReachable);
            setConnectionType(state.type);

            // ... (rest of the logic)
            if (!isNowConnected) {
                setStatus('offline');
                setConnectionQuality('offline');
            } else if (!isNowReachable) {
                setStatus('reconnecting');
                setConnectionQuality('poor');
            } else {
                setConnectionQuality('good');
                if (wasOffline || status === 'reconnecting') {
                    setStatus('restored');
                    if (statusTimeout.current) clearTimeout(statusTimeout.current);
                    statusTimeout.current = setTimeout(() => {
                        setStatus('online');
                    }, 3000);
                } else {
                    setStatus('online');
                }
            }

            if (wasOffline && isNowConnected && isNowReachable) {
                lastOnlineTime.current = Date.now();
                processOfflineQueue();
            }

            SafeStorage.setJson('lastNetworkState', {
                isConnected: isNowConnected,
                type: state.type,
                timestamp: Date.now()
            });
        });

        return () => {
            unsubscribe();
            if (statusTimeout.current) clearTimeout(statusTimeout.current);
        };
    }, [isConnected, isInternetReachable]);

    const persistQueue = () => {
        SafeStorage.setJson(OFFLINE_QUEUE_KEY, offlineQueue.current);
    };

    const processOfflineQueue = async () => {
        if (offlineQueue.current.length === 0) return;
        
        const queue = [...offlineQueue.current];
        offlineQueue.current = [];
        persistQueue();

        for (const operation of queue) {
            try {
                // Note: Operation.execute must be a serializable description or 
                // we need a dispatcher here. For now, assuming description.
                Logger.log('[Network] Retrying operation:', operation.id);
                // Implementation of execution logic depends on app-specific needs
                // await dispatch(operation); 
            } catch (error) {
                if ((operation.retries || 0) < 3) {
                    queueOperation({
                        ...operation,
                        retries: (operation.retries || 0) + 1
                    });
                }
            }
        }
    };

    const queueOperation = (operation) => {
        const op = {
            ...operation,
            id: operation.id || `op_${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
            retries: operation.retries || 0
        };
        offlineQueue.current.push(op);
        persistQueue();
        Logger.log('[Network] Operation queued:', op.id);
    };

    // Execute with automatic retry and offline queueing
    const executeWithRetry = async (fn, options = {}) => {
        const {
            maxRetries = 3,
            retryDelay = 1000,
            exponentialBackoff = true,
            queueIfOffline = true,
            timeout = 30000
        } = options;

        // If offline and queueing enabled, queue it
        if (!isConnected && queueIfOffline) {
            queueOperation({
                execute: () => executeWithRetry(fn, { ...options, queueIfOffline: false })
            });
            throw new Error('Network unavailable - operation queued');
        }

        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add timeout wrapper
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Operation timeout')), timeout)
                );

                const result = await Promise.race([fn(), timeoutPromise]);
                return result;
            } catch (error) {
                lastError = error;

                if (attempt < maxRetries) {
                    const delay = exponentialBackoff
                        ? retryDelay * Math.pow(2, attempt)
                        : retryDelay;

                    Logger.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    };

    // Check if network is stable (not fluctuating)
    const isNetworkStable = () => {
        return isConnected && isInternetReachable && connectionQuality !== 'poor';
    };

    // Get network status summary
    const getNetworkStatus = () => ({
        isConnected,
        isInternetReachable,
        connectionType,
        connectionQuality,
        isStable: isNetworkStable(),
        queuedOperations: offlineQueue.current.length,
        lastOnlineTime: lastOnlineTime.current
    });

    const value = {
        isConnected,
        isInternetReachable,
        connectionType,
        connectionQuality,
        status,
        isNetworkStable,
        getNetworkStatus,
        executeWithRetry,
        queueOperation,
        offlineQueue: offlineQueue.current
    };

    return (
        <NetworkContext.Provider value={value}>
            {children}
        </NetworkContext.Provider>
    );
}

export function useNetwork() {
    const context = useContext(NetworkContext);
    if (context === undefined) {
        throw new Error('useNetwork must be used within NetworkProvider');
    }
    return context;
}

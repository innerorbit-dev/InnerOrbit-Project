import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './auth-context';
import { WebRTCService } from '../lib/webrtc-service';
import { Logger } from '../lib/logger';

const CallContext = createContext();

function parseExtraTurnServers() {
    const raw = Constants.expoConfig?.extra?.webRtcTurnServers;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export const CallProvider = ({ children }) => {
    const { user } = useAuth();
    const [activeCall, setActiveCall] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [micMuted, setMicMuted] = useState(false);
    const webrtcRef = useRef(null);
    const incomingRingIdRef = useRef(null);

    const buildWebRtcOptions = useCallback(() => {
        const extraTurn = parseExtraTurnServers();
        const profileTurn = user?.privacySettings?.turnServers || [];
        const turnServers = [...profileTurn, ...extraTurn].filter(Boolean);

        return {
            protectIP: !!user?.privacySettings?.protectIP,
            turnServers,
            onStreamsChanged: ({ local, remote }) => {
                setLocalStream(local || null);
                setRemoteStream(remote || null);
                if (!local) setMicMuted(false);
            },
            onCallEnded: () => {
                setActiveCall(null);
                setMicMuted(false);
            },
        };
    }, [user?.privacySettings?.protectIP, user?.privacySettings?.turnServers, user?.uid]);

    useEffect(() => {
        if (!user?.uid) {
            incomingRingIdRef.current = null;
            setIncomingCall(null);
            setActiveCall(null);
            setLocalStream(null);
            setRemoteStream(null);
            if (webrtcRef.current) {
                void webrtcRef.current.hangUp();
                webrtcRef.current = null;
            }
            return;
        }

        webrtcRef.current = new WebRTCService(user.uid, buildWebRtcOptions());

        const unsubscribe = webrtcRef.current.listenForIncomingCalls(
            (callData) => {
                if (incomingRingIdRef.current === callData.callId) return;
                incomingRingIdRef.current = callData.callId;
                Logger.log('[WebRTC] Incoming call:', callData.callId);
                setIncomingCall(callData);
            },
            (callId) => {
                setIncomingCall((prev) => (prev?.callId === callId ? null : prev));
                if (incomingRingIdRef.current === callId) {
                    incomingRingIdRef.current = null;
                }
            },
        );

        return () => {
            incomingRingIdRef.current = null;
            unsubscribe();
            if (webrtcRef.current) {
                void webrtcRef.current.hangUp();
                webrtcRef.current = null;
            }
        };
    }, [user?.uid, buildWebRtcOptions]);

    const startCall = async (targetUserId, peerName, conversationId = null) => {
        if (!webrtcRef.current) return;
        try {
            await webrtcRef.current.hangUp().catch(() => {});
            await webrtcRef.current.initConnection(false);
            const callerName =
                user?.displayName ||
                user?.email?.split('@')[0] ||
                (user?.uid ? `User ${String(user.uid).slice(0, 4)}` : 'Contact');
            await webrtcRef.current.startCall(targetUserId, {
                callerName,
                conversationId,
                recipientName: peerName || null,
            });
            setActiveCall({
                callId: webrtcRef.current.callDocRef?.id,
                peerName: peerName || 'Contact',
                isIncoming: false,
            });
        } catch (e) {
            Logger.error('Start call error:', e);
            Alert.alert('Call Failed', 'Could not start voice call. Check microphone permission and network.');
            throw e;
        }
    };

    const answerCall = async () => {
        if (!incomingCall || !webrtcRef.current) return;
        try {
            await webrtcRef.current.hangUp().catch(() => {});
            await webrtcRef.current.initConnection(false);
            await webrtcRef.current.answerCall(incomingCall.callId, incomingCall.offer);
            setActiveCall({
                ...incomingCall,
                peerName: incomingCall.callerName || 'Contact',
                isIncoming: true,
            });
            setIncomingCall(null);
            incomingRingIdRef.current = null;
        } catch (e) {
            Logger.error('Answer call error:', e);
            Alert.alert('Error', 'Could not answer call.');
        }
    };

    const rejectCall = async () => {
        if (!incomingCall) return;
        try {
            await webrtcRef.current?.rejectCall(incomingCall.callId);
        } catch (e) {
            Logger.warn('rejectCall:', e?.message);
        }
        setIncomingCall(null);
        incomingRingIdRef.current = null;
    };

    const hangUp = async () => {
        await webrtcRef.current?.hangUp();
        setActiveCall(null);
        incomingRingIdRef.current = null;
        setMicMuted(false);
    };

    const toggleMute = useCallback(() => {
        if (!webrtcRef.current) return;
        const next = !micMuted;
        webrtcRef.current.setMicMuted(next);
        setMicMuted(next);
    }, [micMuted]);

    return (
        <CallContext.Provider
            value={{
                activeCall,
                incomingCall,
                localStream,
                remoteStream,
                micMuted,
                startCall,
                answerCall,
                rejectCall,
                hangUp,
                toggleMute,
            }}
        >
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used within CallProvider');
    return context;
};

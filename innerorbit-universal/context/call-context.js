import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './auth-context';
import { WebRTCService } from '../lib/webrtc-service';
import { Logger } from '../lib/logger';

const CallContext = createContext();

export const CallProvider = ({ children }) => {
    const { user } = useAuth();
    const [activeCall, setActiveCall] = useState(null); // { callId, peerName, isIncoming }
    const [incomingCall, setIncomingCall] = useState(null);
    const webrtcRef = useRef(null);

    useEffect(() => {
        if (user?.uid) {
            if (!webrtcRef.current) {
                // Initialize with privacy settings from user profile
                const options = {
                    protectIP: !!user.privacySettings?.protectIP,
                    turnServers: user.privacySettings?.turnServers || []
                };
                webrtcRef.current = new WebRTCService(user.uid, options);
            }

            const unsubscribe = webrtcRef.current.listenForIncomingCalls((callData) => {
                Logger.log("[WebRTC] Incoming call in context:", callData.callId);
                setIncomingCall(callData);
            });

            return () => {
                unsubscribe();
                if (webrtcRef.current) webrtcRef.current.hangUp();
            };
        }
    }, [user?.uid]);

    const startCall = async (targetUserId, peerName) => {
        if (!webrtcRef.current) return;
        try {
            await webrtcRef.current.initConnection(false);
            const callId = await webrtcRef.current.startCall(targetUserId);
            setActiveCall({ callId, peerName, isIncoming: false });
        } catch (e) {
            Logger.error("Start call error:", e);
            Alert.alert("Call Failed", "Could not start voice call.");
            throw e;
        }
    };

    const answerCall = async () => {
        if (!incomingCall || !webrtcRef.current) return;
        try {
            await webrtcRef.current.initConnection(false);
            await webrtcRef.current.answerCall(incomingCall.callId, incomingCall.offer);
            setActiveCall({ ...incomingCall, isIncoming: true });
            setIncomingCall(null);
        } catch (e) {
            Logger.error("Answer call error:", e);
            Alert.alert("Error", "Could not answer call.");
        }
    };

    const rejectCall = async () => {
        if (!incomingCall) return;
        await webrtcRef.current.rejectCall(incomingCall.callId);
        setIncomingCall(null);
    };

    const hangUp = async () => {
        await webrtcRef.current.hangUp();
        setActiveCall(null);
    };

    return (
        <CallContext.Provider value={{ 
            activeCall, 
            incomingCall, 
            startCall, 
            answerCall, 
            rejectCall, 
            hangUp 
        }}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error("useCall must be used within CallProvider");
    return context;
};

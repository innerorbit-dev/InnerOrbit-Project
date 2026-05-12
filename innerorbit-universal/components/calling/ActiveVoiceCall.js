import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../store/themeStore';
import * as ScreenCapture from 'expo-screen-capture';
import { isWeb } from '../../utils/platform';

let RTCView = null;
if (!isWeb) {
    try {
        RTCView = require('react-native-webrtc').RTCView;
    } catch {
        RTCView = null;
    }
}

export const ActiveVoiceCall = ({
    peerName,
    onHangUp,
    remoteStream,
    isMuted,
    onToggleMute,
}) => {
    const [duration, setDuration] = useState(0);
    const { theme: THEME, isDark } = useAppTheme();

    useEffect(() => {
        const interval = setInterval(() => setDuration((d) => d + 1), 1000);

        if (!isWeb) {
            ScreenCapture.preventScreenCaptureAsync();
        }

        return () => {
            clearInterval(interval);
            if (!isWeb) {
                ScreenCapture.allowScreenCaptureAsync();
            }
        };
    }, []);

    useEffect(() => {
        if (!isWeb || typeof document === 'undefined' || !remoteStream) return;
        const el = document.createElement('audio');
        el.setAttribute('playsinline', 'true');
        el.autoplay = true;
        el.srcObject = remoteStream;
        el.style.display = 'none';
        document.body.appendChild(el);
        void el.play?.()?.catch(() => {});
        return () => {
            try {
                el.srcObject = null;
                el.remove();
            } catch {
                /* noop */
            }
        };
    }, [remoteStream]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View style={[styles.container, { backgroundColor: THEME.background }]}>
            {!isWeb && remoteStream && RTCView && (
                <RTCView
                    streamURL={remoteStream.toURL()}
                    objectFit="cover"
                    style={{ width: 1, height: 1, position: 'absolute', opacity: 0 }}
                />
            )}

            <View style={styles.header}>
                <Text style={[styles.peerName, { color: THEME.text }]}>{peerName || 'Unknown Caller'}</Text>
                <Text style={[styles.timer, { color: THEME.textSecondary }]}>{formatTime(duration)}</Text>
                <Text style={[styles.encryptionStatus, { color: THEME.success || '#10B981' }]}>
                    Voice (WebRTC) — Firestore signaling
                </Text>
            </View>

            <View style={styles.avatarContainer}>
                <MaterialCommunityIcons name="account-circle" size={120} color={THEME.border} />
            </View>

            <View style={styles.controlsContainer}>
                <Pressable
                    style={[
                        styles.controlButton,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
                        isMuted && { backgroundColor: THEME.text },
                    ]}
                    onPress={onToggleMute}
                >
                    <MaterialCommunityIcons
                        name={isMuted ? 'microphone-off' : 'microphone'}
                        size={32}
                        color={isMuted ? THEME.background : THEME.text}
                    />
                </Pressable>

                <Pressable style={[styles.controlButton, styles.hangUpButton]} onPress={onHangUp}>
                    <MaterialCommunityIcons name="phone-hangup" size={32} color="#fff" />
                </Pressable>

                <View style={[styles.controlButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', opacity: 0.5 }]}>
                    <MaterialCommunityIcons name="volume-high" size={32} color={THEME.textSecondary} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 60,
    },
    header: {
        alignItems: 'center',
        marginTop: 40,
    },
    peerName: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    timer: {
        fontSize: 20,
        marginBottom: 10,
    },
    encryptionStatus: {
        fontSize: 14,
    },
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    controlButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hangUpButton: {
        backgroundColor: '#EF4444',
        transform: [{ scale: 1.1 }],
    },
});

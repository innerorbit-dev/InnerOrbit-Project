import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../store/themeStore';
import * as ScreenCapture from 'expo-screen-capture';
import { isWeb } from '../../utils/platform';

export const ActiveVoiceCall = ({ peerName, onHangUp }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);
    const { theme: THEME, isDark } = useAppTheme();

    // Simple Call Timer
    useEffect(() => {
        const interval = setInterval(() => setDuration(d => d + 1), 1000);
        
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

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const toggleMute = () => setIsMuted(!isMuted);

    return (
        <View style={[styles.container, { backgroundColor: THEME.background }]}>
            <View style={styles.header}>
                <Text style={[styles.peerName, { color: THEME.text }]}>{peerName || 'Unknown Caller'}</Text>
                <Text style={[styles.timer, { color: THEME.textSecondary }]}>{formatTime(duration)}</Text>
                <Text style={[styles.encryptionStatus, { color: THEME.success || '#10B981' }]}>🔒 End-to-End Encrypted</Text>
            </View>

            <View style={styles.avatarContainer}>
                <MaterialCommunityIcons name="account-circle" size={120} color={THEME.border} />
            </View>

            <View style={styles.controlsContainer}>
                {/* Mute Button */}
                <Pressable 
                    style={[
                        styles.controlButton, 
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
                        isMuted && { backgroundColor: THEME.text }
                    ]} 
                    onPress={toggleMute}
                >
                    <MaterialCommunityIcons 
                        name={isMuted ? "microphone-off" : "microphone"} 
                        size={32} 
                        color={isMuted ? THEME.background : THEME.text} 
                    />
                </Pressable>

                {/* Hang Up Button */}
                <Pressable 
                    style={[styles.controlButton, styles.hangUpButton]} 
                    onPress={onHangUp}
                >
                    <MaterialCommunityIcons name="phone-hangup" size={32} color="#fff" />
                </Pressable>

                {/* Speaker Button (Mock for now) */}
                <Pressable style={[styles.controlButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                    <MaterialCommunityIcons name="volume-high" size={32} color={THEME.text} />
                </Pressable>
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
        backgroundColor: '#EF4444', // Keep red for hang up
        transform: [{ scale: 1.1 }],
    }
});

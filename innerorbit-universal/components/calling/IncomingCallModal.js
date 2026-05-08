import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../store/themeStore';
import { BlurView } from 'expo-blur';

export const IncomingCallModal = ({ visible, callerName, onAnswer, onReject }) => {
    const { theme: THEME, isDark } = useAppTheme();

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="slide">
            <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.container}>
                <View style={[styles.modalBox, { 
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    borderColor: THEME.border 
                }]}>
                    
                    {/* Caller Info */}
                    <View style={styles.callerInfo}>
                        <MaterialCommunityIcons name="account-circle" size={80} color={THEME.border} />
                        <Text style={[styles.callerName, { color: THEME.text }]}>{callerName || "Unknown Caller"}</Text>
                        <Text style={[styles.statusText, { color: THEME.textSecondary }]}>Incoming Voice Call...</Text>
                        <Text style={[styles.encryptionBadge, { color: THEME.success || '#10B981' }]}>🔒 End-to-End Encrypted</Text>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        <Pressable 
                            style={[styles.actionButton, { backgroundColor: '#EF4444' }]} 
                            onPress={onReject}
                        >
                            <MaterialCommunityIcons name="phone-hangup" size={32} color="#fff" />
                        </Pressable>

                        <Pressable 
                            style={[styles.actionButton, styles.answerButton, { backgroundColor: '#10B981' }]} 
                            onPress={onAnswer}
                        >
                            <MaterialCommunityIcons name="phone" size={32} color="#fff" />
                        </Pressable>
                    </View>

                </View>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalBox: {
        width: '85%',
        borderRadius: 24,
        padding: 30,
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    callerInfo: {
        alignItems: 'center',
        marginBottom: 40,
    },
    callerName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 5,
    },
    statusText: {
        fontSize: 16,
        marginBottom: 15,
    },
    encryptionBadge: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
    },
    actionButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    answerButton: {
        // Add a slight bounce or pulse animation here in the future
    }
});

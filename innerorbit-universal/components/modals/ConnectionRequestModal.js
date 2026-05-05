/** Purpose: Modal for reviewing and responding to connection requests from other users. */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { isWeb, select } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export function ConnectionRequestModal({ visible, request, onRespond, onClose, THEME }) {
    if (!visible || !request) return null;

    const senderId = request.senderInfo?.userId || "Someone";

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
        >
            <View style={styles.overlay}>
                <BlurView
                    intensity={100}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                />

                <View style={[
                    styles.alertBox,
                    {
                        backgroundColor: 'rgba(15, 23, 42, 0.6)', // Darker slate for premium frost
                        borderColor: 'rgba(255, 255, 255, 0.15)'
                    },
                    isWeb && { backdropFilter: 'blur(30px)' }
                ]}>
                    {/* Close button at top right */}
                    <Pressable
                        onPress={onClose}
                        style={{ position: 'absolute', top: 16, right: 16, padding: 4, zIndex: 10 }}
                    >
                        <Feather name="x" size={24} color="#FFF" />
                    </Pressable>

                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: `${THEME.primary}20` }]}>
                            <Feather name="user-plus" size={24} color={THEME.primary} />
                        </View>
                        <Text style={[styles.title, { color: '#FFF' }]}>Connection Request</Text>
                    </View>

                    <Text style={[styles.message, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                        <Text style={{ fontWeight: 'bold', color: THEME.primary }}>{senderId}</Text> wants to connect with you securely.
                    </Text>

                    <View style={styles.buttonRow}>
                        <Pressable
                            onPress={() => onRespond(request.id, 'declined', request.senderId)}
                            style={[styles.declineButton, { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' }]}
                        >
                            <Text style={[styles.declineText, { color: 'rgba(255, 255, 255, 0.8)' }]}>Decline</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onRespond(request.id, 'accepted', request.senderId)}
                            style={[styles.acceptButton, { backgroundColor: THEME.primary }]}
                        >
                            <Text style={[styles.acceptText, { color: '#FFF' }]}>Accept</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    alertBox: {
        width: '100%',
        maxWidth: 350,
        borderRadius: 24,
        padding: 24,
        borderWidth: 0.5,
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
            web: {
                boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.5)',
            },
        }),
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    declineButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    declineText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 15,
    },
    acceptButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
            web: {
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
            },
        }),
    },
    acceptText: {
        color: '#0F172A',
        fontWeight: '800',
        fontSize: 15,
    }
});

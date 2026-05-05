/**
 * Purpose: UI interrupt for handling session expiration events. Prompts users to 
 * re-authenticate when the security token is no longer valid or has timed out.
 */
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function SessionExpiredModal({ visible, onConfirm, theme }) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onConfirm}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalContainer, { backgroundColor: theme?.surface || '#1E293B', borderColor: theme?.border || '#334155' }]}>
                    <View style={styles.iconContainer}>
                        <Feather name="alert-triangle" size={40} color="#fb7185" />
                    </View>

                    <Text style={[styles.title, { color: theme?.text || '#F1F5F9' }]}>Session Expired</Text>
                    <Text style={[styles.message, { color: theme?.textSecondary || '#94A3B8' }]}>
                        Your session has ended for security reasons. Please log in again to continue.
                    </Text>

                    <Pressable
                        onPress={onConfirm}
                        style={({ pressed }) => [
                            styles.button,
                            { backgroundColor: theme?.primary || '#fb7185', opacity: pressed ? 0.9 : 1 }
                        ]}
                    >
                        <Text style={styles.buttonText}>Got it</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(251, 113, 133, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    button: {
        width: '100%',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    buttonText: {
        color: '#0F172A',
        fontWeight: '800',
        fontSize: 16,
        letterSpacing: 0.5,
    },
});

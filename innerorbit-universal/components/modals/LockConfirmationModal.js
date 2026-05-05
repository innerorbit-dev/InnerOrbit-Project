/** Purpose: Confirmation modal before locking the app and returning to the calculator. */
import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Switch } from 'react-native';
import { isWeb, select } from "../../utils/platform";
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export const LockConfirmationModal = ({ visible, onClose, onConfirm, THEME }) => {
    const [dontAskAgain, setDontAskAgain] = useState(false);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                {/* Blur Background */}
                <BlurView
                    intensity={isWeb ? 0 : 100}
                    style={StyleSheet.absoluteFill}
                    tint="dark"
                />

                <View style={[styles.modalView, { backgroundColor: THEME.surface, borderColor: THEME.border }]}>

                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                        <View style={{
                            width: 50, height: 50, borderRadius: 25,
                            backgroundColor: `${THEME.error}20`,
                            justifyContent: 'center', alignItems: 'center', marginBottom: 12
                        }}>
                            <Feather name="lock" size={24} color={THEME.error} />
                        </View>
                        <Text style={[styles.modalTitle, { color: THEME.text }]}>Lock App?</Text>
                        <Text style={[styles.modalText, { color: THEME.textSecondary }]}>
                            This will return you to the calculator screen.
                        </Text>
                    </View>

                    {/* Don't Ask Again Toggle */}
                    <Pressable
                        onPress={() => setDontAskAgain(!dontAskAgain)}
                        style={{
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 24, padding: 8, borderRadius: 8,
                            backgroundColor: THEME.actionBackground
                        }}
                    >
                        <View style={{
                            width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                            borderColor: dontAskAgain ? THEME.primary : THEME.textSecondary,
                            backgroundColor: dontAskAgain ? THEME.primary : 'transparent',
                            alignItems: 'center', justifyContent: 'center', marginRight: 10
                        }}>
                            {dontAskAgain && <Feather name="check" size={14} color={THEME.surface} />}
                        </View>
                        <Text style={{ color: THEME.text, fontSize: 14 }}>Don't ask again</Text>
                    </Pressable>

                    <View style={styles.buttonContainer}>
                        <Pressable
                            style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: THEME.border }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.textStyle, { color: THEME.text }]}>Cancel</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.button, { backgroundColor: THEME.error, marginLeft: 12 }]}
                            onPress={() => onConfirm(dontAskAgain)}
                        >
                            <Text style={[styles.textStyle, { color: '#FFF' }]}>Lock</Text>
                        </Pressable>
                    </View>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 20
    },
    modalView: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        ...select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
            web: {
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
            },
        }),
        borderWidth: 1,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalText: {
        marginBottom: 0,
        textAlign: 'center',
        fontSize: 14,
    },
    buttonContainer: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center'
    },
    button: {
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
        elevation: 2,
        flex: 1,
        alignItems: 'center'
    },
    textStyle: {
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 16
    },
});

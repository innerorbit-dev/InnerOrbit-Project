/** Purpose: Modal displaying profile details of a scanned user before adding them. */
import React from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator, Image } from 'react-native';
import { select } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";

const ACCOUNT_IMG = require('../../assets/account.webp');

export const ScannedUserModal = ({
    visible,
    onClose,
    THEME,
    user,
    onAddChat,
    onScanAgain,
    isCreatingChat
}) => {
    if (!user) return null;

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: `${THEME.background}CC`, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{
                    width: '100%',
                    maxWidth: 400,
                    backgroundColor: THEME.surface,
                    borderRadius: 28,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    padding: 32,
                    alignItems: 'center',
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
                    })
                }}>
                    {/* Header */}
                    <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', position: 'absolute', top: 20, right: 20 }}>
                        <Pressable onPress={onClose} style={{ padding: 8 }}>
                            <Feather name="x" size={24} color={THEME.textSecondary} />
                        </Pressable>
                    </View>

                    <View style={{ marginBottom: 24, alignItems: 'center' }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: THEME.primary + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 16,
                            borderWidth: 2,
                            borderColor: THEME.primary
                        }}>
                            <Image
                                source={ACCOUNT_IMG}
                                style={{ width: '100%', height: '100%', borderRadius: 40 }}
                                resizeMode="cover"
                            />
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: THEME.text }}>User {user.userId}</Text>
                        <Text style={{ color: THEME.textSecondary, marginTop: 4 }}>Encrypted connection ready</Text>
                    </View>

                    <Pressable
                        onPress={() => onAddChat(user)}
                        disabled={isCreatingChat}
                        style={({ pressed }) => ({
                            width: '100%',
                            backgroundColor: THEME.primary,
                            paddingVertical: 18,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.9 : 1,
                            marginBottom: 16,
                            ...select({
                                ios: {
                                    shadowColor: THEME.primary,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 8,
                                },
                                android: {
                                    elevation: 4,
                                },
                                web: {
                                    boxShadow: `0px 4px 8px ${THEME.primary}`,
                                },
                            })
                        })}
                    >
                        {isCreatingChat ? (
                            <ActivityIndicator color={THEME.surface} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Feather name="message-square" size={20} color={THEME.surface} style={{ marginRight: 8 }} />
                                <Text style={{ color: THEME.surface, fontWeight: '800', fontSize: 17 }}>Send Request</Text>
                            </View>
                        )}
                    </Pressable>

                    <Pressable
                        onPress={onScanAgain}
                        style={({ pressed }) => ({
                            width: '100%',
                            paddingVertical: 16,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: THEME.border,
                            backgroundColor: pressed ? THEME.surface : 'transparent',
                        })}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Feather name="maximize" size={18} color={THEME.text} style={{ marginRight: 8 }} />
                            <Text style={{ color: THEME.text, fontWeight: '700', fontSize: 15 }}>Scan QR Code Again</Text>
                        </View>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

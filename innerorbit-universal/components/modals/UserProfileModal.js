/** Purpose: Full-screen modal for viewing profile images and detailed user info. */
import React, { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';
import { View, Text, Modal, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { isWeb, select } from "../../utils/platform";
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

/**
 * Modal to show the profile image with an info button
 */
export const ProfileImageModal = ({ visible, onClose, imageUri, onInfoPress, THEME }) => {

    // Screenshot Blocking
    useEffect(() => {
        if (isWeb) return;

        if (visible) {
            ScreenCapture.preventScreenCaptureAsync();
        } else {
            ScreenCapture.allowScreenCaptureAsync();
        }
        return () => {
            ScreenCapture.allowScreenCaptureAsync();
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView
                    intensity={100}
                    tint="dark"
                    style={StyleSheet.absoluteFill}
                />
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={[
                    styles.imageContainer,
                    isWeb && { backdropFilter: 'blur(20px)' }
                ]}>
                    <Image
                        source={imageUri ? { uri: imageUri } : require('../../assets/account.webp')}
                        style={[styles.fullImage, { backgroundColor: 'transparent' }]}
                        resizeMode="contain"
                    />

                    <Pressable
                        onPress={onInfoPress}
                        style={[styles.infoButton, { backgroundColor: THEME.primary, borderColor: 'rgba(255,255,255,0.3)' }]}
                    >
                        <Feather name="info" size={24} color="#FFF" />
                    </Pressable>
                </View>

                {/* Close Button */}
                <Pressable
                    onPress={onClose}
                    style={[
                        styles.closeButton,
                        { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }
                    ]}
                >
                    <Feather name="x" size={28} color="#FFF" />
                </Pressable>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)', // Reduced base opacity to see blur
    },
    backdrop: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    },
    imageContainer: {
        width: width,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    fullImage: {
        width: '100%',
        height: '100%',
    },
    infoButton: {
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
            web: {
                boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.3)',
            },
        }),
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 10,
        borderRadius: 20,
        borderWidth: 1,
    },
    detailsCard: {
        width: width * 0.85,
        borderRadius: 24,
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 1,
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 4,
        overflow: 'hidden',
        marginBottom: 16,
        ...select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
            },
            android: {
                elevation: 5,
            },
            web: {
                boxShadow: '0px 2px 5px rgba(0,0,0,0.2)',
            }
        }),
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    userIdBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    userIdText: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    label: {
        fontSize: 12,
        marginBottom: 2,
    },
    value: {
        fontSize: 16,
        fontWeight: '600',
    }
});

/** Purpose: Premium themed replacement for native browser/system alerts. */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { isWeb, select } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../../store/themeStore';

/**
 * A Premium Custom Alert Modal replacer for browser alerts.
 * Usage:
 * <CustomAlert 
 *   visible={isVisible} 
 *   title="Title" 
 *   message="Message" 
 *   buttons={[{ text: 'OK', onPress: () => setIsVisible(false) }]} 
 *   onClose={() => setIsVisible(false)}
 * />
 */
export function CustomAlert({ visible, title, message, buttons = [], onClose, type = 'info', contentStyle }) {
    const { theme: THEME, isDark } = useAppTheme();
    if (!visible) return null;

    // Icons based on type
    const getIcon = () => {
        switch (type) {
            case 'success': return { name: 'check-circle', color: '#10B981' };
            case 'error': return { name: 'alert-circle', color: '#EF4444' };
            case 'warning': return { name: 'alert-triangle', color: '#F59E0B' };
            default: return { name: 'info', color: THEME.primary };
        }
    };

    const icon = getIcon();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Blur Background */}
                <BlurView
                    intensity={isWeb ? 0 : 100}
                    style={StyleSheet.absoluteFill}
                    tint="dark"
                />

                <View style={[
                    styles.alertBox,
                    {
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.95)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                    },
                    isWeb && {
                        backdropFilter: 'blur(30px)',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.8)'
                    },
                    contentStyle
                ]}>
                    <View style={styles.header}>
                        <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
                            <Feather name={icon.name} size={24} color={icon.color} />
                        </View>
                        <Text style={[styles.title, { color: THEME.text }]}>{title}</Text>
                    </View>

                    <Text style={[styles.message, { color: THEME.textSecondary }]}>
                        {typeof message === 'string' && message.includes("This action CANNOT be undone!") ? (
                            (() => {
                                const parts = message.split("This action CANNOT be undone!");
                                return (
                                    <Text>
                                        {parts.map((part, i) => (
                                            <React.Fragment key={i}>
                                                {part}
                                                {i < parts.length - 1 && (
                                                    <Text style={{ color: '#EF4444', fontWeight: '800' }}>
                                                        This action CANNOT be undone!
                                                    </Text>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </Text>
                                );
                            })()
                        ) : message}
                    </Text>

                    <View style={styles.buttonRow}>
                        {buttons.length > 0 ? (
                            buttons.map((btn, index) => (
                                <Pressable
                                    key={index}
                                    onPress={btn.onPress}
                                    style={({ pressed }) => [
                                        styles.button,
                                        { backgroundColor: index === buttons.length - 1 ? icon.color : 'transparent' },
                                        { opacity: pressed ? 0.8 : 1 }
                                    ]}
                                >
                                    <Text style={[
                                        styles.buttonText,
                                        { color: index === buttons.length - 1 ? '#FFF' : THEME.textSecondary }
                                    ]}>
                                        {btn.text}
                                    </Text>
                                </Pressable>
                            ))
                        ) : (
                            <Pressable onPress={onClose} style={[styles.button, { backgroundColor: icon.color }]}>
                                <Text style={[styles.buttonText, { color: '#FFF' }]}>OK</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    alertBox: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
    webBlur: {
        // Backdrop filter simulation if supported
        // backdropFilter: 'blur(16px)', // Unofficial react-native-web style
    },
    header: {
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontFamily: 'Outfit_700Bold',
        color: '#F1F5F9',
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        width: '100%',
    },
    button: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80,
    },
    buttonText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 14,
    }
});

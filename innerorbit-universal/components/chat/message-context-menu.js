/** Purpose: Context menu for message actions like copy, delete, and reply. */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { isWeb, select } from '../../utils/platform';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

/**
 * Telegram-style context menu for messages
 * Shows on right-click (desktop) or long-press (mobile)
 */
export default function MessageContextMenu({
    visible,
    position,
    onClose,
    onReply,
    onEdit,
    onPin,
    onCopy,
    onForward,
    onDelete,
    onSelect,
    canEdit = false,
    canPin = true,
    isDarkMode = true
}) {
    if (!visible) return null;

    const menuItems = [
        { icon: 'corner-up-left', label: 'Reply', action: onReply, show: true },
        { icon: 'edit-2', label: 'Edit', action: onEdit, show: canEdit },
        { icon: 'bookmark', label: 'Pin', action: onPin, show: canPin },
        { icon: 'copy', label: 'Copy Text', action: onCopy, show: true },
        { icon: 'share', label: 'Forward', action: onForward, show: true },
        { icon: 'trash-2', label: 'Delete', action: onDelete, show: true, danger: true },
        { icon: 'check-square', label: 'Select', action: onSelect, show: true }
    ].filter(item => item.show);

    const handleItemPress = (action) => {
        action?.();
        onClose();
    };

    const menuStyle = {
        position: 'absolute',
        top: position.y,
        left: position.x,
        zIndex: 9999,
        minWidth: 180,
        borderRadius: 12,
        overflow: 'hidden',
        ...select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
            },
        }),
    };

    const containerStyle = {
        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderWidth: 1,
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
    };

    return (
        <>
            {/* Backdrop to close menu */}
            < Pressable
                style={styles.backdrop}
                onPress={onClose}
            />

            {/* Menu */}
            < View style={menuStyle} >
                {
                    !isWeb ? (
                        <BlurView intensity={80} tint={isDarkMode ? 'dark' : 'light'} style={styles.blurContainer}>
                            <View style={containerStyle}>
                                {menuItems.map((item, index) => (
                                    <MenuItem
                                        key={item.label}
                                        icon={item.icon}
                                        label={item.label}
                                        onPress={() => handleItemPress(item.action)}
                                        isDarkMode={isDarkMode}
                                        danger={item.danger}
                                        isLast={index === menuItems.length - 1}
                                    />
                                ))}
                            </View>
                        </BlurView>
                    ) : (
                        <View style={[containerStyle, isWeb && { backdropFilter: 'blur(20px)' }]}>
                            {menuItems.map((item, index) => (
                                <MenuItem
                                    key={item.label}
                                    icon={item.icon}
                                    label={item.label}
                                    onPress={() => handleItemPress(item.action)}
                                    isDarkMode={isDarkMode}
                                    danger={item.danger}
                                    isLast={index === menuItems.length - 1}
                                />
                            ))}
                        </View>
                    )
                }
            </View >
        </>
    );
}

function MenuItem({ icon, label, onPress, isDarkMode, danger, isLast }) {
    const textColor = danger
        ? '#ef4444'
        : isDarkMode
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(15, 23, 42, 0.9)';

    const hoverBg = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.menuItem,
                pressed && { backgroundColor: hoverBg },
                !isLast && {
                    borderBottomWidth: 1,
                    borderBottomColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                }
            ]}
        >
            <Feather name={icon} size={18} color={textColor} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: textColor }]}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
    },
    blurContainer: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    menuIcon: {
        marginRight: 12,
    },
    menuLabel: {
        fontSize: 15,
        fontFamily: 'Outfit_500Medium',
        letterSpacing: 0.3,
    },
});

/** Purpose: UI component for individual chat message bubbles with theme support. */
import React, { useRef, useEffect, useState, memo } from "react";
import { View, Text, Pressable, Image, Animated, PanResponder, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { select, isWeb } from "../../utils/platform";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from 'expo-clipboard';
import { MediaVaultService } from "../../lib/media-vault-service";
import * as Sharing from 'expo-sharing';

const ACCOUNT_IMG = require('../../assets/account.webp');

const EphemeralPulsingIcon = ({ color }) => {
    const opacity = useRef(new Animated.Value(0.4)).current;
    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: !isWeb }),
                Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: !isWeb })
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);
    return (
        <Animated.View style={{ opacity, marginLeft: 4 }}>
            <MaterialCommunityIcons name="message-text-clock" size={12} color={color} />
        </Animated.View>
    );
};

const ReactionPill = ({ emoji, count, theme, isOwn }) => {
    const scale = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.sequence([
            Animated.spring(scale, { toValue: 1.2, friction: 4, tension: 40, useNativeDriver: !isWeb }),
            Animated.spring(scale, { toValue: 1.0, friction: 3, tension: 40, useNativeDriver: !isWeb })
        ]).start();
    }, [count, emoji]);

    return (
        <Animated.View style={{
            backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
            borderRadius: 10,
            paddingHorizontal: 5,
            paddingVertical: 2,
            marginRight: 3,
            marginBottom: 2,
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ scale }]
        }}>
            <Text style={{ fontSize: 11 }}>{emoji}</Text>
            {count > 1 && <Text style={{ fontSize: 9, color: isOwn ? 'rgba(255,255,255,0.9)' : theme.textSecondary, marginLeft: 2 }}>{count}</Text>}
        </Animated.View>
    );
};

const VaultMediaRenderer = ({ vaultId, theme, isOwn, mimeType = 'image/jpeg' }) => {
    const [decryptedUri, setDecryptedUri] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const isImage = mimeType?.startsWith('image/');

    useEffect(() => {
        let isMounted = true;
        const decryptMedia = async () => {
            try {
                const uri = await MediaVaultService.downloadMedia(vaultId);
                if (isMounted) {
                    setDecryptedUri(uri);
                    setLoading(false);
                }
            } catch (err) {
                console.error("[VaultRenderer] Decryption failed:", err);
                if (isMounted) {
                    setError(true);
                    setLoading(false);
                }
            }
        };
        decryptMedia();
        return () => { isMounted = false; };
    }, [vaultId]);

    const handleOpenDocument = async () => {
        if (!decryptedUri) return;
        try {
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(decryptedUri);
            } else {
                Alert.alert("Error", "No application available to open this file type.");
            }
        } catch (err) {
            console.error("[VaultRenderer] Failed to open document:", err);
            Alert.alert("Vault Error", "Could not open document safely.");
        }
    };

    if (loading) {
        return (
            <View style={{ width: 200, height: 100, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center', borderRadius: 12 }}>
                <ActivityIndicator color={isOwn ? '#fff' : theme.primary} />
                <Text style={{ color: isOwn ? '#fff' : theme.textSecondary, fontSize: 10, marginTop: 8, opacity: 0.7 }}>Unlocking Vault...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={{ width: 200, height: 100, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <Feather name="shield-off" size={24} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontSize: 10, marginTop: 8 }}>Vault Access Denied</Text>
            </View>
        );
    }

    if (isImage) {
        return (
            <View style={{ width: 200, height: 200, borderRadius: 12, overflow: 'hidden', marginVertical: 2 }}>
                <Image source={{ uri: decryptedUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 8 }}>
                    <Feather name="shield" size={12} color="#10B981" />
                </View>
            </View>
        );
    }

    // Document Renderer
    return (
        <Pressable 
            onPress={handleOpenDocument}
            style={({ pressed }) => ({
                width: 200,
                padding: 12,
                backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)',
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
                marginVertical: 4
            })}
        >
            <View style={{ 
                width: 40, 
                height: 40, 
                backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(59, 130, 246, 0.1)', 
                borderRadius: 8, 
                justifyContent: 'center', 
                alignItems: 'center',
                marginRight: 12
            }}>
                <Feather 
                    name={mimeType?.includes('pdf') ? "file-text" : "file"} 
                    size={20} 
                    color={isOwn ? '#fff' : theme.primary} 
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ 
                    color: isOwn ? '#fff' : theme.text, 
                    fontSize: 13, 
                    fontWeight: '600' 
                }}>
                    {mimeType?.split('/')[1]?.toUpperCase() || 'DOCUMENT'}
                </Text>
                <Text style={{ 
                    color: isOwn ? 'rgba(255,255,255,0.7)' : theme.textSecondary, 
                    fontSize: 11 
                }}>
                    Securely Encrypted
                </Text>
            </View>
            <Feather name="external-link" size={14} color={isOwn ? 'rgba(255,255,255,0.5)' : theme.textSecondary} />
        </Pressable>
    );
};

const MessageBubble = ({
    item,
    userUid,
    theme,
    otherUserPhoto,
    activeMenuId,
    setActiveMenuId,
    onLongPress,
    onRightClick,
    onToggleReaction,
    onReply,
    onAddReaction,
    onDelete,
    conversationId,
    displayName,
    isSelectionMode = false,
    isSelected = false,
    onSelectToggle = () => {}
}) => {
    if (item.hiddenFor && userUid && item.hiddenFor.includes(userUid)) return null;

    const isOwnMessage = userUid && item.senderId === userUid;
    const timeString = item.timestamp
        ? new Date(item.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : "";
    const isDeleted = item.isDeleted;

    // Modern theme-aware colors
    const ownBg = theme.sentMsg || '#fb7185';
    const receivedBg = theme.receivedMsg || '#E2E8F0';
    const ownText = '#FFFFFF';
    const receivedText = theme.text;
    const ownTimestamp = 'rgba(255,255,255,0.75)';
    const receivedTimestamp = theme.textSecondary;

    // Entrance animation: slide in from side + fade
    const entranceOpacity = useRef(new Animated.Value(0)).current;
    const entranceX = useRef(new Animated.Value(isOwnMessage ? 24 : -24)).current;
    const entranceY = useRef(new Animated.Value(8)).current;
    useEffect(() => {
        Animated.parallel([
            Animated.timing(entranceOpacity, { toValue: 1, duration: 200, useNativeDriver: !isWeb }),
            Animated.spring(entranceX, { toValue: 0, tension: 140, friction: 9, useNativeDriver: !isWeb }),
            Animated.spring(entranceY, { toValue: 0, tension: 140, friction: 9, useNativeDriver: !isWeb }),
        ]).start();
    }, []);

    // Swipe-to-reply gesture
    const swipeX = useRef(new Animated.Value(0)).current;
    const replyIconOpacity = useRef(new Animated.Value(0)).current;
    const SWIPE_THRESHOLD = 55;

    const panResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
            Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy * 2),
        onPanResponderMove: (_, g) => {
            const dx = Math.max(0, Math.min(g.dx, 90));
            swipeX.setValue(dx);
            replyIconOpacity.setValue(Math.min(dx / SWIPE_THRESHOLD, 1));
        },
        onPanResponderRelease: (_, g) => {
            if (g.dx >= SWIPE_THRESHOLD) {
                onReply({ id: item.id, text: item.encryptedText, senderName: isOwnMessage ? 'You' : displayName });
            }
            Animated.parallel([
                Animated.spring(swipeX, { toValue: 0, useNativeDriver: !isWeb, tension: 120, friction: 7 }),
                Animated.timing(replyIconOpacity, { toValue: 0, duration: 150, useNativeDriver: !isWeb })
            ]).start();
        },
        onPanResponderTerminate: () => {
            Animated.parallel([
                Animated.spring(swipeX, { toValue: 0, useNativeDriver: !isWeb }),
                Animated.timing(replyIconOpacity, { toValue: 0, duration: 150, useNativeDriver: !isWeb })
            ]).start();
        }
    })).current;

    return (
        <View style={[
            styles.messageRow,
            {
                justifyContent: isOwnMessage ? "flex-end" : "flex-start",
                zIndex: activeMenuId === item.id ? 1000 : 1,
                marginLeft: isOwnMessage ? 24 : 0,
                marginRight: isOwnMessage ? 0 : 28,
                paddingLeft: isOwnMessage ? 0 : 0,
            }
        ]} 
        {...(!isSelectionMode ? panResponder.panHandlers : {})}
        >
            {/* Selection Checkbox */}
            {isSelectionMode && (
                <Pressable 
                    onPress={onSelectToggle}
                    style={{
                        padding: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 10
                    }}
                >
                    <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.primary : theme.textSecondary,
                        backgroundColor: isSelected ? theme.primary : 'transparent',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        {isSelected && <Feather name="check" size={16} color="#000" />}
                    </View>
                </Pressable>
            )}

            {/* Reply hint icon */}
            <Animated.View style={{
                position: 'absolute',
                left: isOwnMessage ? undefined : 2,
                right: isOwnMessage ? 2 : undefined,
                opacity: replyIconOpacity,
                alignSelf: 'center',
                zIndex: 0
            }}>
                <Feather name="corner-up-left" size={18} color={theme.primary} />
            </Animated.View>

            {/* Avatar for received messages */}
            {!isOwnMessage && (
                <View style={styles.avatarSmall}>
                    <Image source={otherUserPhoto ? { uri: otherUserPhoto } : ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
            )}

            <Animated.View style={[
                { flexDirection: 'column', alignItems: isOwnMessage ? 'flex-end' : 'flex-start', maxWidth: '82%' },
                {
                    opacity: entranceOpacity,
                    transform: [
                        { translateX: Animated.add(swipeX, entranceX) },
                        { translateY: entranceY }
                    ]
                }
            ]}>
                <Pressable
                    onPress={isSelectionMode ? onSelectToggle : undefined}
                    onLongPress={!isSelectionMode ? (e) => onLongPress(item, e) : undefined}
                    onContextMenu={!isSelectionMode ? (e) => onRightClick(item, e) : undefined}
                    delayLongPress={200}
                    style={({ pressed }) => [
                        styles.bubble,
                        {
                            backgroundColor: isOwnMessage ? ownBg : receivedBg,
                            // Modern iMessage-style tails
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            borderBottomLeftRadius: isOwnMessage ? 20 : 5,
                            borderBottomRightRadius: isOwnMessage ? 5 : 20,
                            // Subtle shadow for depth
                            ...select({
                                ios: {
                                    shadowColor: isOwnMessage ? theme.sentMsg : '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: isOwnMessage ? 0.3 : 0.08,
                                    shadowRadius: 4,
                                },
                                android: { elevation: isOwnMessage ? 3 : 1 },
                                web: {
                                    boxShadow: isOwnMessage
                                        ? `0px 2px 8px ${theme.sentMsg}55`
                                        : '0px 1px 3px rgba(0,0,0,0.10)'
                                }
                            }),
                            opacity: pressed ? 0.92 : 1,
                        }
                    ]}
                >
                    {/* Reply Preview */}
                    {item.replyTo && (
                        <View style={{
                            backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                            padding: 8,
                            borderRadius: 10,
                            marginBottom: 6,
                            borderLeftWidth: 3,
                            borderLeftColor: isOwnMessage ? 'rgba(255,255,255,0.6)' : theme.primary
                        }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: isOwnMessage ? 'rgba(255,255,255,0.9)' : theme.primary }}>
                                {item.replyTo.senderName}
                            </Text>
                            <Text numberOfLines={1} style={{ fontSize: 12, color: isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.textSecondary }}>
                                {item.replyTo.text}
                            </Text>
                        </View>
                    )}

                    {/* Message Content */}
                    {item.type === 'image' ? (
                        <View style={{ width: 200, height: 200, borderRadius: 12, overflow: 'hidden', marginVertical: 2 }}>
                            <Image source={{ uri: item.encryptedText }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        </View>
                    ) : item.type === 'vault_media' ? (
                        <VaultMediaRenderer 
                            vaultId={item.encryptedText} 
                            theme={theme} 
                            isOwn={isOwnMessage} 
                            mimeType={item.mimeType}
                        />
                    ) : item.isLocked ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 }}>
                            <Feather name="lock" size={13} color={isOwnMessage ? 'rgba(255,255,255,0.7)' : theme.textSecondary} />
                            <Text style={[
                                styles.messageText,
                                {
                                    color: isOwnMessage ? 'rgba(255,255,255,0.65)' : theme.textSecondary,
                                    fontStyle: 'italic',
                                    fontSize: 13,
                                }
                            ]}>
                                Encrypted message
                            </Text>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Text style={[
                                styles.messageText,
                                {
                                    color: isOwnMessage ? ownText : receivedText,
                                    fontStyle: isDeleted ? 'italic' : (item.encryptedText && (item.encryptedText.includes('"dh":') || item.encryptedText.includes('"pqcPk":')) ? 'italic' : 'normal'),
                                    opacity: isDeleted ? 0.6 : 1,
                                    marginRight: 4,
                                    flexShrink: 1
                                }
                            ]}>
                                {isDeleted ? "🚫 Message deleted" : 
                                 (item.encryptedText && (item.encryptedText.includes('"dh":') || item.encryptedText.includes('"pqcPk":'))) ? 
                                 "🛡️ Initializing Quantum-Safe session..." : 
                                 item.encryptedText}
                                {item.isEdited && !isDeleted &&
                                    <Text style={{ fontSize: 10, opacity: 0.6 }}> · edited</Text>
                                }
                            </Text>
                            {item.ephemeralDuration > 0 && <EphemeralPulsingIcon color={isOwnMessage ? 'rgba(255,255,255,0.8)' : theme.primary} />}
                        </View>
                    )}

                    {/* Footer: reactions + time + status */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                        {/* Reactions */}
                        {item.reactions && Object.keys(item.reactions).length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
                                {Object.entries(item.reactions).map(([emoji, users]) => (
                                    <ReactionPill
                                        key={emoji}
                                        emoji={emoji}
                                        count={users.length}
                                        theme={theme}
                                        isOwn={isOwnMessage}
                                    />
                                ))}
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 4 }}>
                            <Text style={[styles.timeText, { color: isOwnMessage ? ownTimestamp : receivedTimestamp }]}>
                                {timeString}
                            </Text>

                            {isOwnMessage && !isDeleted && (
                                <MaterialCommunityIcons
                                    name={item.status === 'read' ? "check-all" : (item.status === 'delivered' ? "check-all" : "check")}
                                    size={14}
                                    color={item.status === 'read' ? "#60A5FA" : "rgba(255,255,255,0.6)"}
                                />
                            )}

                            {!isDeleted && !isOwnMessage && (
                                <Pressable hitSlop={10} onPress={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}>
                                    <Feather name="more-horizontal" size={14} color={theme.textSecondary} />
                                </Pressable>
                            )}
                        </View>
                    </View>
                </Pressable>

                {/* Context dropdown menu */}
                {activeMenuId === item.id && (
                    <View style={[
                        styles.contextMenu,
                        {
                            backgroundColor: theme.surface,
                            borderColor: theme.border,
                            right: isOwnMessage ? 0 : 'auto',
                            left: isOwnMessage ? 'auto' : 0,
                            bottom: '100%',
                            marginBottom: 6,
                            top: 'auto',
                        }
                    ]}>
                        {/* Quick Reactions */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            {['❤️', '😂', '😮', '😢', '👍', '🔥'].map(emoji => (
                                <Pressable key={emoji} onPress={() => { onToggleReaction(conversationId, item.id, userUid, emoji); setActiveMenuId(null); }}
                                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 1.3 : 1 }] })}>
                                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                                </Pressable>
                            ))}
                            <Pressable
                                onPress={() => { onAddReaction(item.id); setActiveMenuId(null); }}
                                style={{ backgroundColor: theme.background, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Feather name="plus" size={16} color={theme.textSecondary} />
                            </Pressable>
                        </View>

                        <Pressable onPress={() => { setActiveMenuId(null); onReply({ id: item.id, text: item.encryptedText, senderName: isOwnMessage ? "You" : displayName }); }}
                            style={({ pressed }) => ({ padding: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? theme.background : 'transparent' })}>
                            <Feather name="corner-up-left" size={15} color={theme.text} style={{ marginRight: 10 }} />
                            <Text style={{ color: theme.text, fontSize: 14 }}>Reply</Text>
                        </Pressable>

                        <Pressable onPress={() => { Clipboard.setStringAsync(item.encryptedText); setActiveMenuId(null); Alert.alert('Copied', 'Message copied to clipboard'); }}
                            style={({ pressed }) => ({ padding: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? theme.background : 'transparent' })}>
                            <Feather name="copy" size={15} color={theme.text} style={{ marginRight: 10 }} />
                            <Text style={{ color: theme.text, fontSize: 14 }}>Copy</Text>
                        </Pressable>

                        {!isDeleted && (
                            <Pressable onPress={() => { setActiveMenuId(null); if (onDelete) onDelete(item); }}
                                style={({ pressed }) => ({ padding: 10, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: pressed ? 'rgba(239,68,68,0.07)' : 'transparent' })}>
                                <Feather name="trash-2" size={15} color="#EF4444" style={{ marginRight: 10 }} />
                                <Text style={{ color: "#EF4444", fontSize: 14 }}>Delete</Text>
                            </Pressable>
                        )}
                    </View>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    messageRow: {
        flexDirection: "row",
        marginVertical: 3,
        marginHorizontal: 12,
        alignItems: "flex-end",
    },
    avatarSmall: {
        width: 26,
        height: 26,
        borderRadius: 13,
        marginRight: 2,
        marginBottom: 2,
        overflow: 'hidden',
        backgroundColor: '#CBD5E1',
    },
    bubble: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        maxWidth: "100%",
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '400',
    },
    timeText: {
        fontSize: 10,
        fontWeight: '500',
    },
    contextMenu: {
        position: 'absolute',
        borderRadius: 14,
        overflow: 'hidden',
        zIndex: 100,
        minWidth: 185,
        maxWidth: 240,
        borderWidth: 1,
        ...select({
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 8 },
            android: { elevation: 8 },
            web: { boxShadow: '0px -4px 16px rgba(0,0,0,0.15)' }
        }),
    }
});

export default memo(MessageBubble, (prevProps, nextProps) => {
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.encryptedText === nextProps.item.encryptedText &&
        prevProps.item.isLocked === nextProps.item.isLocked &&
        prevProps.item.status === nextProps.item.status &&
        prevProps.item.isDeleted === nextProps.item.isDeleted &&
        prevProps.item.reactions === nextProps.item.reactions &&
        prevProps.activeMenuId === nextProps.activeMenuId &&
        prevProps.theme === nextProps.theme &&
        prevProps.isSelectionMode === nextProps.isSelectionMode &&
        prevProps.isSelected === nextProps.isSelected
    );
});

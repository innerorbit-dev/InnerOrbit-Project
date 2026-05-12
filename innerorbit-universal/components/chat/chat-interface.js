/** Purpose: Main chat interface including message list, input area, and real-time updates. */
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, StyleSheet, Alert, Clipboard, Image, Modal, Keyboard, Animated } from "react-native";
import { Buffer } from "buffer";
import { isWeb, select } from "../../utils/platform";
import { useAuth } from "../../context/auth-context";
import { subscribeToMessages, sendMessage, getUserProfile, deleteConversation, updateMessage, deleteMessageForEveryone, deleteMessageForMe, markMessageAsRead, toggleMessageReaction, uploadChatImage, clearChatData, clearChatForMe, resetUnreadCount, updateConversationStealthMode, fetchV6PublicKeys } from "../../lib/firestore-service";
import { PresenceService } from "../../lib/presence-service";
import { getConversationSharedSecret } from "../../lib/ratchet-key-service";
import { useThemeStore } from "../../store/themeStore";
import { getSuggestions } from "../../lib/suggestion-service";
import { CustomImagePicker } from "../modals/CustomImagePicker";
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import {
    encrypt,
    encryptV4,
    encryptAsync,
    decryptAsync,
    deriveConversationKey,
    generateSafetyNumber,
    isEncrypted,
    resolveSendVersion,
    getRatchetSession,
    getV6Session
} from "../../lib/encryption";
import { hasKeyBackup, backupRatchetSession } from "../../lib/key-backup-service";
import { MediaVaultService } from "../../lib/media-vault-service";
import { ENC_VERSION_VAULT_V1 } from "../../lib/encryption-core";
import PinRecoveryModal from "../modals/PinRecoveryModal";
import { SafetyNumberModal } from "../modals/SafetyNumberModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { StatusBar } from "expo-status-bar";
import { useAppTheme } from "../../store/themeStore";
import { LoadingDots } from "../ui/loading-dots";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import MessageBubble from "./message-bubble";
import { Logger } from "../../lib/logger";
import MessageContextMenu from "./message-context-menu";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ScreenCapture from 'expo-screen-capture';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StealthKeyboard } from "../../keyboard-extension/StealthKeyboard";
import { useCall } from "../../context/call-context";


// Default Avatar
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

const ScheduledMessagesBar = ({ messages, onCancel, theme, isDark }) => {
    if (messages.length === 0) return null;
    return (
        <View style={{
            backgroundColor: 'transparent',
            paddingVertical: 6,
            paddingHorizontal: 12
        }}>
            {messages.map(msg => (
                <View key={msg.id} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
                    <MaterialCommunityIcons name="clock-fast" size={14} color={theme.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 11, fontStyle: 'italic' }}>
                            Sending: {msg.encryptedText}
                        </Text>
                    </View>
                    <Pressable onPress={() => onCancel(msg.id)} style={{ padding: 4 }}>
                        <Feather name="x-circle" size={14} color="#EF4444" />
                    </Pressable>
                </View>
            ))}
        </View>
    );
};

const SuggestionsBar = ({ lastMessage, onSelect, theme, isDark }) => {

    // Only show suggestions for native mobile/desktop platforms, not web browser
    if (isWeb && !window.electron) return null;
    if (!lastMessage || lastMessage.isMe) return null;

    const suggestions = getSuggestions(lastMessage.text);

    return (
        <View style={{
            backgroundColor: 'transparent',
            paddingVertical: 8,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderTopWidth: 1,
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'
        }}>
            <FlatList
                horizontal
                data={suggestions}
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                    <Pressable
                        onPress={() => onSelect(item)}
                        style={({ pressed }) => ({
                            backgroundColor: pressed ? theme.primary : 'rgba(219, 87, 11, 0.12)',
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 16,
                            marginRight: 8,
                            borderWidth: 1,
                            borderColor: theme.primary + '33'
                        })}
                    >
                        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }}>{item}</Text>
                    </Pressable>
                )}
            />
        </View>
    );
};

const ACCOUNT_IMG = require('../../assets/account.webp');

const ReactionPill = ({ emoji, count, theme }) => {
    const scale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pop animation sequence
        Animated.sequence([
            Animated.spring(scale, {
                toValue: 1.2,
                friction: 4,
                tension: 40,
                useNativeDriver: !isWeb
            }),
            Animated.spring(scale, {
                toValue: 1.0,
                friction: 3,
                tension: 40,
                useNativeDriver: !isWeb
            })
        ]).start();
    }, [count, emoji]);

    return (
        <Animated.View style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 6,
            paddingHorizontal: 4,
            paddingVertical: 0.5,
            marginRight: 2,
            marginBottom: 1,
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ scale }]
        }}>
            <Text style={{ fontSize: 10 }}>{emoji}</Text>
            <Text style={{ fontSize: 8, color: theme.text, marginLeft: 1 }}>{count}</Text>
        </Animated.View>
    );
};

const WheelPicker = ({ data, selectedValue, onValueChange, theme, height = 150 }) => {
    const itemHeight = 40;
    const flatListRef = useRef(null);

    const onScroll = (event) => {
        const y = event.nativeEvent.contentOffset.y;
        const index = Math.round(y / itemHeight);
        if (data[index] !== undefined && data[index] !== selectedValue) {
            onValueChange(data[index]);
        }
    };

    const getItemLayout = (_, index) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
    });

    return (
        <View style={{ height, width: 60, overflow: 'hidden' }}>
            <FlatList
                ref={flatListRef}
                data={data}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                    <View style={{ height: itemHeight, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{
                            color: item === selectedValue ? theme.primary : theme.textSecondary,
                            fontSize: item === selectedValue ? 18 : 14,
                            fontWeight: item === selectedValue ? 'bold' : 'normal',
                            opacity: item === selectedValue ? 1 : 0.4
                        }}>
                            {item < 10 ? `0${item} ` : item}
                        </Text>
                    </View>
                )}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate="fast"
                onMomentumScrollEnd={onScroll}
                getItemLayout={getItemLayout}
                initialScrollIndex={data.indexOf(selectedValue)}
                contentContainerStyle={{ paddingVertical: (height - itemHeight) / 2 }}
            />
            <View style={{
                position: 'absolute',
                top: (height - itemHeight) / 2,
                left: 0,
                right: 0,
                height: itemHeight,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: 'rgba(219, 87, 11, 0.2)',
                pointerEvents: 'none'
            }} />
        </View>
    );
};

const TimerPickerModal = ({ visible, onClose, onSave, mode, theme, isDark }) => {
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(0);
    const [days, setDays] = useState(0);

    const hourData = Array.from({ length: 24 }, (_, i) => i);
    const minuteData = Array.from({ length: 60 }, (_, i) => i);
    const dayData = Array.from({ length: 31 }, (_, i) => i);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
                <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={{
                    width: '85%',
                    backgroundColor: isDark ? 'rgba(10, 2, 5, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 24,
                    padding: 24,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
                }}>
                    <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
                        {mode === 'schedule' ? 'Set Sending Time' : 'Set Ghost Timer'}
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 }}>
                        {mode === 'schedule' && (
                            <>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 10, marginBottom: 4 }}>DAYS</Text>
                                    <WheelPicker data={dayData} selectedValue={days} onValueChange={setDays} theme={theme} />
                                </View>
                                <Text style={{ color: theme.primary, fontSize: 18, marginHorizontal: 8, marginTop: 15 }}>:</Text>
                            </>
                        )}
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 10, marginBottom: 4 }}>HOURS</Text>
                            <WheelPicker data={hourData} selectedValue={hours} onValueChange={setHours} theme={theme} />
                        </View>
                        <Text style={{ color: theme.primary, fontSize: 18, marginHorizontal: 8, marginTop: 15 }}>:</Text>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 10, marginBottom: 4 }}>MINS</Text>
                            <WheelPicker data={minuteData} selectedValue={minutes} onValueChange={setMinutes} theme={theme} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Pressable onPress={onClose} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
                            <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                const totalSeconds = (days * 86400) + (hours * 3600) + (minutes * 60);
                                onSave(totalSeconds);
                                onClose();
                            }}
                            style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 12, padding: 12, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Set Timer</Text>
                        </Pressable>
                    </View>
                </BlurView>
            </View>
        </Modal>
    );
};

export function ChatInterface({
    conversationId, onBack, isMobile, nickname, onRename, otherUserUid,
    privacyLevel = 0, isStealth = false, hideHeader = false, containerStyle = {}
}) {
    const { user } = useAuth();
    const { theme: THEME, isDark, chatBgStyle } = useAppTheme();
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [otherUserId, setOtherUserId] = useState("");
    const [encryptionKey, setEncryptionKey] = useState(null);
    const [safetyNumber, setSafetyNumber] = useState("");
    const [showSafetyNumber, setShowSafetyNumber] = useState(false);
    const [showSafetyModal, setShowSafetyModal] = useState(false);
    const [presence, setPresence] = useState(null); // { isOnline, lastSeen }
    const [otherUserPhoto, setOtherUserPhoto] = useState(null);
    const [otherUserBio, setOtherUserBio] = useState("");
    const [otherUserDisplayName, setOtherUserDisplayName] = useState("");
    const [remoteEncryptionCapabilities, setRemoteEncryptionCapabilities] = useState(null);
    const router = useRouter();

    const [showMenu, setShowMenu] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [showStealthModal, setShowStealthModal] = useState(false);
    const [showClearChatModal, setShowClearChatModal] = useState(false);
    const [includesImages, setIncludesImages] = useState(true);
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [useStealthKeyboard, setUseStealthKeyboard] = useState(false);
    const [myKeys, setMyKeys] = useState(null);
    const [theirKeys, setTheirKeys] = useState(null);
    const [showPinRecovery, setShowPinRecovery] = useState(false);
    const { sessionPin } = useAuth();
    
    // Multi-select state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState(new Set());
    
    const { startCall } = useCall();
    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const [partnerProfileKey, setPartnerProfileKey] = useState(null);
    const [sharedSecretStr, setSharedSecretStr] = useState(null);


    const confirmToggleCapture = async () => {
        setIsCaptureBlocked(!isCaptureBlocked);
        setShowStealthModal(false);
    };

    useEffect(() => {
        if (!isWeb) {
            // Force hardware-level screenshot/recording block
            ScreenCapture.preventScreenCaptureAsync();

            // Listen for any attempted screenshots (primarily for iOS alerts)
            const subscription = ScreenCapture.addScreenshotListener(() => {
                Alert.alert(
                    "🔒 Privacy Protected",
                    "Screenshots and screen recordings are strictly disabled within InnerOrbit chats to prevent metadata leakage and unauthorized message persistence."
                );
                Logger.warn("[Security] User attempted a screenshot in chat.");
            });

            return () => {
                ScreenCapture.allowScreenCaptureAsync();
                subscription.remove();
            };
        }
    }, []);

    useEffect(() => {
        let debounceTimer = null;

        const handleKeyboardShow = (e) => {
            clearTimeout(debounceTimer);
            Logger.log('🎹 Keyboard SHOW - Setting keyboardVisible to TRUE');
            setKeyboardHeight(e?.endCoordinates?.height || 0);
            setKeyboardVisible(true);
        };

        const handleKeyboardHide = () => {
            Logger.log('🎹 Keyboard HIDE - Setting keyboardVisible to FALSE');
            setKeyboardHeight(0);
            setKeyboardVisible(false);
        };

        const showSubscription = Keyboard.addListener(
            select({ ios: 'keyboardWillShow', default: 'keyboardDidShow' }),
            handleKeyboardShow
        );
        const hideSubscription = Keyboard.addListener(
            select({ ios: 'keyboardWillHide', default: 'keyboardDidHide' }),
            handleKeyboardHide
        );

        return () => {
            clearTimeout(debounceTimer);
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);
    const [replyingTo, setReplyingTo] = useState(null); // { id, text, senderName }
    const [scheduledDelay, setScheduledDelay] = useState(0); // 0 (Off), 5, 3600, 86400
    const [ephemeralDuration, setEphemeralDuration] = useState(0); // 0 (Off), 5, 30, 60...
    const [scheduledMessages, setScheduledMessages] = useState([]); // Currently scheduled messages for this user
    const [timerModalVisible, setTimerModalVisible] = useState(false);
    const [timerModalMode, setTimerModalMode] = useState('schedule'); // 'schedule' or 'ephemeral'
    const [isCaptureBlocked, setIsCaptureBlocked] = useState(false);
    const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
    const [reactionMessageId, setReactionMessageId] = useState(null);
    const [clearedAt, setClearedAt] = useState(0);
    const [contextMenu, setContextMenu] = useState({ visible: false, position: { x: 0, y: 0 }, message: null });
    const insets = useSafeAreaInsets();
    const flatListRef = useRef(null);

    // Screenshot Detection & Prevention
    useEffect(() => {
        if (!isWeb) {
            ScreenCapture.allowScreenCaptureAsync();
            return;
        }

        // Enable blocking (Android) / detection (iOS)
        const setupProtection = async () => {
            if (isWeb) return;
            await ScreenCapture.preventScreenCaptureAsync();

            // Listener for when screenshot is taken (iOS mainly, or if blocking fails)
            const subscription = ScreenCapture.addScreenshotListener(() => {
                Alert.alert("Stealth Alert", "A screenshot was taken!");
                // Here we could also send a system message
            });
            return subscription;
        };

        const subscriptionPromise = setupProtection();

        const handleKeyDown = (e) => {
            // Check for PrintScreen or common screenshot shortcuts (Web)
            if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
                Alert.alert("Stealth Alert", "A screenshot attempt was detected!");
            }
        };

        if (isWeb) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            if (!isWeb) ScreenCapture.allowScreenCaptureAsync();
            subscriptionPromise
                .then(sub => sub?.remove())
                .catch(e => console.warn("[ChatInterface] ScreenCapture cleanup error:", e));
            if (isWeb) window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isCaptureBlocked]);

    // Reset state when conversation changes
    useEffect(() => {
        setMessages([]);
        setOtherUserId("");
        setEncryptionKey(null);
        setEncryptionKey(null);
        setClearedAt(0);
        setLoading(true);
    }, [conversationId]);

    // State for target user UID (manages missing prop)
    const [targetUid, setTargetUid] = useState(otherUserUid);

    // Sync prop to state
    useEffect(() => {
        if (otherUserUid) setTargetUid(otherUserUid);
    }, [otherUserUid]);

    // Fetch conversation participants and derive encryption key
    useEffect(() => {
        const fetchConversationData = async () => {
            if (!conversationId || typeof conversationId !== "string" || !user) {
                setLoading(false);
                return;
            }
            try {
                const convRef = doc(db, "conversations", conversationId);
                const convSnap = await getDoc(convRef);
                if (convSnap.exists()) {
                    const convData = convSnap.data();
                    const participantIds = convData.participantIds || [];

                    // Set clearedAt timestamp for filtering
                    const userClearedAt = convData[`clearedAt_${user.uid}`]?.toMillis ? convData[`clearedAt_${user.uid}`].toMillis() : (convData[`clearedAt_${user.uid}`] || 0);
                    setClearedAt(userClearedAt);

                    // Derive shared encryption key for this conversation
                    if (participantIds.length >= 2) {
                        const key = deriveConversationKey(conversationId, participantIds);
                        Logger.log(`[ChatInterface] 🔑 Key derived: conv=${conversationId.substring(0, 5)}, pIds=${JSON.stringify(participantIds.map(p => p.substring(0, 5)))}, skPrefix=${key.substring(0, 8)}`);
                        setEncryptionKey(key);

                        // Generate safety number
                        const safetyNum = await generateSafetyNumber(conversationId, participantIds);
                        setSafetyNumber(safetyNum);
                    }

                    // Get other user's display ID
                    const foundUid = participantIds.find((id) => id !== user?.uid);
                    if (foundUid) {
                        setTargetUid(foundUid); // <--- SELF-HEAL MISSING PROP

                        // 🛡️ Initialize Double Ratchet sessions (v4 & v6 Invisible Handshaking)
                        import("../../lib/ratchet-key-service").then(async (svc) => {
                            const activePin = sessionPin || user?.pin;
                            
                            // 🔄 Dedicated Auto Recovery Orchestrator
                            const { ensureSessionWithAutoRecovery } = await import("../../lib/auto-recovery-service");
                            const status = await ensureSessionWithAutoRecovery(conversationId, user, foundUid, activePin, svc);
                            
                            if (status === "NEEDS_PIN") {
                                setShowPinRecovery(true);
                            }

                            // Quantum-Safe v6
                            svc.initializeV6IfNeeded(conversationId, user.uid, foundUid)
                                .then(async () => {
                                    // Fetch keys for the safety number
                                    const v6Session = await getV6Session(conversationId);
                                    if (v6Session) {
                                        setMyKeys({
                                            identity: user.uid,
                                            dh: v6Session.dhKeyPair.publicKey.toString('base64'),
                                            pqc: Buffer.from(v6Session.ownPqcKeyPair.publicKey).toString('base64')
                                        });
                                        setTheirKeys({
                                            identity: foundUid,
                                            dh: v6Session.remoteDhPublicKey.toString('base64'),
                                            pqc: Buffer.from(v6Session.remotePqcPublicKey).toString('base64')
                                        });
                                    }
                                })
                                .catch(err => Logger.warn(`[Ratchet-v6] Init failed:`, err));
                        });
                        
                        try {
                            const otherUserProfile = await getUserProfile(foundUid);
                            setOtherUserId(otherUserProfile?.userId || "????");
                            if (otherUserProfile?.photoURL) {
                                setOtherUserPhoto(otherUserProfile.photoURL);
                            }
                            if (otherUserProfile?.bio) {
                                setOtherUserBio(otherUserProfile.bio);
                            }
                            if (otherUserProfile?.displayName) {
                                setOtherUserDisplayName(otherUserProfile.displayName);
                            }
                            if (otherUserProfile?.encryptionCapabilities) {
                                setRemoteEncryptionCapabilities(otherUserProfile.encryptionCapabilities);
                            } else {
                                setRemoteEncryptionCapabilities(null);
                            }
                        } catch (e) {
                            setOtherUserId("????");
                            setRemoteEncryptionCapabilities(null);
                        }
                    }
                }
            } catch (error) {
                Logger.error("Error fetching conversation data:", error);
                setOtherUserId("????");
            }
        };
        if (conversationId) fetchConversationData();
    }, [conversationId, user]);

    // Reset unread badge immediately when conversation is opened
    useEffect(() => {
        if (conversationId && user?.uid) {
            resetUnreadCount(conversationId, user.uid);
        }
    }, [conversationId, user?.uid]);

    // Fetch Partner Profile Key AND share own key using stable identity-linked secret
    useEffect(() => {
        const initPresenceKeys = async () => {
            if (!targetUid || !conversationId || !user) return;
            const participantIds = [user.uid, targetUid];
            // Always share our own profile key so partner can see our presence
            PresenceService.shareProfileKeyWithPartner(conversationId, participantIds).catch(() => {});
            const pKey = await PresenceService.getPartnerProfileKey(conversationId, participantIds, targetUid);
            if (pKey) setPartnerProfileKey(pKey);
        };
        initPresenceKeys();
    }, [targetUid, conversationId, user]);

    // Subscribe to Other User's Presence (encrypted if key available, raw fallback otherwise)
    useEffect(() => {
        if (!targetUid) return;
        if (partnerProfileKey) {
            // Encrypted presence via profile key
            const unsubscribe = PresenceService.subscribeToPartnerPresence(targetUid, partnerProfileKey, (data) => {
                // data is { isOnline: boolean, lastSeen: string | null } | null
                // Use the raw Firestore isOnline boolean — never infer it from blob presence.
                if (data) {
                    setPresence({ isOnline: data.isOnline === true, lastSeen: data.lastSeen });
                } else {
                    setPresence(null);
                }
            });
            return unsubscribe;
        } else {
            // Fallback: raw publicProfiles fields (unencrypted isOnline + lastSeen)
            const unsubscribe = PresenceService.subscribeToRawPresence(targetUid, (data) => {
                if (data) {
                    setPresence({ isOnline: data.isOnline, lastSeen: data.lastSeen });
                } else {
                    setPresence(null);
                }
            });
            return unsubscribe;
        }
    }, [targetUid, partnerProfileKey]);

    // Subscribe to Partner's Typing Status using stable identity-linked secret
    useEffect(() => {
        if (!conversationId || !user || !targetUid) return;
        const participantIds = [user.uid, targetUid];
        const unsubscribe = PresenceService.subscribeToTyping(conversationId, participantIds, (isTyping) => {
            setIsPartnerTyping(isTyping);
        });
        return unsubscribe;
    }, [conversationId, user, targetUid]);

    // Update My Typing Status using stable identity-linked secret
    useEffect(() => {
        if (!conversationId || !user || !targetUid) return;
        const participantIds = [user.uid, targetUid];
        const isTyping = messageText.length > 0;
        PresenceService.setTypingStatus(conversationId, participantIds, isTyping).catch(() => {});
        
        // Auto-clear typing status after 5 seconds if no input
        let timer;
        if (isTyping) {
            timer = setTimeout(() => {
                PresenceService.setTypingStatus(conversationId, participantIds, false).catch(() => {});
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [messageText, conversationId, user, targetUid]);


    const scrollTimerRef = useRef(null);
    const isMounted = useRef(true);

    // Lifecycle cleanup
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (scrollTimerRef.current) {
                clearTimeout(scrollTimerRef.current);
            }
        };
    }, []);

    // Subscribe to messages
    useEffect(() => {
        if (!conversationId || typeof conversationId !== "string" || !encryptionKey) return;

        const unsubscribe = subscribeToMessages(conversationId, (msgs) => {
            if (!isMounted.current) return;

            const now = Date.now();
            const visible = [];
            const scheduled = [];

            msgs.forEach(m => {
                // Filter hidden messages
                if (m.hiddenFor && user?.uid && m.hiddenFor.includes(user.uid)) return;

                // Filter expired messages
                if (m.expiresAt && now > (m.expiresAt.toMillis ? m.expiresAt.toMillis() : m.expiresAt)) return;

                // Filter future scheduled messages
                if (m.scheduledAt && now < (m.scheduledAt.toMillis ? m.scheduledAt.toMillis() : m.scheduledAt)) {
                    if (m.senderId === user?.uid) {
                        scheduled.push(m);
                    }
                    return;
                }

                // Filter messages cleared by the user locally
                const msgTime = m.timestamp?.toMillis ? m.timestamp.toMillis() : (m.timestamp || 0);
                if (msgTime <= clearedAt) return;

                visible.push(m);
            });

            const getMessageVersion = (msg) => {
                if (msg?.encVersion) return msg.encVersion;
                const cipher = msg?.encryptedText || "";
                if (cipher.startsWith("v6:")) return "v6";
                if (cipher.startsWith("v5:")) return "v5";
                if (cipher.startsWith("v4:")) return "v4";
                if (cipher.startsWith("v3:")) return "v3";
                if (cipher.startsWith("v2:")) return "v2";
                return "legacy";
            };

            const processMessages = async () => {
                const decryptedMessages = await Promise.all(visible.map(async (msg) => {
                    try {
                        if (!msg.encryptedText) {
                            return { ...msg, encryptedText: "..." };
                        }

                        if (!isEncrypted(msg.encryptedText)) {
                            return { ...msg, encryptedText: msg.encryptedText };
                        }

                        const decrypted = await decryptAsync(
                            msg.encryptedText,
                            encryptionKey,
                            conversationId,
                            undefined, // pqcSecretKey
                            user?.uid,
                            targetUid,
                            msg.id,
                            isStealth
                        );

                        let text = decrypted;
                        let recoveredSenderId = msg.senderId;

                        if (decrypted && typeof decrypted === 'object' && decrypted.text) {
                            // decryptAsync returned a sealed-sender object {text, senderId}
                            text = decrypted.text;
                            recoveredSenderId = decrypted.senderId;
                        } else if (typeof decrypted === 'string' && decrypted.startsWith('{"s":')) {
                            // GCM recovery returned the raw sealed-sender JSON string — parse it
                            try {
                                const parsed = JSON.parse(decrypted);
                                if (parsed.m) { text = parsed.m; recoveredSenderId = parsed.s || msg.senderId; }
                            } catch (_) { /* leave text as-is */ }
                        }

                        // 🔍 DEBUG: log version + decrypted result before guard
                        const vPrefix = msg.encryptedText?.split?.(':')?.[0] ?? 'unknown';
                        Logger.log(`[ChatInterface] 🔍 decrypt result | version=${vPrefix} | encVersion=${msg.encVersion ?? 'none'} | type=${typeof text} | isEmpty=${!text} | startsLock=${typeof text === 'string' && text.startsWith('\uD83D\uDD12')} | preview=${typeof text === 'string' ? text.substring(0,30) : JSON.stringify(text)?.substring(0,30)}`);

                        // Guard: if decryption returned null or a raw failure indicator, lock the bubble
                        if (!text || (typeof text === 'string' && text.startsWith('\uD83D\uDD12'))) {
                            return { ...msg, encryptedText: null, isLocked: true };
                        }

                        const finalMsg = { ...msg, encryptedText: text, senderId: recoveredSenderId || msg.senderId };

                        // 🕶️ Mark as read ONLY if we are sure it's from the other person
                        if (finalMsg.senderId && finalMsg.senderId !== user?.uid && finalMsg.status !== 'read') {
                            markMessageAsRead(conversationId, finalMsg.id);
                        }

                        return finalMsg;
                    } catch (error) {
                        return { ...msg, encryptedText: null, isLocked: true };
                    }
                }));

                if (isMounted.current) {
                    setMessages(decryptedMessages);
                    if (user?.uid && msgs.length > 0) {
                        resetUnreadCount(conversationId, user.uid);
                    }

                    const decryptedScheduled = await Promise.all(scheduled.map(async (msg) => {
                        try {
                            const decrypted = await decryptAsync(msg.encryptedText, encryptionKey, conversationId);
                            let text = (decrypted && typeof decrypted === 'object' && decrypted.text) ? decrypted.text : decrypted;
                            if (!text || (typeof text === 'string' && text.startsWith('\uD83D\uDD12'))) {
                                return { ...msg, encryptedText: null, isLocked: true };
                            }
                            return { ...msg, encryptedText: text };
                        } catch (e) {
                            return { ...msg, encryptedText: null, isLocked: true };
                        }
                    }));
                    setScheduledMessages(decryptedScheduled);
                }
            };

            processMessages();
            setLoading(false);

            // Short delay ensuring layout complete
            if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
            scrollTimerRef.current = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        return unsubscribe;
    }, [conversationId, encryptionKey]);

    // Real-time cleanup for expiring messages in state
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setMessages(prev => prev.filter(msg => {
                if (msg.expiresAt) {
                    const exp = msg.expiresAt?.toMillis ? msg.expiresAt.toMillis() : (msg.expiresAt || 0);
                    return exp > now;
                }
                if (msg.scheduledAt) {
                    const sched = msg.scheduledAt?.toMillis ? msg.scheduledAt.toMillis() : (msg.scheduledAt || 0);
                    return sched <= now;
                }
                return true;
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleSendMessage = async () => {
        if (!messageText.trim() || !user || !conversationId || !encryptionKey) return;
        try {
            setSending(true);
            const hasLocalRatchetSession = !!(await getRatchetSession(conversationId));
            const hasV6Session = !!(await getV6Session(conversationId));

            const sendPolicy = resolveSendVersion({
                localCapabilities: { v5: true, v5_5: true, v6: true, minReadable: 1, maxWritable: 6 },
                remoteCapabilities: remoteEncryptionCapabilities,
                hasLocalRatchetSession,
                hasV6Session
            });

            let encryptedText;
            let encVersion;

            if (sendPolicy.version === "v6") {
                try {
                    // Sealed v6
                    encryptedText = await encryptV6(conversationId, JSON.stringify({ s: user?.uid, m: messageText, t: Date.now() }));
                    encVersion = "v6";
                } catch (v6Error) {
                    Logger.warn(`[ChatInterface] v6_send_failed fallback=v5.5 reason=${v6Error?.message}`);
                    encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v5.5", user?.uid);
                    encVersion = "v5.5";
                }
            } else if (sendPolicy.version === "v5.5") {
                encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v5.5", user?.uid);
                encVersion = "v5.5";
            } else if (sendPolicy.version === "v5") {
                encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v5", user?.uid);
                encVersion = "v5";
            } else if (sendPolicy.version === "v4") {
                try {
                    // Sealed v4
                    encryptedText = await encryptV4(conversationId, JSON.stringify({ s: user?.uid, m: messageText, t: Date.now() }));
                    encVersion = "v4";
                } catch (v4Error) {
                    Logger.warn(`[ChatInterface] v4_send_failed conv=${conversationId?.substring(0, 5)} fallback=v3 reason=${v4Error?.message || "unknown"}`);
                    encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v3", user?.uid);
                    encVersion = "v3";
                }
            } else if (sendPolicy.version === "v3") {
                encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v3", user?.uid);
                encVersion = "v3";
            } else if (sendPolicy.version === "v2") {
                encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v2", user?.uid);
                encVersion = "v2";
            } else {
                encryptedText = await encryptAsync(messageText, encryptionKey, undefined, conversationId, "v2", user?.uid);
                encVersion = "v2";
            }
            
            if (sendPolicy.version === "legacy") {
                Logger.error(`[ChatInterface] 🚨 Policy Violation: resolveSendVersion returned legacy! Forced upgrade to v2.`);
            }

            if (editingMessage) {
                // Update existing message
                await updateMessage(conversationId, editingMessage.id, { encryptedText, encVersion });
                setEditingMessage(null);
            } else {
                // Send new with optional reply threading and advanced controls
                await sendMessage(conversationId, user?.uid, encryptedText, replyingTo, scheduledDelay, 'text', ephemeralDuration, { encVersion });
                setReplyingTo(null);
                setScheduledDelay(0);
                setEphemeralDuration(0);
            }
            setMessageText("");
        } catch (error) {
            Logger.error("Error sending message:", error);
            if (error?.message === "CHAT_SERVICE_UNAVAILABLE") {
                Alert.alert(
                    "Service Unavailable",
                    "Chat services are temporarily unavailable right now. Please wait while we restore the service.",
                    [{ text: "Got it" }]
                );
            } else {
                Alert.alert("Failed", "Could not send message. Please check your connection.");
            }
        } finally {
            setSending(false);
        }
    };

    const handlePickImage = () => {
        Alert.alert(
            "Secure Media Vault",
            "Select the type of content to encrypt and send.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "📷 Image / Photo", 
                    onPress: () => setIsPickerVisible(true) 
                },
                { 
                    text: "📄 Document / Screenshot", 
                    onPress: handlePickDocument 
                }
            ]
        );
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
                    'application/msword', // doc
                    'text/plain',
                    'image/*' // Screenshots are often picked as files too
                ],
                copyToCacheDirectory: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                handleSelectDocument(result.assets[0]);
            }
        } catch (err) {
            Logger.error("Error picking document:", err);
            Alert.alert("Error", "Failed to select document.");
        }
    };

    const handleSelectDocument = async (asset) => {
        try {
            setSending(true);
            Logger.log("[MediaVault] Processing document for vault upload:", asset.uri);

            if (!targetUid) throw new Error("RECIPIENT_UNKNOWN");

            const v6Keys = await fetchV6PublicKeys(targetUid);
            if (!v6Keys || !v6Keys.pqc) {
                Alert.alert("Security Restriction", "Recipient must have Quantum-Safe keys enabled to receive encrypted documents.");
                setSending(false);
                return;
            }

            const pqcPublicKey = Buffer.from(v6Keys.pqc, 'base64');
            const vaultId = await MediaVaultService.uploadMedia(
                asset.uri,
                conversationId,
                user?.uid,
                pqcPublicKey,
                asset.mimeType || 'application/octet-stream'
            );

            await sendMessage(conversationId, user?.uid, vaultId, replyingTo, scheduledDelay, 'vault_media', ephemeralDuration, {
                encVersion: ENC_VERSION_VAULT_V1,
                mimeType: asset.mimeType
            });

            setScheduledDelay(0);
            setEphemeralDuration(0);
            setReplyingTo(null);
        } catch (error) {
            Logger.error("Error processing/uploading document:", error);
            if (error?.message?.includes("100MB")) {
                Alert.alert("Size Limit", "Files must be smaller than 100MB to preserve storage quotas.");
            } else if (error?.message?.includes("not allowed")) {
                Alert.alert("Format Blocked", "This file type is not supported for security reasons.");
            } else {
                Alert.alert("Vault Error", "Secure document upload failed.");
            }
        } finally {
            setSending(false);
        }
    };

    const handleSelectImage = async (asset) => {
        setIsPickerVisible(false);
        try {
            setSending(true);

            // 1. Process/Compress Image
            Logger.log("[MediaVault] Processing image for vault upload:", asset.uri);
            const manipulatedImage = await ImageManipulator.manipulateAsync(
                asset.uri,
                [{ resize: { width: 1200 } }], 
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            // 2. Resolve Recipient PQC Public Key
            // We need this for the 3-layer vault encryption
            if (!targetUid) throw new Error("RECIPIENT_UNKNOWN");
            
            const v6Keys = await fetchV6PublicKeys(targetUid);
            if (!v6Keys || !v6Keys.pqc) {
                Logger.warn("[MediaVault] Recipient missing PQC keys. Falling back to legacy upload.");
                const imageUrl = await uploadChatImage(manipulatedImage.uri, conversationId);
                await sendMessage(conversationId, user?.uid, imageUrl, replyingTo, scheduledDelay, 'image', ephemeralDuration);
            } else {
                // 3. Upload via Secure Media Vault
                const pqcPublicKey = Buffer.from(v6Keys.pqc, 'base64');
                const vaultId = await MediaVaultService.uploadMedia(
                    manipulatedImage.uri,
                    conversationId,
                    user?.uid,
                    pqcPublicKey,
                    'image/jpeg'
                );

                // 4. Send Message with Vault ID
                await sendMessage(conversationId, user?.uid, vaultId, replyingTo, scheduledDelay, 'vault_media', ephemeralDuration, {
                    encVersion: ENC_VERSION_VAULT_V1,
                    mimeType: 'image/jpeg'
                });
            }

            setScheduledDelay(0);
            setEphemeralDuration(0);
            setReplyingTo(null);
        } catch (error) {
            Logger.error("Error processing/uploading vault media:", error);
            Alert.alert("Vault Error", "Secure upload failed. Please check your connection.");
        } finally {
            setSending(false);
        }
    };

    const handleDelete = (message) => {
        setActiveMenuId(null);
        Alert.alert(
            "Delete Message",
            "Choose an option",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete for Me",
                    onPress: async () => {
                        await deleteMessageForMe(conversationId, message.id, user?.uid);
                    }
                },
                // Only show "Delete for Everyone" if user is sender
                ...(message.senderId === user?.uid ? [{
                    text: "Delete for Everyone",
                    style: 'destructive',
                    onPress: async () => {
                        await deleteMessageForEveryone(conversationId, message.id);
                    }
                }] : [])
            ]
        );
    };

    // Context Menu Handlers
    const handleMessageRightClick = (message, event) => {
        if (isWeb) {
            event.preventDefault();
            setContextMenu({
                visible: true,
                position: { x: event.pageX, y: event.pageY },
                message
            });
            setActiveMenuId(null);
        }
    };

    const handleMessageLongPress = (message, event) => {
        const x = event?.nativeEvent?.pageX || event?.nativeEvent?.locationX || 100;
        const y = event?.nativeEvent?.pageY || event?.nativeEvent?.locationY || 100;
        setContextMenu({
            visible: true,
            position: { x, y },
            message
        });
        setActiveMenuId(null);
    };

    const handleCopyText = () => {
        if (contextMenu.message) {
            Clipboard.setString(contextMenu.message.encryptedText);
            Alert.alert('Copied', 'Message copied to clipboard');
        }
    };

    const handlePin = async () => {
        Logger.log('Pin message:', contextMenu.message?.id);
        Alert.alert('Coming Soon', 'Pin message feature will be available soon.');
    };

    const handleForward = () => {
        Logger.log('Forward message:', contextMenu.message?.id);
        Alert.alert('Coming Soon', 'Forward message feature will be available soon.');
    };

    const handleSelectMessage = () => {
        if (contextMenu.message) {
            setIsSelectionMode(true);
            setSelectedMessageIds(new Set([contextMenu.message.id]));
        }
    };

    const toggleMessageSelection = (messageId) => {
        setSelectedMessageIds(prev => {
            const next = new Set(prev);
            if (next.has(messageId)) {
                next.delete(messageId);
                if (next.size === 0) setIsSelectionMode(false);
            } else {
                next.add(messageId);
            }
            return next;
        });
    };

    const handleBulkDelete = () => {
        if (selectedMessageIds.size === 0) return;

        const count = selectedMessageIds.size;
        const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id));
        const allMine = selectedMsgs.every(m => m.senderId === user?.uid);

        Alert.alert(
            `Delete ${count} Message${count > 1 ? 's' : ''}`,
            "Choose a deletion method",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete for Me",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            for (const id of selectedMessageIds) {
                                await deleteMessageForMe(conversationId, id, user?.uid);
                            }
                            setIsSelectionMode(false);
                            setSelectedMessageIds(new Set());
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete some messages.");
                        } finally {
                            setLoading(false);
                        }
                    }
                },
                ...(allMine ? [{
                    text: "Delete for Everyone",
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            for (const id of selectedMessageIds) {
                                await deleteMessageForEveryone(conversationId, id);
                            }
                            setIsSelectionMode(false);
                            setSelectedMessageIds(new Set());
                        } catch (e) {
                            Alert.alert("Error", "Failed to delete for everyone.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }] : [])
            ]
        );
    };



    const renderMessageItem = useCallback(({ item }) => (
        <MessageBubble
            item={item}
            userUid={user?.uid}
            theme={THEME}
            otherUserPhoto={otherUserPhoto}
            accountImg={ACCOUNT_IMG}
            activeMenuId={activeMenuId}
            setActiveMenuId={setActiveMenuId}
            onLongPress={handleMessageLongPress}
            onRightClick={handleMessageRightClick}
            onToggleReaction={toggleMessageReaction}
            onReply={(message) => {
                setReplyingTo({ id: message.id, text: message.encryptedText, senderName: message.senderId === user?.uid ? "You" : (nickname || otherUserId) });
                setActiveMenuId(null);
            }}
            onAddReaction={(id) => {
                setReactionMessageId(id);
                setShowFullEmojiPicker(true);
                setActiveMenuId(null);
            }}
            onEdit={(message) => {
                setMessageText(message.encryptedText);
                setEditingMessage(message);
                setActiveMenuId(null);
            }}
            onDelete={handleDelete}
            conversationId={conversationId}
            displayName={nickname || otherUserId}
            isSelectionMode={isSelectionMode}
            isSelected={selectedMessageIds.has(item.id)}
            onSelectToggle={() => toggleMessageSelection(item.id)}
        />
    ), [user?.uid, THEME, otherUserPhoto, activeMenuId, conversationId, nickname, otherUserId, handleMessageLongPress, handleMessageRightClick, handleDelete]);

    // Empty State for Desktop Right Pane
    if (!conversationId) {
        return (
            <View style={{ flex: 1, backgroundColor: THEME.background, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(59, 130, 246, 0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                    <Feather name="lock" size={48} color="#3B82F6" />
                </View>
                <Text style={{ color: THEME.textSecondary, fontSize: 16 }}>Select a conversation to start chatting</Text>
            </View>
        )
    }

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: THEME.background }}>
                <ActivityIndicator size="large" color={THEME.primary} />
            </View>
        );
    }

    return (
        <View style={[{ flex: 1, backgroundColor: chatBgStyle?.color || THEME.background }, containerStyle]}>
            <KeyboardAvoidingView
                behavior={select({ ios: "padding", default: undefined })}
                style={[{ flex: 1 }, !useStealthKeyboard && { paddingBottom: keyboardVisible ? keyboardHeight : 0 }]}
                keyboardVerticalOffset={0}
            >
                <StatusBar style={isDark ? "light" : "dark"} />

                {/* Header */}
                {!hideHeader && (
                    <View style={[styles.header, {
                        borderBottomColor: THEME.border,
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)'
                    }]}>
                        {/* Left: Back + Avatar + Name/Status */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, zIndex: 10 }}>
                            {isMobile && (
                                <Pressable onPress={onBack} style={{ padding: 4, marginRight: 4 }}>
                                    <Feather name="arrow-left" size={28} color={THEME.primary} />
                                </Pressable>
                            )}

                            {/* Avatar */}
                            <Pressable
                                onPress={() => {
                                    router.push({
                                        pathname: "/user-profile",
                                        params: {
                                            userId: otherUserId,
                                            name: otherUserDisplayName || otherUserId,
                                            photoURL: otherUserPhoto,
                                            nickname: nickname,
                                            bio: otherUserBio
                                        }
                                    });
                                }}
                                style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 10, borderWidth: 1, borderColor: THEME.border, opacity: pressed ? 0.8 : 1 })}
                            >
                                <Image source={otherUserPhoto ? { uri: otherUserPhoto } : ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            </Pressable>

                            {/* Name & Status */}
                            <View>
                                <Text style={[styles.headerTitle, { color: THEME.text }]}>{nickname || otherUserId || "Chat"}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* No dot, just colored text */}
                                    <Text style={{
                                        fontSize: 12,
                                        color: (() => {
                                            if (isPartnerTyping) return THEME.primary;
                                            const isOnline = presence?.isOnline;
                                            const rawLastSeen = presence?.lastSeen;
                                            const lastSeen = rawLastSeen?.toMillis ? rawLastSeen.toMillis() : (typeof rawLastSeen === 'string' ? new Date(rawLastSeen).getTime() : (rawLastSeen || 0));
                                            const lastSeenRecent = lastSeen && (Date.now() - lastSeen < 5 * 60 * 1000);
                                            return (isOnline || lastSeenRecent) ? '#10B981' : THEME.textSecondary;
                                        })()
                                    }}>
                                        {(() => {
                                            if (isPartnerTyping) return "typing...";
                                            const isOnline = presence?.isOnline;
                                            const rawLastSeen = presence?.lastSeen;
                                            const lastSeen = rawLastSeen?.toMillis ? rawLastSeen.toMillis() : (typeof rawLastSeen === 'string' ? new Date(rawLastSeen).getTime() : (rawLastSeen || 0));
                                            const lastSeenRecent = lastSeen && (Date.now() - lastSeen < 5 * 60 * 1000);

                                            if (isOnline || lastSeenRecent) return "online";

                                            if (rawLastSeen) {
                                                const date = rawLastSeen.toDate ? rawLastSeen.toDate() : new Date(rawLastSeen);
                                                if (isNaN(date.getTime())) return "Unknown";
                                                const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                                                const now = new Date();
                                                const todayStr = now.toDateString();
                                                const yesterday = new Date(now);
                                                yesterday.setDate(yesterday.getDate() - 1);
                                                const yesterdayStr = yesterday.toDateString();
                                                const dateStr = date.toDateString();

                                                if (dateStr === todayStr) return `last seen today at ${timeStr}`;
                                                if (dateStr === yesterdayStr) return `last seen yesterday at ${timeStr}`;
                                                return `last seen ${date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
                                            }
                                            return "Unknown";
                                        })()}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Center: E2E & Privacy Level - Absolute Centered */}
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'box-none' }}>
                            <Pressable 
                                onPress={() => setShowSafetyModal(true)}
                                style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.7 : 1, pointerEvents: 'auto' })}
                            >
                                {!isMobile && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Feather name="lock" size={10} color="#3B82F6" style={{ marginRight: 4 }} />
                                        <Text style={{ fontSize: 10, color: THEME.textSecondary, fontWeight: '600', letterSpacing: 0.5, fontFamily: isWeb ? '"Noto Sans", system-ui, sans-serif' : undefined }}>END-TO-END ENCRYPTED</Text>
                                    </View>
                                )}
                                <Text style={{ fontSize: 10, color: THEME.primary, fontWeight: '700', marginTop: isMobile ? 0 : 2 }}>{privacyLevel === 99 ? 'EMERGENCY' : `LEVEL ${privacyLevel} `}</Text>
                            </Pressable>
                        </View>

                        {/* Right: Stealth Toggle & Anti-Capture & Call & Menu */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>

                            {/* Anti-Capture Toggle */}
                            {!isWeb && (
                                <Pressable
                                    onPress={() => {
                                        setShowStealthModal(true); 
                                    }}
                                    style={{ padding: 8, marginTop: 6, marginRight: 4 }}
                                >
                                    <Feather 
                                        name={isCaptureBlocked ? "shield" : "shield-off"} 
                                        size={20} 
                                        color={isCaptureBlocked ? THEME.primary : THEME.textSecondary} 
                                    />
                                </Pressable>
                            )}

                            <Pressable
                                onPress={() =>
                                    otherUserUid &&
                                    startCall(
                                        otherUserUid,
                                        nickname || otherUserDisplayName || otherUserId,
                                        conversationId || null
                                    )}
                                disabled={!otherUserUid}
                                style={({ pressed }) => ({
                                    padding: 8,
                                    marginTop: 6,
                                    marginRight: 4,
                                    opacity: !otherUserUid ? 0.35 : pressed ? 0.7 : 1,
                                })}
                            >
                                <Feather name="phone" size={20} color={THEME.primary} />
                            </Pressable>
                            <Pressable onPress={() => setShowMenu(!showMenu)} style={{ padding: 8, marginTop: 6 }}>
                                <Feather name="more-vertical" size={24} color={THEME.primary} />
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Dropdown Menu */}
                {
                    showMenu && (
                        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }} onPress={() => setShowMenu(false)}>
                            <View style={{
                                position: 'absolute',
                                top: 150,
                                right: 16,
                                backgroundColor: THEME.surface,
                                borderRadius: 12,
                                padding: 8,
                                ...select({
                                    web: { boxShadow: '0px 4px 8px rgba(0,0,0,0.3)' },
                                    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
                                    android: { elevation: 5 }
                                }),
                                zIndex: 101,
                                minWidth: 160,
                                borderWidth: 1, borderColor: THEME.border
                            }}>
                                <Pressable
                                    onPress={() => {
                                        setShowMenu(false);
                                        router.push({
                                            pathname: "/user-profile",
                                            params: {
                                                userId: otherUserId,
                                                name: otherUserDisplayName || otherUserId,
                                                photoURL: otherUserPhoto,
                                                nickname: nickname,
                                                bio: otherUserBio
                                            }
                                        });
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
                                        backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent'
                                    })}
                                >
                                    <Feather name="user" size={16} color={THEME.text} style={{ marginRight: 10 }} />
                                    <Text style={{ color: THEME.text, fontSize: 14 }}>View Profile</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        setShowMenu(false);
                                        if (onRename) onRename(otherUserUid, nickname || otherUserId);
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
                                        backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent'
                                    })}
                                >
                                    <Feather name="edit-2" size={16} color={THEME.text} style={{ marginRight: 10 }} />
                                    <Text style={{ color: THEME.text, fontSize: 14 }}>Rename Contact</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        setShowMenu(false);
                                        if (safetyNumber) {
                                            setShowSafetyModal(true);
                                        } else {
                                            alert("Security not ready yet.");
                                        }
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
                                        backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent'
                                    })}
                                >
                                    <Feather name="shield" size={16} color={THEME.text} style={{ marginRight: 10 }} />
                                    <Text style={{ color: THEME.text, fontSize: 14 }}>Verify Security</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        setShowMenu(false);
                                        setShowClearChatModal(true);
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
                                        backgroundColor: pressed ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                        marginTop: 8, borderTopWidth: 1, borderTopColor: THEME.border
                                    })}
                                >
                                    <Feather name="trash-2" size={16} color="#EF4444" style={{ marginRight: 10 }} />
                                    <Text style={{ color: "#EF4444", fontSize: 14 }}>Clear Chat</Text>
                                </Pressable>


                                {!isWeb && (
                                    <Pressable
                                        onPress={() => {
                                            setShowMenu(false);
                                            setShowStealthModal(true);
                                        }}
                                        style={({ pressed }) => ({
                                            flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
                                            backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            marginTop: 4
                                        })}
                                    >
                                        <Feather name={isCaptureBlocked ? "shield" : "shield-off"} size={16} color={isCaptureBlocked ? THEME.primary : THEME.text} style={{ marginRight: 10 }} />
                                        <Text style={{ color: isCaptureBlocked ? THEME.primary : THEME.text, fontSize: 14 }}>Hardware Shield</Text>
                                    </Pressable>
                                )}

                                <Pressable
                                    onPress={() => {
                                        setShowMenu(false);
                                        router.replace({ pathname: '/home', params: { initialTab: 'settings' } });
                                    }}
                                    style={({ pressed }) => ({
                                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8,
                                        backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        marginTop: 4, borderTopWidth: 1, borderTopColor: THEME.border
                                    })}
                                >
                                    <Feather name="settings" size={16} color={THEME.text} style={{ marginRight: 10 }} />
                                    <Text style={{ color: THEME.text, fontSize: 14 }}>Settings</Text>
                                </Pressable>
                            </View>
                        </Pressable >
                    )
                }

                {/* Messages List */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, messages.length === 0 && { flex: 1, justifyContent: 'center' }]}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListEmptyComponent={() => (
                        <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{
                                color: THEME.text, fontSize: 18, fontWeight: '700',
                                textAlign: 'center', marginBottom: 12
                            }}>
                                Send hi to {nickname || otherUserId || "your contact"}!
                            </Text>
                            <View style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                borderRadius: 16, padding: 20, width: '100%',
                                borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.1)'
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <Feather name="info" size={14} color={THEME.primary} style={{ marginRight: 8 }} />
                                    <Text style={{ color: THEME.primary, fontWeight: '600', fontSize: 13 }}>Instructions</Text>
                                </View>
                                <Text style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 20 }}>
                                    The other person must accept your message request before you can see when they are online or if they've read your messages.
                                </Text>
                                <Text style={{ color: THEME.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 8, fontWeight: '600' }}>
                                    Tell them to check their Connection Requests and tap "Accept".
                                </Text>
                            </View>
                        </View>
                    )}
                />

                <ScheduledMessagesBar
                    messages={scheduledMessages}
                    onCancel={(id) => {
                        Alert.alert("Cancel Schedule?", "Delete this scheduled message?", [
                            { text: "No", style: "cancel" },
                            {
                                text: "Yes", onPress: async () => {
                                    try {
                                        const { hardDeleteMessage } = await import("../lib/firestore-service");
                                        await hardDeleteMessage(conversationId, id);
                                    } catch (e) {
                                        Alert.alert("Error", "Failed to cancel message.");
                                    }
                                }
                            }
                        ]);
                    }}
                    theme={THEME}
                />

                {/* Contextual Suggestions */}
                {(() => {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg && lastMsg.senderId !== user?.uid) {
                        return (
                            <SuggestionsBar
                                lastMessage={{ text: lastMsg.encryptedText, isMe: false }}
                                onSelect={(text) => {
                                    setMessageText(text);
                                }}
                                theme={THEME}
                                isDark={isDark}
                            />
                        );
                    }
                    return null;
                })()}

                {/* Reply Preview */}
                {
                    replyingTo && (
                        <View style={{ backgroundColor: 'transparent', borderTopWidth: 1, borderTopColor: THEME.border, padding: 10, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 4, height: 30, backgroundColor: THEME.primary, borderRadius: 2, marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: THEME.primary, fontWeight: 'bold', fontSize: 12 }}>Replying to {replyingTo.senderName}</Text>
                                <Text numberOfLines={1} style={{ color: THEME.textSecondary, fontSize: 13 }}>{replyingTo.text}</Text>
                            </View>
                            <Pressable onPress={() => setReplyingTo(null)} style={{ padding: 5 }}>
                                <Feather name="x-circle" size={20} color={THEME.textSecondary} />
                            </Pressable>
                        </View>
                    )
                }

                {/* Input Area */}
                {/* Selection Mode Action Bar */}
                {isSelectionMode ? (
                    <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={[
                        styles.inputContainer,
                        {
                            paddingTop: 12,
                            paddingBottom: Math.max(insets.bottom || 0, 12),
                            borderTopWidth: 1,
                            borderTopColor: THEME.border,
                        }
                    ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16 }}>
                            <Pressable 
                                onPress={() => {
                                    setIsSelectionMode(false);
                                    setSelectedMessageIds(new Set());
                                }}
                                style={{ padding: 8 }}
                            >
                                <Text style={{ color: THEME.primary, fontWeight: '600' }}>Cancel</Text>
                            </Pressable>
                            
                            <Text style={{ color: THEME.text, fontWeight: 'bold' }}>
                                {selectedMessageIds.size} Selected
                            </Text>

                            <Pressable 
                                onPress={handleBulkDelete}
                                disabled={selectedMessageIds.size === 0}
                                style={{ padding: 8, opacity: selectedMessageIds.size === 0 ? 0.3 : 1 }}
                            >
                                <Feather name="trash-2" size={24} color="#EF4444" />
                            </Pressable>
                        </View>
                    </BlurView>
                ) : (
                    <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={[
                        styles.inputContainer,
                        {
                            marginBottom: keyboardVisible ? 2 : 10,
                            paddingTop: 12,
                            paddingBottom: Math.max(insets.bottom || 0, 12),
                            backgroundColor: 'transparent',
                            borderTopWidth: 0,
                        }]}>
                    <LinearGradient
                        colors={isDark ?
                            ['rgba(0, 0, 0, 0.98)', 'rgba(15, 23, 42, 0.75)', 'rgba(0, 0, 0, 0.98)'] :
                            ['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 0.98)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.inputPill,
                            {
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
                                borderWidth: 1,
                                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 1)',
                                borderLeftColor: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.9)',
                                shadowColor: "#000",
                                shadowOffset: { width: 0, height: 20 },
                                shadowOpacity: isDark ? 0.75 : 0.2,
                                shadowRadius: 50,
                                elevation: 12,
                            }
                        ]}
                    >
                        <Pressable
                            onPress={handlePickImage}
                            disabled={sending}
                            style={({ pressed }) => ({
                                padding: 8,
                                opacity: pressed ? 0.6 : 1,
                            })}
                        >
                            <Feather name="plus" size={20} color={THEME.primary} />
                        </Pressable>

                        <TextInput
                            style={[
                                styles.pillInput,
                                { color: THEME.text }
                            ]}
                            placeholder={editingMessage ? "Edit message..." : "Type Message..."}
                            placeholderTextColor={THEME.textSecondary}
                            selectionColor={THEME.primary}
                            cursorColor={THEME.primary}
                            selectionHandleColor={THEME.primary}
                            value={messageText}
                            onChangeText={setMessageText}
                            multiline
                            textAlignVertical="center"
                            editable={!sending}
                            showSoftInputOnFocus={!useStealthKeyboard}
                            onFocus={() => {
                                if (!useStealthKeyboard) setKeyboardVisible(true);
                            }}
                            onBlur={() => setKeyboardVisible(false)}
                            onKeyPress={(e) => {
                                if (isWeb) {
                                    const isEnter = e.nativeEvent.key === 'Enter' || e.nativeEvent.keyCode === 13;
                                    if (isEnter && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage();
                                    }
                                }
                            }}
                        />

                        {editingMessage && (
                            <Pressable
                                onPress={() => { setEditingMessage(null); setMessageText(""); }}
                                style={{ padding: 8, marginRight: -4 }}
                            >
                                <Feather name="x" size={18} color={THEME.textSecondary} />
                            </Pressable>
                        )}

                        <View style={styles.pillActions}>
                            <Pressable
                                onPress={() => {
                                    setUseStealthKeyboard(!useStealthKeyboard);
                                    if (!useStealthKeyboard) {
                                        Keyboard.dismiss();
                                        setKeyboardVisible(false);
                                    }
                                }}
                                style={({ pressed }) => ({
                                    padding: 6,
                                    opacity: pressed ? 0.7 : 1,
                                })}
                            >
                                <MaterialCommunityIcons
                                    name={useStealthKeyboard ? "keyboard-lock" : "keyboard-outline"}
                                    size={20}
                                    color={useStealthKeyboard ? '#60A5FA' : THEME.textSecondary}
                                />
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    const sequence = [0, 5, 3600, 86400];
                                    const nextIdx = (sequence.indexOf(scheduledDelay) + 1) % sequence.length;
                                    setScheduledDelay(sequence[nextIdx]);
                                }}
                                onLongPress={() => {
                                    setTimerModalMode('schedule');
                                    setTimerModalVisible(true);
                                }}
                                style={{ padding: 6 }}
                            >
                                <MaterialCommunityIcons
                                    name={scheduledDelay === 0 ? "clock-outline" : "clock-fast"}
                                    size={20}
                                    color={scheduledDelay === 0 ? THEME.textSecondary : THEME.primary}
                                />
                                {scheduledDelay > 0 && (
                                    <Text style={{ fontSize: 7, color: THEME.primary, fontWeight: 'bold', position: 'absolute', bottom: 2 }}>
                                        {scheduledDelay === 5 ? '5s' : (scheduledDelay === 3600 ? '1h' : '1d')}
                                    </Text>
                                )}
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    const sequence = [0, 5, 30, 60, 300, 3600];
                                    const nextIdx = (sequence.indexOf(ephemeralDuration) + 1) % sequence.length;
                                    setEphemeralDuration(sequence[nextIdx]);
                                }}
                                onLongPress={() => {
                                    setTimerModalMode('ephemeral');
                                    setTimerModalVisible(true);
                                }}
                                style={{ padding: 6 }}
                            >
                                <MaterialCommunityIcons
                                    name={ephemeralDuration === 0 ? "timer-outline" : "timer-sand"}
                                    size={20}
                                    color={ephemeralDuration === 0 ? THEME.textSecondary : THEME.primary}
                                />
                                {ephemeralDuration > 0 && (
                                    <Text style={{ fontSize: 7, color: THEME.primary, fontWeight: 'bold', position: 'absolute', bottom: 2 }}>
                                        {ephemeralDuration < 60 ? `${ephemeralDuration}s` : (ephemeralDuration < 3600 ? `${ephemeralDuration / 60}m` : '1h')}
                                    </Text>
                                )}
                            </Pressable>

                            <Pressable
                                onPress={handleSendMessage}
                                disabled={sending || !messageText.trim()}
                                style={({ pressed }) => [
                                    styles.pillSend,
                                    {
                                        backgroundColor: THEME.primary,
                                        opacity: (!messageText.trim() || sending) ? 0.3 : (pressed ? 0.8 : 1),
                                    }
                                ]}
                            >
                                <Feather name="send" size={16} color="#000" style={{ transform: [{ rotate: '45deg' }, { translateX: 1 }] }} />
                            </Pressable>
                        </View>
                    </LinearGradient>
                </BlurView>
                )}

                {/* Safety Number Modal */}
                <SafetyNumberModal
                    visible={showSafetyModal}
                    onClose={() => setShowSafetyModal(false)}
                    myKeys={myKeys}
                    theirKeys={theirKeys}
                    otherUserName={nickname || otherUserDisplayName || otherUserId}
                    THEME={THEME}
                />

                {/* Full Emoji Picker Modal */}
                < Modal
                    visible={showFullEmojiPicker}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowFullEmojiPicker(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{
                            backgroundColor: THEME.background,
                            borderTopLeftRadius: 24,
                            borderTopRightRadius: 24,
                            padding: 20,
                            maxHeight: '70%',
                            borderWidth: 1,
                            borderColor: THEME.border
                        }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700' }}>Choose Reaction</Text>
                                <Pressable onPress={() => setShowFullEmojiPicker(false)} style={{ padding: 4 }}>
                                    <Feather name="x" size={24} color={THEME.textSecondary} />
                                </Pressable>
                            </View>

                            <FlatList
                                data={[
                                    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😻', '😼', '😽', '🙀', '😿', '😾',
                                    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄',
                                    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'
                                ]}
                                keyExtractor={(item, index) => index.toString()}
                                numColumns={6}
                                renderItem={({ item: emoji }) => (
                                    <Pressable
                                        onPress={() => {
                                            toggleMessageReaction(conversationId, reactionMessageId, user?.uid, emoji);
                                            setShowFullEmojiPicker(false);
                                        }}
                                        style={{ flex: 1, alignItems: 'center', padding: 10 }}
                                    >
                                        <Text style={{ fontSize: 24 }}>{emoji}</Text>
                                    </Pressable>
                                )}
                                contentContainerStyle={{ paddingBottom: 40 }}
                            />
                        </View>
                    </View>
                </Modal >

                {/* Hardware Protection Modal (Anti-Capture) */}
                <Modal
                    visible={showStealthModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowStealthModal(false)}
                >
                    <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{
                            width: '100%', maxWidth: 360,
                            backgroundColor: THEME.surface,
                            borderRadius: 24,
                            padding: 32,
                            borderWidth: 1, borderColor: THEME.border,
                            ...select({
                                ios: {
                                    shadowColor: isCaptureBlocked ? THEME.primary : '#000',
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 20
                                },
                                android: {
                                    elevation: 10,
                                },
                                web: {
                                    boxShadow: isCaptureBlocked
                                        ? `0px 0px 20px ${THEME.primary}`
                                        : '0px 0px 20px rgba(0, 0, 0, 0.2)',
                                }
                            })
                        }}>
                            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                <View style={{
                                    width: 64, height: 64, borderRadius: 32,
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    justifyContent: 'center', alignItems: 'center', marginBottom: 16
                                }}>
                                    <Feather 
                                        name="shield" 
                                        size={32} 
                                        color={THEME.primary} 
                                    />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: THEME.text, textAlign: 'center' }}>
                                    {isCaptureBlocked ? "Disable Shield?" : "Enable Shield?"}
                                </Text>
                                <Text style={{ fontSize: 14, color: THEME.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 20 }}>
                                    "Hardware protection prevents screenshots and screen recordings on this device. This provides maximum physical privacy."
                                </Text>
                            </View>

                            <View style={{ gap: 12 }}>
                                <Pressable
                                    onPress={confirmToggleCapture}
                                    style={{ backgroundColor: THEME.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                                >
                                    <Text style={{ color: '#0F172A', fontWeight: 'bold', fontSize: 16 }}>
                                        {isCaptureBlocked ? "Disable Hardware Protection" : "Enable Hardware Protection"}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => setShowStealthModal(false)}
                                    style={{ paddingVertical: 12, alignItems: 'center' }}
                                >
                                    <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Cancel</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal >

                {/* Clear Chat Modal */}
                <Modal
                    visible={showClearChatModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowClearChatModal(false)}
                >
                    <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{
                            width: '100%', maxWidth: 360,
                            backgroundColor: THEME.surface,
                            borderRadius: 24, padding: 32,
                            borderWidth: 1, borderColor: THEME.border
                        }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: THEME.text, textAlign: 'center', marginBottom: 16 }}>Clear Chat?</Text>
                            <Text style={{ fontSize: 14, color: THEME.textSecondary, textAlign: 'center', marginBottom: 24 }}>
                                This will permanently delete all messages in this conversation.
                            </Text>

                            <Pressable
                                onPress={() => setIncludesImages(!includesImages)}
                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, alignSelf: 'center' }}
                            >
                                <View style={{
                                    width: 22, height: 22, borderRadius: 6,
                                    borderWidth: 2, borderColor: THEME.primary,
                                    backgroundColor: includesImages ? THEME.primary : 'transparent',
                                    justifyContent: 'center', alignItems: 'center', marginRight: 10
                                }}>
                                    {includesImages && <Feather name="check" size={16} color="#0F172A" />}
                                </View>
                                <Text style={{ color: THEME.text, fontSize: 15 }}>Also delete images/media</Text>
                            </Pressable>

                            <View style={{ gap: 10 }}>
                                <Pressable
                                    onPress={async () => {
                                        setShowClearChatModal(false);
                                        setLoading(true);
                                        try {
                                            await clearChatForMe(conversationId, user.uid);
                                            setClearedAt(Date.now()); // Update local state immediately
                                            Alert.alert("Success", "Chat cleared for you.");
                                        } catch (e) {
                                            Alert.alert("Error", "Failed to clear chat locally.");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    style={{ backgroundColor: THEME.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                                >
                                    <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Clear for Me</Text>
                                </Pressable>

                                <Pressable
                                    onPress={async () => {
                                        setShowClearChatModal(false);
                                        setLoading(true);
                                        try {
                                            await clearChatData(conversationId, includesImages);
                                            Alert.alert("Success", "Chat cleared for everyone.");
                                        } catch (e) {
                                            Alert.alert("Error", "Failed to clear chat for everyone.");
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                    style={{ backgroundColor: '#EF4444', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Clear for Everyone</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => setShowClearChatModal(false)}
                                    style={{ paddingVertical: 12, alignItems: 'center' }}
                                >
                                    <Text style={{ color: THEME.textSecondary, fontWeight: '600' }}>Cancel</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Message Context Menu */}
                < MessageContextMenu
                    visible={contextMenu.visible}
                    position={contextMenu.position}
                    onClose={() => setContextMenu({ visible: false, position: { x: 0, y: 0 }, message: null })}
                    onReply={() => {
                        setReplyingTo({
                            id: contextMenu.message.id,
                            text: contextMenu.message.encryptedText,
                            senderName: contextMenu.message.senderId === user?.uid ? "You" : (nickname || otherUserId)
                        });
                        setContextMenu({ visible: false, position: { x: 0, y: 0 }, message: null });
                    }}
                    onEdit={() => {
                        if (contextMenu.message.senderId === user?.uid) {
                            setMessageText(contextMenu.message.encryptedText);
                            setEditingMessage(contextMenu.message);
                        }
                        setContextMenu({ visible: false, position: { x: 0, y: 0 }, message: null });
                    }}
                    onPin={handlePin}
                    onCopy={handleCopyText}
                    onForward={handleForward}
                    onDelete={() => {
                        handleDelete(contextMenu.message);
                        setContextMenu({ visible: false, position: { x: 0, y: 0 }, message: null });
                    }}
                    onSelect={handleSelectMessage}
                    canEdit={contextMenu.message?.senderId === user?.uid}
                    canPin={true}
                    isDarkMode={THEME.background === '#0F172A'}
                />

                <TimerPickerModal
                    visible={timerModalVisible}
                    mode={timerModalMode}
                    theme={THEME}
                    onClose={() => setTimerModalVisible(false)}
                    onSave={(seconds) => {
                        if (seconds > 0) {
                            if (timerModalMode === 'schedule') {
                                setScheduledDelay(seconds);
                            } else {
                                setEphemeralDuration(seconds);
                            }
                        }
                    }}
                />
            </KeyboardAvoidingView>

            {/* Stealth Keyboard */}
            <StealthKeyboard
                visible={useStealthKeyboard}
                onKeyPress={(char) => setMessageText(prev => prev + char)}
                onBackspace={() => setMessageText(prev => prev.slice(0, -1))}
                onSend={handleSendMessage}
            />

            <PinRecoveryModal
                visible={showPinRecovery}
                uid={user?.uid}
                convId={conversationId}
                partnerUid={targetUid}
                onSuccess={() => setShowPinRecovery(false)}
                onDismiss={() => setShowPinRecovery(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12, // Increased padding
        borderBottomWidth: 1,
        backgroundColor: 'transparent', // Will be overridden in render if needed or handled by container
    },
    backButton: {
        padding: 10,
        width: 40,
        alignItems: 'center',
    },
    safetyButton: {
        padding: 10,
        width: 40,
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginRight: 6,
        fontFamily: isWeb ? '"Noto Sans", system-ui, sans-serif' : undefined,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    listContent: {
        padding: 20,
        paddingBottom: 20,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 8, // Tighter spacing for chat feel
        alignItems: 'flex-end',
    },
    avatarSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginBottom: 4,
    },
    bubble: {
        maxWidth: '78%',
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 2,
        ...select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
            android: {
                elevation: 1,
            },
            web: {
                boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
            },
        }),
    },
    messageText: {
        fontSize: 15,
        lineHeight: 18,
    },
    timeText: {
        fontSize: 10,
        textAlign: 'right',
        marginTop: 0,
    },
    inputContainer: {
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 4,
        backgroundColor: 'transparent',
    },
    inputPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 24,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderWidth: 1,
    },
    pillInput: {
        flex: 1,
        fontSize: 15,
        paddingHorizontal: 8,
        paddingVertical: 8,
        maxHeight: 120,
    },
    pillActions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 2,
    },
    pillSend: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    input: {
        flex: 1,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 140,
        fontSize: 16,
        marginHorizontal: 8,
        borderWidth: 0,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

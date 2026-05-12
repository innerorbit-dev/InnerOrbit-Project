/**
 * Purpose: Recent voice calls (Firestore `calls` collection) with call-again and open chat.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/auth-context';
import { useCall } from '../../context/call-context';
import { getConversationBetweenUsers } from '../../lib/firestore-service';
import { Logger } from '../../lib/logger';

const LIST_LIMIT = 40;

function mergeCallRows(a, b) {
    const map = new Map();
    [...a, ...b].forEach((row) => {
        if (!row?.id) return;
        const prev = map.get(row.id);
        if (!prev || (row.timestamp || 0) > (prev.timestamp || 0)) {
            map.set(row.id, row);
        }
    });
    return [...map.values()].sort((x, y) => (y.timestamp || 0) - (x.timestamp || 0));
}

export const CallsHistoryView = ({ THEME, isDesktop }) => {
    const { user } = useAuth();
    const router = useRouter();
    const { startCall } = useCall();
    const [asCaller, setAsCaller] = useState([]);
    const [asRecipient, setAsRecipient] = useState([]);
    const [callerSnapReady, setCallerSnapReady] = useState(false);
    const [recipientSnapReady, setRecipientSnapReady] = useState(false);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        if (!user?.uid) return;

        const q1 = query(
            collection(db, 'calls'),
            where('callerId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(LIST_LIMIT),
        );
        const q2 = query(
            collection(db, 'calls'),
            where('recipientId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(LIST_LIMIT),
        );

        const unsub1 = onSnapshot(
            q1,
            (snap) => {
                setAsCaller(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setCallerSnapReady(true);
            },
            (err) => Logger.error('[CallsHistory] caller query:', err?.message),
        );

        const unsub2 = onSnapshot(
            q2,
            (snap) => {
                setAsRecipient(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setRecipientSnapReady(true);
            },
            (err) => Logger.error('[CallsHistory] recipient query:', err?.message),
        );

        return () => {
            unsub1();
            unsub2();
        };
    }, [user?.uid]);

    const rows = useMemo(() => mergeCallRows(asCaller, asRecipient), [asCaller, asRecipient]);
    const listHydrated = callerSnapReady && recipientSnapReady;

    const peerLabel = useCallback(
        (item) => {
            if (!user?.uid) return '—';
            const isCaller = item.callerId === user.uid;
            if (isCaller) {
                return item.recipientName || `User ${String(item.recipientId || '').slice(0, 4)}`;
            }
            return item.callerName || `User ${String(item.callerId || '').slice(0, 4)}`;
        },
        [user?.uid],
    );

    const otherUid = useCallback(
        (item) => (item.callerId === user.uid ? item.recipientId : item.callerId),
        [user?.uid],
    );

    const openChat = async (item) => {
        const ouid = otherUid(item);
        if (!ouid) return;
        try {
            if (item.conversationId) {
                router.push({ pathname: '/chat-detail', params: { conversationId: item.conversationId } });
                return;
            }
            const conv = await getConversationBetweenUsers(user.uid, ouid);
            if (conv?.id) {
                router.push({ pathname: '/chat-detail', params: { conversationId: conv.id } });
            } else {
                Alert.alert('No chat yet', 'Open a conversation with this contact from Chats first.');
            }
        } catch (e) {
            Logger.error('[CallsHistory] openChat:', e?.message);
            Alert.alert('Unable to open chat', e?.message || 'Try again.');
        }
    };

    const callAgain = async (item) => {
        const ouid = otherUid(item);
        if (!ouid) return;
        setBusyId(item.id);
        try {
            await startCall(ouid, peerLabel(item), item.conversationId || null);
        } catch {
            /* startCall shows alert */
        } finally {
            setBusyId(null);
        }
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        try {
            const d = new Date(typeof ts === 'number' ? ts : Number(ts));
            return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    if (!user?.uid) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: THEME.textSecondary }}>Sign in to see calls.</Text>
            </View>
        );
    }

    if (!listHydrated) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: isDesktop ? 20 : 100 }}>
                <ActivityIndicator color={THEME.primary} size="large" />
                <Text style={{ color: THEME.textSecondary, marginTop: 12 }}>Loading call history…</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, paddingBottom: isDesktop ? 20 : 100 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
                <Text style={{ color: THEME.text, fontSize: 20, fontWeight: '800' }}>Calls</Text>
                <Text style={{ color: THEME.textSecondary, fontSize: 13, marginTop: 4 }}>
                    Voice calls use WebRTC with Firestore signaling (works on the Firebase Spark free tier). For difficult networks, add
                    TURN credentials via <Text style={{ fontWeight: '700' }}>EXPO_PUBLIC_WEBRTC_TURN_SERVERS</Text> in your environment (JSON array of ICE server objects).
                </Text>
            </View>

            {rows.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <Feather name="phone-call" size={40} color={THEME.textSecondary} style={{ marginBottom: 12 }} />
                    <Text style={{ color: THEME.text, fontWeight: '700', marginBottom: 6 }}>No calls yet</Text>
                    <Text style={{ color: THEME.textSecondary, textAlign: 'center', fontSize: 13 }}>
                        Start a voice call from a chat using the phone icon in the header.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                    renderItem={({ item }) => {
                        const status = item.status || 'unknown';
                        const busy = busyId === item.id;
                        return (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 14,
                                    paddingHorizontal: 12,
                                    marginBottom: 8,
                                    borderRadius: 14,
                                    backgroundColor: THEME.surface,
                                    borderWidth: 1,
                                    borderColor: THEME.border,
                                }}
                            >
                                <View
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 12,
                                    }}
                                >
                                    <Feather name="phone" size={20} color="#38BDF8" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: THEME.text, fontWeight: '800', fontSize: 16 }}>{peerLabel(item)}</Text>
                                    <Text style={{ color: THEME.textSecondary, fontSize: 12, marginTop: 2 }}>
                                        {formatTime(item.timestamp)} · {status}
                                    </Text>
                                </View>
                                <Pressable onPress={() => callAgain(item)} disabled={busy} style={{ padding: 10, marginRight: 4 }}>
                                    {busy ? (
                                        <ActivityIndicator size="small" color={THEME.primary} />
                                    ) : (
                                        <Feather name="phone-call" size={22} color={THEME.primary} />
                                    )}
                                </Pressable>
                                <Pressable onPress={() => openChat(item)} style={{ padding: 10 }}>
                                    <Feather name="message-circle" size={22} color={THEME.textSecondary} />
                                </Pressable>
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
};

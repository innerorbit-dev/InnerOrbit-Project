/**
 * Purpose: Primary state engine for chat conversations. Orchestrates live Firestore subscriptions,
 * end-to-end message decryption, unread count tracking, and local update notifications.
 */
import { useState, useEffect, useRef } from 'react';
import * as firestoreService from '../lib/firestore-service';
import { isEncrypted, deriveConversationKey, decrypt, decryptAsync } from '../lib/encryption';
import { showLocalNotification, shouldShowNotification } from '../lib/notification-service';
import { Logger } from '../lib/logger';

export function useConversations(user, isDecoyMode, isDesktop, selectedConversationId, privacyLevel) {
  const [conversations, setConversations] = useState([]);
  const [nicknames, setNicknames] = useState({});
  const [loading, setLoading] = useState(true);
  const lastKnownMessageTimes = useRef({});

  // 1. Subscribe to Conversations
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // 🛡️ PARITY FIX: Allow PIN-only sessions to proceed even if auth.currentUser is null
    // We trust the 'user' object from the local context.
    /*
    const { auth } = require('../lib/firebase');
    const isActuallyAuthenticated = auth.currentUser?.uid === user.uid;

    if (!isActuallyAuthenticated) {
      Logger.log('[useConversations] Skipping Firestore: unauthenticated session');
      setLoading(false);
      return;
    }
    */

    const unsubscribe = firestoreService.subscribeToConversations(user.uid, async (convs) => {
      Logger.log(`[useConversations] 📥 Received ${convs.length} conversations`);
      // Camouflage Mode: Hide all real chats if in decoy mode
      if (isDecoyMode) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const getCipherVersion = (conv) => {
        if (conv?.lastMessageEncVersion) return conv.lastMessageEncVersion;
        const text = conv?.lastMessage || "";
        if (text.startsWith("v5:")) return "v5";
        if (text.startsWith("v4:")) return "v4";
        if (text.startsWith("v3:")) return "v3";
        if (text.startsWith("v2:")) return "v2";
        return "legacy";
      };

      // 🔔 Handle Notifications for new messages
      const handleNotifications = async () => {
        for (const conv of convs) {
          Logger.log(`[useConversations] Processing conv: ${conv.id.substring(0, 5)}...`);
          const lastTime = conv.lastMessageTime?.toMillis() || 0;
          const previousTime = lastKnownMessageTimes.current[conv.id] || 0;

          if (lastTime > previousTime && previousTime !== 0) {
            if (conv.lastMessageSenderId !== user.uid && selectedConversationId !== conv.id) {
              const shouldShow = await shouldShowNotification(conv.lastMessageSenderId);
              if (shouldShow) {
                let preview = conv.lastMessage || "New message";
                if (isEncrypted(preview)) {
                  try {
                    const key = deriveConversationKey(conv.id, conv.participantIds);
                    preview = await decryptAsync(preview, key, conv.id);
                    if (preview === "🔒 Encrypted Message" || preview === "🔒 Decryption Failed") {
                      Logger.warn(`[useConversations] Notification decrypt failed conv=${conv.id.substring(0, 5)} version=${getCipherVersion(conv)}`);
                    }
                  } catch (e) { 
                    preview = "🔒 Encrypted Message"; 
                  }
                }

                const senderName = nicknames[conv.otherUserUid] || conv.otherUserId || "Someone";
                showLocalNotification(`Message from ${senderName}`, preview, { conversationId: conv.id });
              }
            }
          }

          lastKnownMessageTimes.current[conv.id] = lastTime;

          // Auto-mark as delivered if it's an incoming message with status 'sent'
          if (conv.lastMessageStatus === 'sent' && conv.lastMessageSenderId !== user.uid) {
            firestoreService.markMessagesAsDelivered(conv.id, user.uid);
          }
        }
      };

      handleNotifications();

      try {
        const conversationsWithInfo = await Promise.all(
          convs.map(async (conv) => {
            try {
              const otherUserUid = conv.participantIds.find((id) => id !== user.uid);
              if (otherUserUid) {
                let otherUser = null;
                try {
                  otherUser = await firestoreService.getUserProfile(otherUserUid);
                } catch (e) { }

                let lastMessage = conv.lastMessage;
                if (isEncrypted(lastMessage)) {
                  try {
                    const key = deriveConversationKey(conv.id, conv.participantIds);
                    Logger.log(`[useConversations] 🔑 Decrypt: conv=${conv.id.substring(0,5)}, pIds=${conv.participantIds?.length}, skPrefix=${key.substring(0,8)}`);
                    lastMessage = await decryptAsync(lastMessage, key, conv.id);
                    if (lastMessage === "🔒 Encrypted Message" || lastMessage === "🔒 Decryption Failed") {
                      Logger.warn(`[useConversations] Preview decrypt failed conv=${conv.id.substring(0, 5)} version=${getCipherVersion(conv)}`);
                    }
                  } catch (e) {
                    lastMessage = "🔒 Encrypted Message";
                  }
                }

                return {
                  ...conv,
                  unreadCount: conv[`unreadCount_${user.uid}`] || 0,
                  lastMessage,
                  otherUserUid,
                  otherUserId: otherUser?.userId || "Unknown",
                  avatarColor: getColorFromId(otherUser?.userId || otherUserUid),
                };
              }
              return conv;
            } catch (error) {
              return { ...conv, otherUserId: "Unknown", avatarColor: "#94A3B8" };
            }
          })
        );

        const sorted = conversationsWithInfo.sort((a, b) => {
          const timeA = a.lastMessageTime?.toMillis() || 0;
          const timeB = b.lastMessageTime?.toMillis() || 0;
          return timeB - timeA;
        });

        setConversations(sorted);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    }, (error) => {
      setLoading(false);
    });

    return unsubscribe;
  }, [user, isDecoyMode, selectedConversationId, nicknames]);

  // 2. Subscribe to Nicknames
  useEffect(() => {
    if (!user) return;

    // 🛡️ PARITY FIX: Allow PIN-only sessions for nicknames
    /*
    const { auth } = require('../lib/firebase');
    const isActuallyAuthenticated = auth.currentUser?.uid === user.uid;
    if (!isActuallyAuthenticated) return;
    */

    const unsub = firestoreService.subscribeToContactNicknames(user.uid, (data) => {
      Logger.log(`[useConversations] 🏷️ Nicknames updated (${Object.keys(data || {}).length} entries)`);
      setNicknames(data || {});
    });
    return unsub;
  }, [user]);

  const getColorFromId = (id) => {
    const colors = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#06B6D4"];
    let hash = 0;
    if (!id) return colors[0];
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // 3. Subscribe to User Presence
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (conversations.length === 0) return;

    const uniqueUids = [...new Set(conversations.map(c => c.otherUserUid).filter(Boolean))];
    const cleanups = [];

    uniqueUids.forEach(uid => {
      const unsub = firestoreService.subscribeToUserPresence(uid, (data) => {
        if (data) {
          setPresenceMap(prev => ({ ...prev, [uid]: data }));
        }
      });
      cleanups.push(unsub);
    });

    return () => {
      cleanups.forEach(unsub => unsub && unsub());
    };
  }, [conversations.map(c => c.otherUserUid).sort().join(',')]);

  const conversationsWithPresence = conversations.map(c => ({
    ...c,
    isOnline: presenceMap[c.otherUserUid]?.isOnline || false,
    lastSeen: presenceMap[c.otherUserUid]?.lastSeen
  }));

  return { conversations: conversationsWithPresence, nicknames, loading };
}

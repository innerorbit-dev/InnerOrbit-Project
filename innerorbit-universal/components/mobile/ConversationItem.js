import React from "react";
import { View, Text, Pressable, Image, useWindowDimensions } from "react-native";
import { isMobileLayout, select, Platform } from "../../utils/platform";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { isEncrypted } from "../../lib/encryption"; // decrypt handled upstream in useConversations
import { getHomeStyles } from "../../styles/home.styles";

const ACCOUNT_IMG = require('../../assets/account.webp');

export const ConversationItem = ({
  item,
  user,
  nicknames,
  selectedConversationId,
  handleConversationPress,
  onAvatarPress,
  THEME
}) => {
  const styles = getHomeStyles(THEME);
  const { width } = useWindowDimensions();
  const isDesktop = !isMobileLayout;

  // Format Time: "10:30 AM" or "Yesterday"
  let timeLabel = "";
  if (item.lastMessageTime) {
    try {
      const millis = item.lastMessageTime.toMillis ? item.lastMessageTime.toMillis() : (item.lastMessageTime.seconds ? item.lastMessageTime.seconds * 1000 : item.lastMessageTime);
      const date = new Date(millis);
      const now = new Date();
      if (!isNaN(date.getTime())) {
        if (date.toDateString() === now.toDateString()) {
          timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          timeLabel = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      }
    } catch (e) {
      timeLabel = "";
    }
  }

  const isSelected = selectedConversationId === item.id;

  if (isDesktop) {
    // Return original simple layout for Desktop
    return (
      <Pressable
        onPress={() => handleConversationPress(item.id)}
        style={({ pressed }) => [
          styles.itemContainer,
          {
            backgroundColor: isSelected ? `${THEME.primary}26` : (pressed ? THEME.actionBackground : 'transparent'),
            borderLeftWidth: isSelected ? 4 : 0,
            borderLeftColor: THEME.primary,
          }
        ]}
      >
        <View style={{ position: 'relative' }}>
          <View style={[styles.avatar, { overflow: 'hidden' }]}>
            <Image source={ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          </View>
          {/* Desktop Status Dot */}
          <View style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: (() => {
              const isOnline = item.isOnline;
              const millis = item.lastSeen?.toMillis ? item.lastSeen.toMillis() : (item.lastSeen?.seconds ? item.lastSeen.seconds * 1000 : (item.lastSeen || 0));
              const lastSeenValid = millis && (Date.now() - millis < 5 * 60 * 1000); // 5 mins
              return (isOnline && lastSeenValid) ? THEME.success : THEME.textSecondary;
            })(),
            borderWidth: 2,
            borderColor: THEME.surface // blend with background
          }} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.rowTop}>
            <Text style={[styles.nameText, { color: THEME.text }]}>
              {nicknames[item.otherUserUid] || item.otherUserId || "Encrypted User"}
            </Text>
            <Text style={[styles.timeText, { color: THEME.textSecondary }]}>
              {timeLabel}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {item.lastMessageSenderId === user?.uid && (
                <MaterialCommunityIcons
                  name={item.lastMessageStatus === 'read' ? "check-all" : "check"}
                  size={14}
                  color={item.lastMessageStatus === 'read' ? THEME.info : THEME.textSecondary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text numberOfLines={1} style={[
                styles.messageText,
                {
                  color: (item.unreadCount > 0) ? THEME.text : THEME.textSecondary,
                  fontWeight: (item.unreadCount > 0) ? '600' : '400'
                }
              ]}>
                {(() => {
                  // useConversations pre-decrypts lastMessage before passing it here.
                  // Do NOT re-attempt sync decrypt — it fails for v5.5 (ChaCha20-Poly1305)
                  // without the PQC secret key. Trust the pre-decrypted value;
                  // blank it only if it somehow arrived still encrypted.
                  const text = item.lastMessage;
                  if (!text) return item.lastMessageTime ? "🔒 Message" : "Start a secure conversation";
                  if (isEncrypted(text)) return ""; // should not happen — blank gracefully
                  return text;
                })()}
              </Text>
            </View>

            {/* Unread Badge for Desktop */}
            {item.unreadCount > 0 && (
              <View style={{
                backgroundColor: THEME.primary,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 5,
                marginLeft: 8,
              }}>
                <Text style={{ color: THEME.surface, fontSize: 10, fontWeight: '800' }}>
                  {item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // Premium Mobile Layout
  return (
    <Pressable
      onPress={() => handleConversationPress(item.id)}
      style={({ pressed }) => [
        styles.itemContainer,
        {
          backgroundColor: isSelected
            ? `${THEME.primary}26`
            : item.unreadCount > 0
              ? `${THEME.primary}1A`
              : (pressed ? THEME.actionBackground : 'transparent'),
          paddingVertical: 1,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: 'transparent',
          borderLeftWidth: 0,
          borderLeftColor: THEME.primary,
        }
      ]}
    >
      {/* Avatar with Status & Shadow */}
      <View style={{ position: 'relative', ...select({ web: { boxShadow: '0px 4px 4px rgba(0,0,0,0.2)' }, ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 }, android: { elevation: 4 } }) }}>
        <Pressable
          onPress={() => onAvatarPress && onAvatarPress(item)}
          style={[styles.avatar, {
            width: 56, // Slightly larger
            height: 56,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: isSelected ? THEME.primary : 'rgba(255,255,255,0.1)', // Subtle border for everyone
            backgroundColor: THEME.surface,
            overflow: 'hidden',
            transform: [{ translateY: -5 }] // Specifically shift ONLY the avatar circle up
          }]}
        >
          <Image source={item.otherUserPhoto ? { uri: item.otherUserPhoto } : ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </Pressable>
        {/* Status Dot */}
        <View style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: (() => {
            const isOnline = item.isOnline;
            const millis = item.lastSeen?.toMillis ? item.lastSeen.toMillis() : (item.lastSeen?.seconds ? item.lastSeen.seconds * 1000 : (item.lastSeen || 0));
            const lastSeenValid = millis && (Date.now() - millis < 5 * 60 * 1000); // 5 mins
            return (isOnline && lastSeenValid) ? THEME.success : THEME.textSecondary;
          })(),
          borderWidth: 2,
          borderColor: THEME.background
        }} />
      </View>

      {/* Content */}
      <View style={[styles.contentContainer, { marginLeft: 16, flex: 1, justifyContent: 'center' }]}>
        <View style={[styles.rowTop, { marginBottom: 6 }]}>
          <Text style={[styles.nameText, { color: THEME.text, fontSize: 17, fontWeight: '600', letterSpacing: 0.3 }]}>
            {nicknames[item.otherUserUid] || item.otherUserId || "Encrypted User"}
          </Text>
          <Text style={[styles.timeText, {
            color: item.unreadCount > 0 ? THEME.primary : THEME.textSecondary,
            fontSize: 12,
            fontWeight: item.unreadCount > 0 ? '700' : '500'
          }]}>
            {timeLabel}
          </Text>
        </View>

        <View style={styles.rowBottom}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            {item.lastMessageSenderId === user?.uid && (
              <MaterialCommunityIcons
                name={item.lastMessageStatus === 'read' ? "check-all" : "check"}
                size={16}
                color={item.lastMessageStatus === 'read' ? THEME.info : THEME.textSecondary}
                style={{ marginRight: 6 }}
              />
            )}

            <Text
              numberOfLines={1}
              style={[styles.messageText, {
                fontSize: 15, // Larger message text
                color: (item.unreadCount > 0) ? THEME.text : THEME.textSecondary,
                fontWeight: (item.unreadCount > 0) ? '600' : '400',
                flex: 1,
                lineHeight: 20
              }]}
            >
              {(() => {
                // useConversations pre-decrypts lastMessage before passing it here.
                // Do NOT re-attempt sync decrypt — it fails for v5.5 (ChaCha20-Poly1305)
                // without the PQC secret key. Trust the pre-decrypted value;
                // blank it only if it somehow arrived still encrypted.
                const text = item.lastMessage;
                if (!text) return item.lastMessageTime ? "🔒 Message" : "Start a secure conversation";
                if (isEncrypted(text)) return ""; // should not happen — blank gracefully
                return text;
              })()}
            </Text>
          </View>

          {item.unreadCount > 0 && (
            <View style={{
              backgroundColor: THEME.primary,
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
              marginLeft: 10,
              ...select({
                web: { boxShadow: `0px 2px 3px ${THEME.primary}` },
                ios: {
                  shadowColor: THEME.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 3
                },
                android: { elevation: 3 }
              })
            }}>
              <Text style={{ color: THEME.surface, fontSize: 11, fontWeight: '800' }}>
                {item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

/** Purpose: List component for rendering active conversations on mobile. */
import React from "react";
import { View, Text, FlatList, Pressable, Animated, StyleSheet } from "react-native";
import { isWeb, select } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Components
import { getHomeStyles } from "../../styles/home.styles";
import { ConversationItem } from "./ConversationItem";

import { LoadingDots } from "../ui/loading-dots";

// BouncingDots is now replaced by the shared LoadingDots component

export const ChatList = ({
  loading,
  conversations,
  searchQuery,
  handleConversationPress,
  handleNewChat,
  myUserId,
  user,
  nicknames,
  selectedConversationId,
  THEME,
  isDesktop,
  ...rest
}) => {
  const styles = getHomeStyles(THEME);
  const insets = useSafeAreaInsets();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: !isWeb,
      tension: 100,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: !isWeb,
      tension: 100,
      friction: 5,
    }).start();
  };

  const bottomNavHeight = 65 + Math.max(insets.bottom, 10);

  if (loading) {
    return (
      <View style={styles.centered}>
        <LoadingDots color={THEME.primary} size={8} gap={4} />
      </View>
    );
  }

  if (conversations.length > 0) {
    return (
      <FlatList
        data={conversations.filter(c => c.otherUserId?.includes(searchQuery))}
        renderItem={({ item }) => (
          <ConversationItem
            item={item}
            user={user}
            nicknames={nicknames}
            selectedConversationId={selectedConversationId}
            handleConversationPress={handleConversationPress}
            onAvatarPress={rest.onAvatarPress}
            THEME={THEME}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 150, paddingTop: 0 }}
        style={{ flex: 1 }}
      />
    );
  }

  return (
    <View style={[styles.centered, { paddingBottom: isDesktop ? 0 : bottomNavHeight }]}>
      <View style={[styles.emptyIcon, { backgroundColor: `${THEME.primary}1A` }]}>
        <Feather name="message-square" size={40} color={THEME.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: THEME.text }]}>No chats yet</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Text style={{ color: THEME.textSecondary, fontSize: 13, marginBottom: 0 }}>
          Share your ID
        </Text>
        {myUserId === "Loading..." ? (
          <LoadingDots color={THEME.primary} />
        ) : (
          <Text style={{ color: THEME.primary, fontWeight: 'bold', marginLeft: 6, fontSize: 13 }}>{myUserId}</Text>
        )}
      </View>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', alignItems: 'center' }}>
        <Pressable
          onPress={handleNewChat}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={{ width: '60%', maxWidth: 220 }}
        >
          <LinearGradient
            colors={[THEME.primary, `${THEME.primary}CC`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 16,
              borderRadius: 30,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              ...select({
                ios: {
                  shadowColor: THEME.primary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                },
                android: {
                  elevation: 8,
                },
                web: {
                  boxShadow: `0px 8px 12px ${THEME.primary}4D`,
                },
              })
            }}
          >
            <Feather name="message-square" size={20} color={THEME.surface} style={{ marginRight: 10 }} />
            <Text style={{
              color: THEME.surface,
              fontWeight: '800',
              fontSize: 16,
              letterSpacing: 0.5
            }}>
              Start Chatting
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
};

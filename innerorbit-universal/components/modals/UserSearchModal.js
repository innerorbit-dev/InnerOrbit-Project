/** Purpose: Modal for searching users by their unique Public ID to start new chats. */
import React from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Image } from 'react-native';
import { select, Platform } from "../../utils/platform";
import { Feather } from "@expo/vector-icons";

const ACCOUNT_IMG = require('../../assets/account.webp');

export const UserSearchModal = ({
  visible,
  onClose,
  THEME,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  searchResult,
  onAddChat,
  isCreatingChat
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: `${THEME.background}F2`, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{
          width: '100%',
          maxWidth: 500,
          backgroundColor: THEME.surface,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: THEME.border,
          padding: 24,
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
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: THEME.text }}>New Chat</Text>
              <Text style={{ color: THEME.textSecondary, fontSize: 13, opacity: 0.8, marginTop: 2 }}>Search for users by their Public ID</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 8 }}>
              <Feather name="x" size={24} color={THEME.textSecondary} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={{ position: 'relative' }}>
            <TextInput
              style={{
                fontSize: 32,
                fontWeight: '800',
                textAlign: 'center',
                borderRadius: 16,
                paddingVertical: 20,
                borderWidth: 0,
                borderColor: 'transparent',
                color: THEME.text,
                backgroundColor: `${THEME.background}80`,
                marginBottom: 20,
                letterSpacing: 8,
                caretColor: THEME.primary
              }}
              placeholder="0000"
              placeholderTextColor={`${THEME.textSecondary}40`}
              maxLength={4}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
              autoComplete="off"
              autoCorrect={false}
              spellCheck={false}
              cursorColor={THEME.primary}
              selectionColor={THEME.primary}
              selectionHandleColor={THEME.primary}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 4, top: '50%', marginTop: -26, padding: 10, zIndex: 10 }}
              >
                <Feather name="x" size={28} color={THEME.primary} />
              </Pressable>
            )}
          </View>

          <Pressable
            onPress={onSearch}
            disabled={isSearching || !searchQuery}
            style={({ pressed }) => ({
              backgroundColor: THEME.primary,
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.9 : 1,
              marginBottom: 24
            })}
          >
            {isSearching ? <ActivityIndicator color={THEME.surface} /> : <Text style={{ color: THEME.surface, fontWeight: '700', fontSize: 16 }}>Start Search</Text>}
          </Pressable>

          {/* Result */}
          {searchResult && (
            <View style={{ padding: 16, backgroundColor: THEME.surface, borderRadius: 16, alignItems: 'center', borderColor: THEME.primary, borderWidth: 1 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', marginBottom: 12 }}>
                <Image source={ACCOUNT_IMG} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
              <Text style={{ color: THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>User {searchResult.userId}</Text>
              <Pressable
                onPress={() => onAddChat(searchResult)}
                disabled={isCreatingChat}
                style={({ pressed }) => ({ marginTop: 16, backgroundColor: THEME.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, width: '100%', alignItems: 'center', opacity: pressed ? 0.9 : 1 })}
              >
                {isCreatingChat ? <ActivityIndicator color={THEME.surface} /> : <Text style={{ color: THEME.surface, fontWeight: '700' }}>Send Request</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

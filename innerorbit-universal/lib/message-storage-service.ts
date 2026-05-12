/**
 * 🗄️ MESSAGE STORAGE SERVICE
 * 
 * PURPOSE:
 * Provides a local persistent cache for decrypted messages.
 * 
 * SECURITY HARDENING:
 * Since Double Ratchet keys are ephemeral, we store the decrypted plaintext here.
 * To prevent local leaks, every message is encrypted with the 'Device Key' 
 * (bound to the phone's Secure Enclave or WebAuthn) before hitting the disk.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from './logger';
import { encryptWithDeviceKey, decryptWithDeviceKey } from './encryption';
import { isMobile } from '../utils/platform';
import { SQLiteVault } from './storage/sqlite-vault';

const MSG_CACHE_PREFIX = '@innerorbit_msg_cache_';

export const MessageStorageService = {
  /**
   * Save a decrypted message to local storage.
   * @param conversationId 
   * @param messageId - Firestore document ID
   * @param plaintext 
   */
  async saveMessage(conversationId: string, messageId: string, plaintext: string): Promise<void> {
    try {
      if (isMobile) {
        // 🛡️ MOBILE: Use SQLite Vault
        await SQLiteVault.getInstance().saveMessage({
          id: messageId,
          conversation_id: conversationId,
          sender_id: 'unknown', // Metadata might be missing here, SyncManager handles full sync
          timestamp: Date.now(),
          type: 'text',
          status: 'read',
          is_me: 0
        }, plaintext);
      } else {
        // 🌐 WEB/DESKTOP: Fallback to AsyncStorage
        const key = `${MSG_CACHE_PREFIX}${conversationId}_${messageId}`;
        const encrypted = await encryptWithDeviceKey(plaintext);
        await AsyncStorage.setItem(key, encrypted);
      }
    } catch (e) {
      Logger.warn('[MessageStorage] Failed to save message to cache:', e);
    }
  },

  /**
   * Retrieve a decrypted message from local storage.
   * @param conversationId 
   * @param messageId 
   */
  async getMessage(conversationId: string, messageId: string): Promise<string | null> {
    try {
      if (isMobile) {
        const msg = await SQLiteVault.getInstance().getMessageById(messageId);
        return msg ? msg.plaintext : null;
      }

      const key = `${MSG_CACHE_PREFIX}${conversationId}_${messageId}`;
      const encrypted = await AsyncStorage.getItem(key);
      if (!encrypted) return null;
      
      return await decryptWithDeviceKey(encrypted);
    } catch (e) {
      return null;
    }
  },

  /**
   * Batch retrieve messages for a conversation (optimization for chat load)
   */
  async getMessagesForChat(conversationId: string, messageIds: string[]): Promise<Record<string, string>> {
    try {
      if (isMobile && messageIds.length > 0) {
        // 🛡️ MOBILE: Optimized batch fetch from SQLite
        const messages = await SQLiteVault.getInstance().getMessagesByIds(messageIds);
        const results: Record<string, string> = {};
        for (const msg of messages) {
          results[msg.id] = msg.plaintext;
        }
        return results;
      }

      // 🌐 WEB/DESKTOP: Fallback to AsyncStorage
      const keys = messageIds.map(id => `${MSG_CACHE_PREFIX}${conversationId}_${id}`);
      const pairs = await AsyncStorage.multiGet(keys);
      
      const results: Record<string, string> = {};
      for (const [key, value] of pairs) {
        if (value) {
          try {
            const msgId = key.replace(`${MSG_CACHE_PREFIX}${conversationId}_`, '');
            results[msgId] = await decryptWithDeviceKey(value);
          } catch (err) {
            Logger.warn(`[MessageStorage] Failed to decrypt cached message: ${key}`);
          }
        }
      }
      return results;
    } catch (e) {
      return {};
    }
  },

  /**
   * Clear all cached messages for a conversation (e.g. on "Clear Chat")
   */
  async clearChat(conversationId: string): Promise<void> {
    try {
      if (isMobile) {
        // 🛡️ MOBILE: Clear from SQLite Vault
        await SQLiteVault.getInstance().clearConversationMessages(conversationId);
      }
      
      // Also clear from AsyncStorage (cleanup legacy or shared keys)
      const allKeys = await AsyncStorage.getAllKeys();
      const chatKeys = allKeys.filter(k => k.startsWith(`${MSG_CACHE_PREFIX}${conversationId}_`));
      await AsyncStorage.multiRemove(chatKeys);
      Logger.log(`[MessageStorage] 🗑️ Cleared ${chatKeys.length} messages from local cache for ${conversationId}`);
    } catch (e) {
      Logger.warn('[MessageStorage] Failed to clear chat cache:', e);
    }
  }
};



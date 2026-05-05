/** Purpose: Manages GDPR/CCPA data portability (export) and permanent account deletion logic. */
import { getUserProfile, getUserConversations, getConversationMessages } from './firestore-service';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { isWeb } from '../utils/platform';
import { Logger } from './logger';

/**
 * Data Export Service for GDPR/CCPA Compliance
 * Allows users to export all their personal data
 */

/**
 * Export all user data to JSON format
 * @param {string} userId - User's UID
 * @returns {Promise<object>} Complete user data export
 */
export async function exportUserData(userId) {
    try {
        const sanitizedId = userId ? `${userId.substring(0, 4)}...` : 'unknown';
        Logger.log('[DataExport] Starting data export for user:', sanitizedId);

        // 1. Get user profile
        const profile = await getUserProfile(userId);

        // 2. Get all conversations
        const conversations = await getUserConversations(userId);

        // 3. Get all messages from all conversations
        const conversationsWithMessages = await Promise.all(
            conversations.map(async (conv) => {
                const messages = await getConversationMessages(conv.id);
                return {
                    conversationId: conv.id,
                    participants: conv.participantIds,
                    createdAt: conv.createdAt?.toDate().toISOString(),
                    messages: messages.map(msg => ({
                        id: msg.id,
                        senderId: msg.senderId,
                        text: msg.encryptedText,
                        timestamp: msg.timestamp?.toDate().toISOString(),
                        status: msg.status,
                        type: msg.type,
                        isEdited: msg.isEdited,
                        isDeleted: msg.isDeleted,
                    }))
                };
            })
        );

        // 4. Compile complete data export
        const exportData = {
            exportDate: new Date().toISOString(),
            exportVersion: '1.0',
            userData: {
                uid: profile.uid || userId,
                email: profile.email,
                userId: profile.userId,
                bio: profile.bio,
                photoURL: profile.photoURL,
                createdAt: profile.createdAt?.toDate().toISOString(),
                lastSeen: profile.lastSeen?.toDate().toISOString(),
            },
            conversations: conversationsWithMessages,
            statistics: {
                totalConversations: conversations.length,
                totalMessages: conversationsWithMessages.reduce((sum, conv) => sum + conv.messages.length, 0),
            },
            legalNotice: 'This data export was generated in compliance with GDPR Article 20 (Right to Data Portability) and CCPA §1798.100. All encrypted messages are included in their encrypted form.',
        };

        Logger.log('[DataExport] Data export completed successfully');
        return exportData;

    } catch (error) {
        Logger.error('[DataExport] Error exporting user data:', error);
        throw new Error('Failed to export user data: ' + error.message);
    }
}

/**
 * Download exported data as JSON file
 * @param {object} exportData - Data to export
 * @param {string} userId - User ID for filename
 */
export async function downloadDataExport(exportData, userId) {
    try {
        const fileName = `cipherplay-data-export-${userId}-${Date.now()}.json`;
        const jsonString = JSON.stringify(exportData, null, 2);

        if (isWeb) {
            // Web: Create download link
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            Logger.log('[DataExport] File downloaded (web):', fileName);
        } else {
            // Mobile: Save to file system and share
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, jsonString);

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/json',
                    dialogTitle: 'Save Your Data Export',
                    UTI: 'public.json'
                });
            }
            Logger.log('[DataExport] File saved and shared (mobile):', fileName);
        }

        return fileName;

    } catch (error) {
        Logger.error('[DataExport] Error downloading data:', error);
        throw new Error('Failed to download data export: ' + error.message);
    }
}

/**
 * Complete data deletion - removes ALL user data
 * @param {string} userId - User's UID
 * @param {object} auth - Firebase auth instance
 */
export async function completeDataDeletion(userId, auth) {
    try {
        Logger.log('[DataDeletion] Starting complete data deletion for user:', userId);

        // Import deletion functions
        const {
            deleteUserProfile,
            getUserConversations,
            deleteConversation
        } = await import('./firestore-service');

        const { deleteObject, ref } = await import('firebase/storage');
        const { storage } = await import('./firebase');

        // 1. Get all conversations
        const conversations = await getUserConversations(userId);
        Logger.log(`[DataDeletion] Found ${conversations.length} conversations to delete`);

        // 2. Delete all conversations and their messages
        for (const conv of conversations) {
            try {
                await deleteConversation(conv.id);
                Logger.log(`[DataDeletion] Deleted conversation: ${conv.id}`);
            } catch (error) {
                Logger.error(`[DataDeletion] Error deleting conversation ${conv.id}:`, error);
                // Continue with other deletions
            }
        }

        // 3. Delete profile picture from storage (if exists)
        const profile = await getUserProfile(userId);
        if (profile?.photoURL) {
            try {
                const photoRef = ref(storage, `profiles/${userId}/`);
                await deleteObject(photoRef);
                Logger.log('[DataDeletion] Deleted profile picture');
            } catch (error) {
                Logger.log('[DataDeletion] No profile picture to delete or already deleted');
            }
        }

        // 4. Delete user profile from Firestore
        await deleteUserProfile(userId);
        Logger.log('[DataDeletion] Deleted user profile');

        // 5. Delete Firebase Auth account (if available)
        if (auth.currentUser && auth.currentUser.uid === userId) {
            await auth.currentUser.delete();
            Logger.log('[DataDeletion] Deleted Firebase Auth account');
        }

        // 6. Clear local storage
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.default.clear();
        Logger.log('[DataDeletion] Cleared local storage');

        // 7. Clear secure storage
        const SecureStorage = await import('./secure-storage-service');
        await SecureStorage.default.clearAllCredentials();
        Logger.log('[DataDeletion] Cleared secure storage');

        Logger.log('[DataDeletion] ✅ Complete data deletion finished successfully');
        return true;

    } catch (error) {
        Logger.error('[DataDeletion] Error during data deletion:', error);
        throw new Error('Failed to complete data deletion: ' + error.message);
    }
}

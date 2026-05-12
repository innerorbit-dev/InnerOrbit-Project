import { getUserConversations, getConversationMessages } from '../firestore-service';
import { decryptAsync, deriveConversationKey } from '../encryption';
import { SQLiteVault } from './sqlite-vault';
import { Logger } from '../logger';
import { isMobile } from '../../utils/platform';

/**
 * 🔄 SYNC MANAGER
 * 
 * PURPOSE:
 * Orchestrates the "Fresh Vault" migration by fetching all messages from 
 * Firestore, decrypting them, and populating the SQLite Vault.
 */
export class SyncManager {
  private vault = SQLiteVault.getInstance();
  private static instance: SyncManager;

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Performs a full synchronization from Firestore to SQLite.
   * This should be called on the first app update or when the local DB is empty.
   */
  public async performFullSync(myUid: string): Promise<void> {
    if (!isMobile) return;

    Logger.log('[SyncManager] 🔄 Starting Full Synchronization...');
    
    try {
      // 1. Initialize Vault
      await this.vault.initialize();

      // 2. Check if sync is already done
      const localConvs = await this.vault.getConversations();
      const isAlreadySynced = localConvs.some(c => {
        try {
          const meta = JSON.parse(c.metadata || '{}');
          return meta.synced === true;
        } catch (e) { return false; }
      });

      if (isAlreadySynced) {
        Logger.log('[SyncManager] ℹ️ Local vault already has synced data. Skipping full sync.');
        return;
      }

      // 3. Fetch all conversations
      const conversations = await getUserConversations(myUid);
      Logger.log(`[SyncManager] Found ${conversations.length} conversations.`);
      
      // 🚀 PARALLEL SYNC: Process conversations in chunks to speed up migration
      const CONCURRENCY_LIMIT = 5;
      for (let i = 0; i < conversations.length; i += CONCURRENCY_LIMIT) {
        const chunk = conversations.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(chunk.map(conv => this.syncConversation(conv, myUid)));
        Logger.log(`[SyncManager] 🔄 Progress: ${Math.min(i + CONCURRENCY_LIMIT, conversations.length)}/${conversations.length} conversations synced.`);
      }

      Logger.log('[SyncManager] ✅ Full Sync completed successfully.');
    } catch (error) {
      Logger.error('[SyncManager] ❌ Full Sync failed:', error);
    }
  }

  /**
   * Syncs a single conversation's messages.
   */
  public async syncConversation(conversation: any, myUid: string): Promise<void> {
    const conversationId = conversation.id;
    try {
      Logger.log(`[SyncManager] Syncing conversation: ${conversationId.substring(0, 8)}...`);
      
      // 1. Resolve partner UID before starting decryption
      const partnerUid = conversation.participantIds?.find((id: string) => id !== myUid) || '';
      Logger.log(`[SyncManager] Resolving partnerUid: ${partnerUid || 'none (self-chat?)'}`);

      const messages = await getConversationMessages(conversationId) as any[];
      const batch: Array<{ msg: any, plaintext: string }> = [];

      // 🔑 DERIVE KEY: Used as fallback for legacy v1, v2, and v3 messages
      const participantIds = conversation.participantIds || [myUid, partnerUid].filter(Boolean);
      const secretKey = deriveConversationKey(conversationId, participantIds);

      for (const msg of messages) {
        // The senderId might be 'sealed' or actual UID depending on protocol version
        // We try to decrypt to recover the actual content and sender
        const decrypted = await decryptAsync(
          msg.encryptedText,
          secretKey, // 🛡️ Correct key for v1/v2/v3 fallback
          conversationId,
          undefined, // pqcSecretKey (unused for v4/v6)
          myUid,
          partnerUid, // Pass resolved partner UID for session initialization
          msg.id
        );

        let plaintext = '';
        let senderId = msg.senderId || 'unknown';

        if (typeof decrypted === 'object' && decrypted !== null) {
          plaintext = decrypted.text;
          senderId = decrypted.senderId || senderId;
        } else {
          plaintext = decrypted;
        }

        if (plaintext && plaintext !== '🔒 Encrypted' && plaintext !== '🔒 Failed') {
          batch.push({
            msg: {
              id: msg.id,
              conversation_id: conversationId,
              sender_id: senderId,
              type: msg.type || 'text',
              timestamp: msg.timestamp?.toMillis ? msg.timestamp.toMillis() : Date.now(),
              status: msg.status || 'read',
              is_me: senderId === myUid
            },
            plaintext
          });
        }
      }

      if (batch.length > 0) {
        await this.vault.saveMessagesBatch(batch);
      }
      
      // Update conversation metadata in vault
      const lastMsg = messages[messages.length - 1] as any;
      if (lastMsg) {
        // Resolve partner ID
        const partner_id = conversation.participantIds?.find((id: string) => id !== myUid) || '';
        
        await this.vault.updateConversation({
          id: conversationId,
          partner_id, 
          last_message: lastMsg.encryptedText || '', 
          last_timestamp: lastMsg.timestamp?.toMillis ? lastMsg.timestamp.toMillis() : Date.now(),
          unread_count: 0,
          metadata: JSON.stringify({ synced: true })
        });
      }

    } catch (error) {
      Logger.error(`[SyncManager] Failed to sync conversation ${conversationId}:`, error);
    }
  }
}

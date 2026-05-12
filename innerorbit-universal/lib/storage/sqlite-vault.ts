import * as SQLite from 'expo-sqlite';
import { isMobile } from '../../utils/platform';
import { SCHEMA, SQLiteMessage, SQLiteConversation } from './schema';
import { encryptWithDeviceKey, decryptWithDeviceKey } from '../encryption';
import { Logger } from '../logger';

const DB_NAME = 'innerorbit_vault.db';

export class SQLiteVault {
  private db: SQLite.SQLiteDatabase | null = null;
  private static instance: SQLiteVault;

  private constructor() {}

  public static getInstance(): SQLiteVault {
    if (!SQLiteVault.instance) {
      SQLiteVault.instance = new SQLiteVault();
    }
    return SQLiteVault.instance;
  }

  /**
   * Initialize the database and tables.
   */
  public async initialize(): Promise<void> {
    if (!isMobile) {
      Logger.log('[SQLiteVault] Skipping native DB init on Web.');
      return;
    }

    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      
      // 🏗️ Create Tables
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${SCHEMA.TABLES.MESSAGES} (${SCHEMA.COLUMNS.MESSAGES});
        CREATE TABLE IF NOT EXISTS ${SCHEMA.TABLES.CONVERSATIONS} (${SCHEMA.COLUMNS.CONVERSATIONS});
      `);

      // ⚡ Create Indexes
      for (const indexSql of SCHEMA.INDEXES) {
        await this.db.execAsync(indexSql);
      }

      Logger.log('[SQLiteVault] 🛡️ Database initialized successfully.');
    } catch (error) {
      Logger.error('[SQLiteVault] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * 🔒 SAVE MESSAGE
   * Re-encrypts plaintext with Device Key before storing.
   */
  public async saveMessage(msg: Omit<SQLiteMessage, 'content'>, plaintext: string): Promise<void> {
    if (!this.db) return;

    try {
      const encryptedContent = await encryptWithDeviceKey(plaintext);
      
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${SCHEMA.TABLES.MESSAGES} 
        (id, conversation_id, sender_id, content, type, timestamp, status, is_me) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [msg.id, msg.conversation_id, msg.sender_id, encryptedContent, msg.type, msg.timestamp, msg.status, msg.is_me]
      );
    } catch (error) {
      Logger.error('[SQLiteVault] Save message failed:', error);
    }
  }

  /**
   * 🔒 BATCH SAVE MESSAGES
   * Optimized for initial sync.
   */
  public async saveMessagesBatch(messages: Array<{ msg: Omit<SQLiteMessage, 'content'>, plaintext: string }>): Promise<void> {
    if (!this.db || messages.length === 0) return;

    try {
      await this.db.withTransactionAsync(async () => {
        for (const { msg, plaintext } of messages) {
          const encryptedContent = await encryptWithDeviceKey(plaintext);
          await this.db!.runAsync(
            `INSERT OR REPLACE INTO ${SCHEMA.TABLES.MESSAGES} 
            (id, conversation_id, sender_id, content, type, timestamp, status, is_me) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [msg.id, msg.conversation_id, msg.sender_id, encryptedContent, msg.type, msg.timestamp, msg.status, msg.is_me]
          );
        }
      });
      Logger.log(`[SQLiteVault] 🚀 Batch saved ${messages.length} messages.`);
    } catch (error) {
      Logger.error('[SQLiteVault] Batch save failed:', error);
    }
  }

  /**
   * 🔓 GET MESSAGE BY ID
   */
  public async getMessageById(messageId: string): Promise<(SQLiteMessage & { plaintext: string }) | null> {
    if (!this.db) return null;

    try {
      const row = await this.db.getFirstAsync<SQLiteMessage>(
        `SELECT * FROM ${SCHEMA.TABLES.MESSAGES} WHERE id = ?`,
        [messageId]
      );

      if (!row) return null;

      try {
        const plaintext = row.content ? await decryptWithDeviceKey(row.content) : '';
        return { ...row, plaintext };
      } catch (err) {
        return { ...row, plaintext: '[🔒 Decryption Error]' };
      }
    } catch (error) {
      Logger.error('[SQLiteVault] Get message by ID failed:', error);
      return null;
    }
  }

  /**
   * 🔓 GET MESSAGES
   * Decrypts content on-the-fly.
   */
  public async getMessages(conversationId: string, limit: number = 50): Promise<Array<SQLiteMessage & { plaintext: string }>> {
    if (!this.db) return [];

    try {
      const rows = await this.db.getAllAsync<SQLiteMessage>(
        `SELECT * FROM ${SCHEMA.TABLES.MESSAGES} WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [conversationId, limit]
      );

      const results = [];
      for (const row of rows) {
        try {
          const plaintext = row.content ? await decryptWithDeviceKey(row.content) : '';
          results.push({ ...row, plaintext });
        } catch (err) {
          results.push({ ...row, plaintext: '[🔒 Decryption Error]' });
        }
      }
      return results.reverse();
    } catch (error) {
      Logger.error('[SQLiteVault] Get messages failed:', error);
      return [];
    }
  }

  /**
   * 🗑️ CLEAR CONVERSATION MESSAGES
   */
  public async clearConversationMessages(conversationId: string): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `DELETE FROM ${SCHEMA.TABLES.MESSAGES} WHERE conversation_id = ?`,
        [conversationId]
      );
      Logger.log(`[SQLiteVault] 🗑️ Cleared messages for conversation ${conversationId}`);
    } catch (error) {
      Logger.error('[SQLiteVault] Clear messages failed:', error);
    }
  }

  /**
   * 🔓 GET MESSAGES BY IDS
   */
  public async getMessagesByIds(messageIds: string[]): Promise<Array<SQLiteMessage & { plaintext: string }>> {
    if (!this.db || messageIds.length === 0) return [];

    try {
      const placeholders = messageIds.map(() => '?').join(',');
      const rows = await this.db.getAllAsync<SQLiteMessage>(
        `SELECT * FROM ${SCHEMA.TABLES.MESSAGES} WHERE id IN (${placeholders})`,
        messageIds
      );

      const results = [];
      for (const row of rows) {
        try {
          const plaintext = row.content ? await decryptWithDeviceKey(row.content) : '';
          results.push({ ...row, plaintext });
        } catch (err) {
          results.push({ ...row, plaintext: '[🔒 Decryption Error]' });
        }
      }
      return results;
    } catch (error) {
      Logger.error('[SQLiteVault] Get messages by IDs failed:', error);
      return [];
    }
  }

  /**
   * 🔎 SEARCH MESSAGES
   * Decrypts messages to perform search (Note: Future optimization could involve searchable encryption)
   */
  public async searchMessages(query: string): Promise<Array<SQLiteMessage & { plaintext: string }>> {
    if (!this.db) return [];

    try {
      // In a real implementation, we would use a more efficient search or search-optimized indices.
      // For now, we perform a broader fetch and filter to ensure privacy.
      const rows = await this.db.getAllAsync<SQLiteMessage>(
        `SELECT * FROM ${SCHEMA.TABLES.MESSAGES} ORDER BY timestamp DESC LIMIT 500`
      );

      const results = [];
      const lowerQuery = query.toLowerCase();

      for (const row of rows) {
        try {
          const plaintext = row.content ? await decryptWithDeviceKey(row.content) : '';
          if (plaintext.toLowerCase().includes(lowerQuery)) {
            results.push({ ...row, plaintext });
          }
        } catch (err) {}
      }
      return results;
    } catch (error) {
      Logger.error('[SQLiteVault] Search failed:', error);
      return [];
    }
  }


  /**
   * 🔄 CONVERSATION MANAGEMENT
   */
  public async updateConversation(conv: SQLiteConversation): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO ${SCHEMA.TABLES.CONVERSATIONS} 
        (id, partner_id, last_message, last_timestamp, unread_count, metadata) 
        VALUES (?, ?, ?, ?, ?, ?)`,
        [conv.id, conv.partner_id, conv.last_message, conv.last_timestamp, conv.unread_count, conv.metadata || null]
      );
    } catch (error) {
      Logger.error('[SQLiteVault] Update conversation failed:', error);
    }
  }

  public async getConversations(): Promise<SQLiteConversation[]> {
    if (!this.db) return [];
    try {
      return await this.db.getAllAsync<SQLiteConversation>(
        `SELECT * FROM ${SCHEMA.TABLES.CONVERSATIONS} ORDER BY last_timestamp DESC`
      );
    } catch (error) {
      Logger.error('[SQLiteVault] Get conversations failed:', error);
      return [];
    }
  }
}

/**
 * 📊 SQLITE SCHEMA & TYPES
 * 
 * Defines the structured storage for the InnerOrbit SQLite Vault.
 */

export interface SQLiteMessage {
  id: string; // Firestore Message ID
  conversation_id: string;
  sender_id: string;
  content: string; // Encrypted (v3.5 SIV)
  type: 'text' | 'image' | 'file' | 'system';
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  is_me: number; // SQLite uses 0/1 for booleans
}

export interface SQLiteConversation {
  id: string; // Conversation ID
  partner_id: string;
  last_message: string; // Encrypted preview
  last_timestamp: number;
  unread_count: number;
  metadata?: string; // JSON stringified extra info
}

export const SCHEMA = {
  TABLES: {
    MESSAGES: 'messages',
    CONVERSATIONS: 'conversations',
  },
  COLUMNS: {
    MESSAGES: `
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'text',
      timestamp INTEGER NOT NULL,
      status TEXT DEFAULT 'sent',
      is_me INTEGER DEFAULT 0
    `,
    CONVERSATIONS: `
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      last_message TEXT,
      last_timestamp INTEGER,
      unread_count INTEGER DEFAULT 0,
      metadata TEXT
    `
  },
  INDEXES: [
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);',
    'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);',
    'CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(last_timestamp);'
  ]
};

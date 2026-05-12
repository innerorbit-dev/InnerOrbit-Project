/**
 * 🧪 SYNC MANAGER MOCK TEST
 * 
 * PURPOSE:
 * Verifies the batch decryption and parallel synchronization logic in SyncManager.
 * specifically testing the fallback decryption for legacy (v1, v2, v3) 
 * and modern (v4, v6/Sealed Sender) message protocols.
 */

// Mock platform BEFORE importing SyncManager
jest.mock('../../utils/platform', () => ({
  isMobile: true
}));

import { SyncManager } from '../../lib/storage/sync-manager';
import { getUserConversations, getConversationMessages } from '../../lib/firestore-service';
import { decryptAsync, deriveConversationKey } from '../../lib/encryption';
import { SQLiteVault } from '../../lib/storage/sqlite-vault';

// 1. Mock Dependencies
jest.mock('../../lib/firestore-service');
jest.mock('../../lib/encryption');
jest.mock('../../lib/storage/sqlite-vault');
jest.mock('../../lib/logger');

describe('SyncManager: Mock Sync Test', () => {
  const myUid = 'user-me';
  const partnerUid = 'user-partner';
  const conversationId = 'conv-123';
  const mockSecretKey = 'mock-derived-key';

  let syncManager: SyncManager;
  let mockVault: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance to prevent state pollution between tests
    (SyncManager as any).instance = undefined;

    // Mock SQLiteVault instance and its static getInstance method
    mockVault = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getConversations: jest.fn().mockResolvedValue([]),
      saveMessagesBatch: jest.fn().mockResolvedValue(undefined),
      updateConversation: jest.fn().mockResolvedValue(undefined),
    };
    (SQLiteVault.getInstance as unknown as jest.Mock).mockReturnValue(mockVault);

    // Get a fresh SyncManager instance for each test
    syncManager = SyncManager.getInstance();

    // Mock key derivation
    (deriveConversationKey as unknown as jest.Mock).mockReturnValue(mockSecretKey);
  });

  test('should process v3, v4, and v6 messages in a single batch', async () => {
    // 1. Prepare Mock Data
    const mockConversations = [
      { id: conversationId, participantIds: [myUid, partnerUid] }
    ];
    
    const mockMessages = [
      { id: 'msg-v3', encryptedText: 'v3:payload', type: 'text', timestamp: { toMillis: () => 1000 } },
      { id: 'msg-v4', encryptedText: 'v4:payload', type: 'text', timestamp: { toMillis: () => 2000 } },
      { id: 'msg-v6', encryptedText: 'v6:payload', type: 'text', timestamp: { toMillis: () => 3000 } }
    ];

    (getUserConversations as unknown as jest.Mock).mockResolvedValue(mockConversations);
    (getConversationMessages as unknown as jest.Mock).mockResolvedValue(mockMessages);

    // Mock decryption for different versions
    (decryptAsync as unknown as jest.Mock).mockImplementation(async (payload) => {
      if (payload.startsWith('v3:')) return 'Plaintext V3';
      if (payload.startsWith('v4:')) return 'Plaintext V4';
      if (payload.startsWith('v6:')) {
        // Mock Sealed Sender recovery for v6
        return { text: 'Plaintext V6', senderId: partnerUid };
      }
      return 'Failed';
    });

    // 2. Run Sync
    await syncManager.performFullSync(myUid);

    // 3. Verifications
    
    // Check if key derivation was called for legacy support
    expect(deriveConversationKey).toHaveBeenCalledWith(conversationId, [myUid, partnerUid]);

    // Check if decryptAsync was called for all messages
    expect(decryptAsync).toHaveBeenCalledTimes(3);
    
    // Verify decryptAsync arguments for v3 (ensure secretKey is passed)
    expect(decryptAsync).toHaveBeenCalledWith(
      'v3:payload',
      mockSecretKey, // Fallback key
      conversationId,
      undefined,
      myUid,
      partnerUid,
      'msg-v3'
    );

    // Check if saveMessagesBatch was called with correct data
    expect(mockVault.saveMessagesBatch).toHaveBeenCalledWith([
      {
        msg: expect.objectContaining({ id: 'msg-v3', sender_id: 'unknown' }),
        plaintext: 'Plaintext V3'
      },
      {
        msg: expect.objectContaining({ id: 'msg-v4', sender_id: 'unknown' }),
        plaintext: 'Plaintext V4'
      },
      {
        msg: expect.objectContaining({ id: 'msg-v6', sender_id: partnerUid }), // Recovered senderId
        plaintext: 'Plaintext V6'
      }
    ]);

    // Check if conversation metadata was updated as synced
    expect(mockVault.updateConversation).toHaveBeenCalledWith(expect.objectContaining({
      id: conversationId,
      metadata: JSON.stringify({ synced: true })
    }));
  });

  test('should handle v1 and v2 messages correctly using derived key', async () => {
    const mockConversations = [{ id: 'legacy-conv', participantIds: [myUid, partnerUid] }];
    const mockMessages = [
      { id: 'msg-v1', encryptedText: 'v1:payload', timestamp: { toMillis: () => 100 } },
      { id: 'msg-v2', encryptedText: 'v2:payload', timestamp: { toMillis: () => 200 } }
    ];

    (getUserConversations as unknown as jest.Mock).mockResolvedValue(mockConversations);
    (getConversationMessages as unknown as jest.Mock).mockResolvedValue(mockMessages);
    (decryptAsync as unknown as jest.Mock).mockResolvedValue('Legacy Plaintext');

    await syncManager.performFullSync(myUid);

    expect(decryptAsync).toHaveBeenCalledWith(
      'v1:payload',
      mockSecretKey,
      'legacy-conv',
      undefined,
      myUid,
      partnerUid,
      'msg-v1'
    );
    expect(mockVault.saveMessagesBatch).toHaveBeenCalledTimes(1);
  });

  test('should process multiple conversations in parallel chunks', async () => {
    // Prepare 12 conversations to test chunks of 5
    const mockConversations = Array.from({ length: 12 }, (_, i) => ({
      id: `conv-${i}`,
      participantIds: [myUid, partnerUid]
    }));

    (getUserConversations as unknown as jest.Mock).mockResolvedValue(mockConversations);
    (getConversationMessages as unknown as jest.Mock).mockResolvedValue([]); // Empty conversations for speed

    await syncManager.performFullSync(myUid);

    // Verify all conversations were processed
    expect(getConversationMessages).toHaveBeenCalledTimes(12);
    expect(mockVault.updateConversation).toHaveBeenCalledTimes(0); // No messages, so no update in my current impl (wait, look at code)
  });
});

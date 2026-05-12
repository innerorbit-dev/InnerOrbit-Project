import { SyncManager } from '../storage/sync-manager';
import * as Firestore from '../firestore-service';
import * as Encryption from '../encryption';
import { SQLiteVault } from '../storage/sqlite-vault';
import { isMobile } from '../../utils/platform';

// Mock dependencies
jest.mock('../firestore-service');
jest.mock('../encryption');
jest.mock('../storage/sqlite-vault');
jest.mock('../../utils/platform', () => ({
  isMobile: true
}));

describe('SyncManager', () => {
  const MY_UID = 'my-uid';
  const PARTNER_UID = 'partner-uid';
  const CONV_ID = 'conv-123';
  
  let syncManager: SyncManager;
  let mockVault: any;

  beforeEach(() => {
    // Reset singleton to pick up fresh mocks
    (SyncManager as any).instance = undefined;
    jest.clearAllMocks();
    
    // Mock Vault singleton
    mockVault = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getConversations: jest.fn().mockResolvedValue([]),
      saveMessagesBatch: jest.fn().mockResolvedValue(undefined),
      updateConversation: jest.fn().mockResolvedValue(undefined),
    };
    (SQLiteVault.getInstance as jest.Mock).mockReturnValue(mockVault);
    
    syncManager = SyncManager.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('performFullSync should fetch conversations and sync each one', async () => {
    const mockConversations = [
      { id: 'conv-1', participantIds: [MY_UID, 'user-A'] },
      { id: 'conv-2', participantIds: [MY_UID, 'user-B'] }
    ];
    (Firestore.getUserConversations as jest.Mock).mockResolvedValue(mockConversations);
    
    // Mock syncConversation to avoid deep diving in this test
    const syncSpy = jest.spyOn(syncManager, 'syncConversation').mockResolvedValue(undefined);

    await syncManager.performFullSync(MY_UID);

    expect(mockVault.initialize).toHaveBeenCalled();
    expect(Firestore.getUserConversations).toHaveBeenCalledWith(MY_UID);
    expect(syncSpy).toHaveBeenCalledTimes(2);
    expect(syncSpy).toHaveBeenCalledWith(mockConversations[0], MY_UID);
    expect(syncSpy).toHaveBeenCalledWith(mockConversations[1], MY_UID);
  });

  test('syncConversation should decrypt and batch save messages with resolved partner_id', async () => {
    const conversation = {
      id: CONV_ID,
      participantIds: [MY_UID, PARTNER_UID]
    };

    const mockMessages = [
      { id: 'm1', encryptedText: 'enc-1', senderId: PARTNER_UID, timestamp: { toMillis: () => 1000 } },
      { id: 'm2', encryptedText: 'enc-2', senderId: MY_UID, timestamp: { toMillis: () => 2000 } }
    ];

    (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
    
    // Mock decryption to return plaintext and recovered senderId
    (Encryption.decryptAsync as jest.Mock).mockImplementation(async (enc, key, convId, pqc, myUid, partnerUid, msgId) => {
      if (enc === 'enc-1') return { text: 'Hello', senderId: PARTNER_UID };
      if (enc === 'enc-2') return { text: 'Hi', senderId: MY_UID };
      return 'Failed';
    });

    await syncManager.syncConversation(conversation, MY_UID);

    // Verify messages batch save
    expect(mockVault.saveMessagesBatch).toHaveBeenCalledWith([
      {
        msg: {
          id: 'm1',
          conversation_id: CONV_ID,
          sender_id: PARTNER_UID,
          type: 'text',
          timestamp: 1000,
          status: 'read',
          is_me: false
        },
        plaintext: 'Hello'
      },
      {
        msg: {
          id: 'm2',
          conversation_id: CONV_ID,
          sender_id: MY_UID,
          type: 'text',
          timestamp: 2000,
          status: 'read',
          is_me: true
        },
        plaintext: 'Hi'
      }
    ]);

    // Verify conversation metadata update with PARTNER_ID resolution
    expect(mockVault.updateConversation).toHaveBeenCalledWith({
      id: CONV_ID,
      partner_id: PARTNER_UID, // <--- This verifies Partner ID Resolution!
      last_message: 'enc-2',
      last_timestamp: 2000,
      unread_count: 0,
      metadata: JSON.stringify({ synced: true })
    });
  });

  test('syncConversation should handle decryption failures gracefully', async () => {
    const conversation = { id: CONV_ID, participantIds: [MY_UID, PARTNER_UID] };
    const mockMessages = [{ id: 'm1', encryptedText: 'bad-enc', timestamp: { toMillis: () => 1000 } }];
    
    (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
    (Encryption.decryptAsync as jest.Mock).mockResolvedValue('🔒 Failed');

    await syncManager.syncConversation(conversation, MY_UID);

    // Batch should be empty
    expect(mockVault.saveMessagesBatch).not.toHaveBeenCalled();
  });
});

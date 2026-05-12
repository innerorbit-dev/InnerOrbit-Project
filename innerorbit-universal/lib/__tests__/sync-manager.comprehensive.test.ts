import { SyncManager } from '../storage/sync-manager';
import * as Firestore from '../firestore-service';
import * as Encryption from '../encryption';
import { SQLiteVault } from '../storage/sqlite-vault';
import { isMobile } from '../../utils/platform';

// Mock dependencies
jest.mock('../firestore-service');
jest.mock('../encryption');
jest.mock('../storage/sqlite-vault');

let mockIsMobile = true;
jest.mock('../../utils/platform', () => ({
  get isMobile() { return mockIsMobile; }
}));

describe('SyncManager Comprehensive Suite', () => {
  const MY_UID = 'user-123';
  const PARTNER_UID = 'user-456';
  const CONV_ID = 'conv-xyz';
  
  let syncManager: SyncManager;
  let mockVault: any;

  beforeEach(() => {
    // Reset singleton
    (SyncManager as any).instance = undefined;
    jest.clearAllMocks();
    
    mockIsMobile = true;

    // Mock Vault singleton
    mockVault = {
      initialize: jest.fn().mockResolvedValue(undefined),
      saveMessagesBatch: jest.fn().mockResolvedValue(undefined),
      updateConversation: jest.fn().mockResolvedValue(undefined),
      getConversations: jest.fn().mockResolvedValue([]),
    };
    (SQLiteVault.getInstance as jest.Mock).mockReturnValue(mockVault);
    
    syncManager = SyncManager.getInstance();
  });

  describe('performFullSync', () => {
    test('should return immediately on non-mobile platforms', async () => {
      mockIsMobile = false;
      
      await syncManager.performFullSync(MY_UID);
      
      expect(mockVault.initialize).not.toHaveBeenCalled();
      expect(Firestore.getUserConversations).not.toHaveBeenCalled();
    });

    test('should initialize vault and process all conversations', async () => {
      const mockConversations = [
        { id: 'c1', participantIds: [MY_UID, 'p1'] },
        { id: 'c2', participantIds: [MY_UID, 'p2'] }
      ];
      (Firestore.getUserConversations as jest.Mock).mockResolvedValue(mockConversations);
      
      const syncSpy = jest.spyOn(syncManager, 'syncConversation').mockResolvedValue(undefined);

      await syncManager.performFullSync(MY_UID);

      expect(mockVault.initialize).toHaveBeenCalled();
      expect(Firestore.getUserConversations).toHaveBeenCalledWith(MY_UID);
      expect(syncSpy).toHaveBeenCalledTimes(2);
      expect(syncSpy).toHaveBeenCalledWith(mockConversations[0], MY_UID);
      expect(syncSpy).toHaveBeenCalledWith(mockConversations[1], MY_UID);
    });

    test('should skip sync if local vault already has synced data', async () => {
      mockVault.getConversations.mockResolvedValue([
        { id: 'c1', metadata: JSON.stringify({ synced: true }) }
      ]);
      
      const syncSpy = jest.spyOn(syncManager, 'syncConversation');

      await syncManager.performFullSync(MY_UID);

      expect(Firestore.getUserConversations).not.toHaveBeenCalled();
      expect(syncSpy).not.toHaveBeenCalled();
    });
  });

  describe('syncConversation & Partner ID Resolution', () => {
    test('should resolve partner_id and batch save decrypted messages', async () => {
      const conversation = {
        id: CONV_ID,
        participantIds: [MY_UID, PARTNER_UID]
      };

      const mockMessages = [
        { id: 'm1', encryptedText: 'enc-1', senderId: PARTNER_UID, timestamp: { toMillis: () => 1000 } },
        { id: 'm2', encryptedText: 'enc-2', senderId: MY_UID, timestamp: { toMillis: () => 2000 } }
      ];

      (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
      
      // Mock standard decryption
      (Encryption.decryptAsync as jest.Mock).mockImplementation(async (enc) => {
        if (enc === 'enc-1') return 'Hello Partner';
        if (enc === 'enc-2') return 'Hi Me';
        return 'Failed';
      });

      await syncManager.syncConversation(conversation, MY_UID);

      // Verify Partner ID Resolution
      expect(mockVault.updateConversation).toHaveBeenCalledWith(expect.objectContaining({
        id: CONV_ID,
        partner_id: PARTNER_UID
      }));

      // Verify Batch Save Integrity
      expect(mockVault.saveMessagesBatch).toHaveBeenCalledWith([
        {
          msg: expect.objectContaining({
            id: 'm1',
            sender_id: PARTNER_UID,
            is_me: false,
            timestamp: 1000
          }),
          plaintext: 'Hello Partner'
        },
        {
          msg: expect.objectContaining({
            id: 'm2',
            sender_id: MY_UID,
            is_me: true,
            timestamp: 2000
          }),
          plaintext: 'Hi Me'
        }
      ]);
    });

    test('should recover sender identity from Sealed Sender payloads', async () => {
      const conversation = {
        id: CONV_ID,
        participantIds: [MY_UID, 'hidden-partner'] // Firestore might not know the real sender
      };

      const mockMessages = [
        { id: 'm1', encryptedText: 'sealed-enc', senderId: 'masked', timestamp: { toMillis: () => 3000 } }
      ];

      (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
      
      // Mock Sealed Sender decryption (returns object)
      (Encryption.decryptAsync as jest.Mock).mockResolvedValue({
        text: 'Unsealed Message',
        senderId: 'actual-sender-uid'
      });

      await syncManager.syncConversation(conversation, MY_UID);

      // Verify sender_id was recovered from the decrypted object, not the Firestore metadata
      expect(mockVault.saveMessagesBatch).toHaveBeenCalledWith([
        {
          msg: expect.objectContaining({
            id: 'm1',
            sender_id: 'actual-sender-uid', // <--- Recovered!
            is_me: false
          }),
          plaintext: 'Unsealed Message'
        }
      ]);
    });
  });

  describe('Edge Cases & Reliability', () => {
    test('should skip messages that fail decryption', async () => {
      const conversation = { id: CONV_ID, participantIds: [MY_UID, PARTNER_UID] };
      const mockMessages = [
        { id: 'm1', encryptedText: 'bad-data', timestamp: { toMillis: () => 1000 } }
      ];

      (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
      (Encryption.decryptAsync as jest.Mock).mockResolvedValue('🔒 Failed');

      await syncManager.syncConversation(conversation, MY_UID);

      expect(mockVault.saveMessagesBatch).not.toHaveBeenCalled();
    });

    test('should skip "Encrypted" placeholders that were not successfully decrypted', async () => {
      const conversation = { id: CONV_ID, participantIds: [MY_UID, PARTNER_UID] };
      const mockMessages = [
        { id: 'm1', encryptedText: 'some-data', timestamp: { toMillis: () => 1000 } }
      ];

      (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
      (Encryption.decryptAsync as jest.Mock).mockResolvedValue('🔒 Encrypted');

      await syncManager.syncConversation(conversation, MY_UID);

      expect(mockVault.saveMessagesBatch).not.toHaveBeenCalled();
    });

    test('should handle missing timestamps by using Date.now()', async () => {
      const conversation = { id: CONV_ID, participantIds: [MY_UID, PARTNER_UID] };
      const mockMessages = [
        { id: 'm1', encryptedText: 'data', senderId: MY_UID } // No timestamp
      ];

      (Firestore.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);
      (Encryption.decryptAsync as jest.Mock).mockResolvedValue('Hello');

      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await syncManager.syncConversation(conversation, MY_UID);

      expect(mockVault.saveMessagesBatch).toHaveBeenCalledWith([
        {
          msg: expect.objectContaining({
            timestamp: now
          }),
          plaintext: 'Hello'
        }
      ]);
    });
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageStorageService } from '../message-storage-service';
import * as Encryption from '../encryption';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Mock Encryption
jest.mock('../encryption', () => ({
  encryptWithDeviceKey: jest.fn((text) => Promise.resolve(`enc_${text}`)),
  decryptWithDeviceKey: jest.fn((enc) => Promise.resolve(enc.replace('enc_', ''))),
}));

describe('MessageStorageService (Secure)', () => {
  const CONV_ID = 'test-conv';
  const MSG_ID = 'msg-123';
  const PLAINTEXT = 'Hello Secure Storage';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('saveMessage should encrypt before saving to AsyncStorage', async () => {
    await MessageStorageService.saveMessage(CONV_ID, MSG_ID, PLAINTEXT);

    // Verify encryption was called
    expect(Encryption.encryptWithDeviceKey).toHaveBeenCalledWith(PLAINTEXT);

    // Verify AsyncStorage was called with encrypted value
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      `@innerorbit_msg_cache_${CONV_ID}_${MSG_ID}`,
      `enc_${PLAINTEXT}`
    );
  });

  test('getMessage should decrypt after retrieving from AsyncStorage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(`enc_${PLAINTEXT}`);

    const result = await MessageStorageService.getMessage(CONV_ID, MSG_ID);

    // Verify decryption was called
    expect(Encryption.decryptWithDeviceKey).toHaveBeenCalledWith(`enc_${PLAINTEXT}`);
    expect(result).toBe(PLAINTEXT);
  });

  test('getMessagesForChat should batch decrypt messages', async () => {
    const msgIds = ['m1', 'm2'];
    (AsyncStorage.multiGet as jest.Mock).mockResolvedValue([
      [`@innerorbit_msg_cache_${CONV_ID}_m1`, 'enc_val1'],
      [`@innerorbit_msg_cache_${CONV_ID}_m2`, 'enc_val2'],
    ]);

    const results = await MessageStorageService.getMessagesForChat(CONV_ID, msgIds);

    expect(results).toEqual({
      m1: 'val1',
      m2: 'val2',
    });
    expect(Encryption.decryptWithDeviceKey).toHaveBeenCalledTimes(2);
  });

  test('getMessage should return null if message does not exist', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const result = await MessageStorageService.getMessage(CONV_ID, 'ghost');
    expect(result).toBeNull();
    expect(Encryption.decryptWithDeviceKey).not.toHaveBeenCalled();
  });
});

import { SecureStorageService } from '../secure-storage-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Encryption from '../encryption';

// Mock react-native so Platform.OS is mutable per describe block
jest.mock('react-native', () => ({
    Platform: { OS: 'ios' }
}));

// Mock utils/platform with dynamic getters so beforeAll(Platform.OS = ...) takes effect
jest.mock('../../utils/platform', () => ({
    get isMobile() { return require('react-native').Platform.OS !== 'web'; },
    get isWeb() { return require('react-native').Platform.OS === 'web'; },
    get isIOS() { return require('react-native').Platform.OS === 'ios'; },
    get isAndroid() { return require('react-native').Platform.OS === 'android'; },
}));

// Mock Dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(() => Promise.resolve(null)),
    setItemAsync: jest.fn(() => Promise.resolve()),
    deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../encryption', () => ({
    encryptWithDeviceKey: jest.fn((val: string) => Promise.resolve(`enc_${val}`)),
    decryptWithDeviceKey: jest.fn((val: string) => Promise.resolve(val.replace('enc_', ''))),
}));

describe('SecureStorageService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset persistence to enabled by default for tests
        (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
            if (key === 'loginPersistenceEnabled') return Promise.resolve('true');
            return Promise.resolve(null);
        });
    });

    describe('saveCredentials (Web)', () => {
        beforeAll(() => {
            (Platform as any).OS = 'web';
        });

        test('should use AsyncStorage with encryption on web', async () => {
            const email = 'test@example.com';
            const password = 'password123';
            const userId = 'user_123';

            await SecureStorageService.saveCredentials(email, password, userId);

            expect(Encryption.encryptWithDeviceKey).toHaveBeenCalledWith(email);
            expect(Encryption.encryptWithDeviceKey).toHaveBeenCalledWith(password);
            expect(Encryption.encryptWithDeviceKey).toHaveBeenCalledWith(userId);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('secure_savedEmail', `enc_${email}`);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('secure_savedPassword', `enc_${password}`);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('secure_userId', `enc_${userId}`);
        });
    });

    describe('saveCredentials (Mobile)', () => {
        beforeAll(() => {
            (Platform as any).OS = 'ios';
        });

        test('should use SecureStore on mobile without additional manual encryption', async () => {
            const email = 'test@example.com';
            const password = 'password123';
            const userId = 'user_123';

            await SecureStorageService.saveCredentials(email, password, userId);

            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('secure_savedEmail', email);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('secure_savedPassword', password);
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith('secure_userId', userId);
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('getCredentials (Web)', () => {
        beforeAll(() => {
            (Platform as any).OS = 'web';
        });

        test('should retrieve and decrypt from AsyncStorage on web', async () => {
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
                if (key === 'loginPersistenceEnabled') return Promise.resolve('true');
                if (key === 'secure_savedEmail') return Promise.resolve('enc_test@example.com');
                if (key === 'secure_savedPassword') return Promise.resolve('enc_password123');
                if (key === 'secure_userId') return Promise.resolve('enc_user_123');
                return Promise.resolve(null);
            });

            const result = await SecureStorageService.getCredentials();

            expect(result).toEqual({
                email: 'test@example.com',
                password: 'password123',
                userId: 'user_123'
            });
            expect(Encryption.decryptWithDeviceKey).toHaveBeenCalledTimes(3);
        });
    });

    describe('getCredentials (Mobile)', () => {
        beforeAll(() => {
            (Platform as any).OS = 'android';
        });

        test('should retrieve from SecureStore on mobile', async () => {
            (SecureStore.getItemAsync as jest.Mock)
                .mockResolvedValueOnce('test@example.com')
                .mockResolvedValueOnce('password123')
                .mockResolvedValueOnce('user_123');

            const result = await SecureStorageService.getCredentials();

            expect(result).toEqual({
                email: 'test@example.com',
                password: 'password123',
                userId: 'user_123'
            });
            expect(Encryption.decryptWithDeviceKey).not.toHaveBeenCalled();
        });
    });

    describe('clearAllCredentials (Web)', () => {
        beforeAll(() => {
            (Platform as any).OS = 'web';
        });

        test('should clear from AsyncStorage on web', async () => {
            await SecureStorageService.clearAllCredentials();

            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('secure_savedEmail');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('secure_savedPassword');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('secure_userId');
        });
    });

    describe('clearAllCredentials (Mobile)', () => {
        beforeAll(() => {
            (Platform as any).OS = 'ios';
        });

        test('should clear from SecureStore on mobile', async () => {
            await SecureStorageService.clearAllCredentials();

            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_savedEmail');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_savedPassword');
            expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('secure_userId');
        });
    });
});

import { SafeStorage } from '../utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../logger';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

// Mock Logger
jest.mock('../logger', () => ({
    Logger: {
        warn: jest.fn(),
        error: jest.fn(),
        log: jest.fn(),
    }
}));

describe('SafeStorage Utility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getItem', () => {
        test('should return value from AsyncStorage if it exists', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('test-value');
            const result = await SafeStorage.getItem('test-key');
            expect(result).toBe('test-value');
            expect(AsyncStorage.getItem).toHaveBeenCalledWith('test-key');
        });

        test('should return defaultValue if AsyncStorage returns null', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
            const result = await SafeStorage.getItem('non-existent-key', 'default');
            expect(result).toBe('default');
        });

        test('should handle errors and return defaultValue', async () => {
            const error = new Error('AsyncStorage error');
            (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(error);
            const result = await SafeStorage.getItem('error-key', 'fallback');
            expect(result).toBe('fallback');
            expect(Logger.warn).toHaveBeenCalled();
        });
    });

    describe('setItem', () => {
        test('should successfully set item in AsyncStorage', async () => {
            (AsyncStorage.setItem as jest.Mock).mockResolvedValueOnce(undefined);
            const result = await SafeStorage.setItem('test-key', 'test-value');
            expect(result).toBe(true);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
        });

        test('should handle errors and return false', async () => {
            (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Set error'));
            const result = await SafeStorage.setItem('error-key', 'value');
            expect(result).toBe(false);
            expect(Logger.warn).toHaveBeenCalled();
        });
    });

    describe('getJson', () => {
        test('should parse and return JSON data', async () => {
            const data = { foo: 'bar' };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(data));
            const result = await SafeStorage.getJson('json-key');
            expect(result).toEqual(data);
        });

        test('should return defaultValue if key does not exist', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
            const result = await SafeStorage.getJson('missing-key', { default: true });
            expect(result).toEqual({ default: true });
        });

        test('should handle invalid JSON and return defaultValue', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('invalid-json');
            const result = await SafeStorage.getJson('bad-json-key', { fallback: true });
            expect(result).toEqual({ fallback: true });
            expect(Logger.warn).toHaveBeenCalled();
        });
    });

    describe('setJson', () => {
        test('should stringify and save JSON data', async () => {
            const data = { hello: 'world' };
            (AsyncStorage.setItem as jest.Mock).mockResolvedValueOnce(undefined);
            const result = await SafeStorage.setJson('json-key', data);
            expect(result).toBe(true);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('json-key', JSON.stringify(data));
        });

        test('should handle errors during JSON save', async () => {
            (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('JSON save error'));
            const result = await SafeStorage.setJson('error-key', {});
            expect(result).toBe(false);
            expect(Logger.warn).toHaveBeenCalled();
        });
    });
});

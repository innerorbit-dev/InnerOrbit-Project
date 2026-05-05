import { withNetworkResilience, clearCache } from '../network-resilience';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiRemove: jest.fn(() => Promise.resolve())
}));

jest.mock('../logger', () => ({
    Logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Network Resilience', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('withNetworkResilience', () => {
        test('should execute operation successfully on first try', async () => {
            const mockOperation = jest.fn(() => Promise.resolve('success'));

            const result = await withNetworkResilience(mockOperation);

            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });

        test('should retry on network errors', async () => {
            const mockOperation = jest
                .fn()
                .mockRejectedValueOnce(new Error('network error'))
                .mockRejectedValueOnce(new Error('network error'))
                .mockResolvedValue('success');

            const result = await withNetworkResilience(mockOperation, {
                maxRetries: 3,
                retryDelay: 10
            });

            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });

        test('should throw error after max retries', async () => {
            const mockOperation = jest.fn(() => Promise.reject(new Error('network error')));

            await expect(
                withNetworkResilience(mockOperation, {
                    maxRetries: 2,
                    retryDelay: 10
                })
            ).rejects.toThrow('network error');

            expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });

        test('should cache successful results', async () => {
            const mockOperation = jest.fn(() => Promise.resolve({ data: 'test' }));

            await withNetworkResilience(mockOperation, {
                cacheKey: 'test-key'
            });

            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                'cache_test-key',
                expect.stringContaining('"data":"test"')
            );
        });

        test('should return cached data on network failure', async () => {
            const cachedData = { data: 'cached' };
            AsyncStorage.getItem.mockResolvedValue(JSON.stringify({
                data: cachedData,
                timestamp: Date.now()
            }));

            const mockOperation = jest.fn(() => Promise.reject(new Error('network error')));

            const result = await withNetworkResilience(mockOperation, {
                cacheKey: 'test-key',
                maxRetries: 1,
                retryDelay: 10
            });

            expect(result).toEqual(cachedData);
        });

        test('should return fallback value when cache unavailable', async () => {
            const mockOperation = jest.fn(() => Promise.reject(new Error('network error')));
            const fallbackValue = { fallback: true };

            const result = await withNetworkResilience(mockOperation, {
                fallbackValue,
                maxRetries: 1,
                retryDelay: 10
            });

            expect(result).toEqual(fallbackValue);
        });
    });

    describe('clearCache', () => {
        test('should clear all cached items', async () => {
            AsyncStorage.getAllKeys.mockResolvedValue([
                'cache_item1',
                'cache_item2',
                'other_item',
                'cache_item3'
            ]);

            await clearCache();

            expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
                'cache_item1',
                'cache_item2',
                'cache_item3'
            ]);
        });

        test('should handle errors gracefully', async () => {
            AsyncStorage.getAllKeys.mockRejectedValue(new Error('Storage error'));

            // Should not throw
            await expect(clearCache()).resolves.not.toThrow();
        });
    });
});

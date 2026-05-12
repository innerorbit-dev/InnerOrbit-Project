import { signInWithPin, signOutUser, startSessionHeartbeat } from '../auth-service';

// Mock dependencies
jest.mock('../firebase', () => ({
    auth: {}
}));

jest.mock('../user-id-generator', () => ({
    findUserByCredentials: jest.fn()
}));

jest.mock('../firestore-service', () => ({
    updateUserPresence: jest.fn(() => Promise.resolve())
}));

jest.mock('../logger', () => ({
    Logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn()
    }
}));

import { findUserByCredentials } from '../user-id-generator';
import { updateUserPresence } from '../firestore-service';

describe('Auth Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear any existing intervals
        if (globalThis.presenceInterval) {
            clearInterval(globalThis.presenceInterval);
            globalThis.presenceInterval = null;
        }
    });

    afterEach(() => {
        // Clean up intervals
        if (globalThis.presenceInterval) {
            clearInterval(globalThis.presenceInterval);
            globalThis.presenceInterval = null;
        }
    });

    describe('signInWithPin', () => {
        test('should successfully sign in with valid credentials', async () => {
            const mockUser = {
                uid: 'test-uid-123',
                userId: '2580',
                pin: '123456',
                displayName: 'Test User'
            };

            findUserByCredentials.mockResolvedValue(mockUser);

            const result = await signInWithPin('2580', '123456');

            expect(result).toEqual(mockUser);
            expect(findUserByCredentials).toHaveBeenCalledWith('2580', '123456');
            expect(updateUserPresence).toHaveBeenCalledWith('test-uid-123', true);
        });

        test('should throw error for invalid credentials', async () => {
            findUserByCredentials.mockResolvedValue(null);

            await expect(signInWithPin('0000', '000000')).rejects.toThrow('Invalid User ID or PIN combination');
        });

        test('should handle presence update failures gracefully', async () => {
            const mockUser = {
                uid: 'test-uid-123',
                userId: '2580',
                pin: '123456'
            };

            findUserByCredentials.mockResolvedValue(mockUser);
            updateUserPresence.mockRejectedValue(new Error('Presence update failed'));

            // Should still return user even if presence fails
            const result = await signInWithPin('2580', '123456');
            expect(result).toEqual(mockUser);
        });
    });

    describe('startSessionHeartbeat', () => {
        test('should start heartbeat interval', () => {
            jest.useFakeTimers();

            startSessionHeartbeat('test-uid');

            expect(globalThis.presenceInterval).toBeDefined();
            expect(updateUserPresence).toHaveBeenCalledWith('test-uid', true, true);

            jest.advanceTimersByTime(60000);
            expect(updateUserPresence).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });

        test('should clear existing interval before starting new one', () => {
            jest.useFakeTimers();

            startSessionHeartbeat('uid-1');
            const firstInterval = globalThis.presenceInterval;

            startSessionHeartbeat('uid-2');
            const secondInterval = globalThis.presenceInterval;

            expect(firstInterval).not.toBe(secondInterval);

            jest.useRealTimers();
        });
    });

    describe('signOutUser', () => {
        test('should clear heartbeat interval', async () => {
            jest.useFakeTimers();

            startSessionHeartbeat('test-uid');
            expect(globalThis.presenceInterval).toBeDefined();

            await signOutUser('test-uid');
            expect(globalThis.presenceInterval).toBeNull();

            jest.useRealTimers();
        });

        test('should update user presence to offline', async () => {
            await signOutUser('test-uid');

            expect(updateUserPresence).toHaveBeenCalledWith('test-uid', false);
        });

        test('should handle missing uid gracefully', async () => {
            await signOutUser(null);

            expect(updateUserPresence).not.toHaveBeenCalled();
        });

        test('should handle presence update failures gracefully', async () => {
            updateUserPresence.mockRejectedValue(new Error('Update failed'));

            // Should not throw
            await expect(signOutUser('test-uid')).resolves.not.toThrow();
        });
    });
});

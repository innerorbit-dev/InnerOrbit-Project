/**
 * Integration Test: Authentication Flow
 * Tests the complete PIN-based authentication flow including:
 * - User sign-in with User ID and PIN
 * - Session management (heartbeat)
 * - Sign-out functionality
 */

import { signInWithPin, signOutUser, startSessionHeartbeat } from '../../lib/auth-service';
import { findUserByCredentials } from '../../lib/user-id-generator';
import { updateUserPresence } from '../../lib/firestore-service';

// Mock dependencies
jest.mock('../../lib/firebase', () => ({
    auth: {},
    db: {}
}));

jest.mock('../../lib/user-id-generator', () => ({
    findUserByCredentials: jest.fn()
}));

jest.mock('../../lib/firestore-service', () => ({
    updateUserPresence: jest.fn(() => Promise.resolve())
}));

jest.mock('../../lib/logger', () => ({
    Logger: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn()
    }
}));

describe('Integration: Authentication Flow', () => {
    const mockUser = {
        uid: 'test-user-123',
        userId: '2580',
        pin: '123456',
        displayName: 'Test User',
        email: 'test@example.com',
        isDecoySession: false
    };

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

    describe('Complete Sign-In Flow', () => {
        test('should complete full sign-in flow with valid credentials', async () => {
            // Arrange
            findUserByCredentials.mockResolvedValue(mockUser);

            // Act
            const result = await signInWithPin('2580', '123456');

            // Assert
            expect(result).toEqual(mockUser);
            expect(findUserByCredentials).toHaveBeenCalledWith('2580', '123456');
            expect(updateUserPresence).toHaveBeenCalledWith('test-user-123', true);
        });

        test('should handle decoy session login', async () => {
            const decoyUser = {
                ...mockUser,
                isDecoySession: true
            };

            findUserByCredentials.mockResolvedValue(decoyUser);

            const result = await signInWithPin('2580', '654321');

            expect(result.isDecoySession).toBe(true);
            expect(result.uid).toBe('test-user-123');
        });

        test('should reject invalid credentials', async () => {
            findUserByCredentials.mockResolvedValue(null);

            await expect(signInWithPin('0000', '000000')).rejects.toThrow('Invalid User ID or PIN combination');
        });
    });

    describe('Session Management', () => {
        test('should maintain session with heartbeat', async () => {
            jest.useFakeTimers();

            // Sign in
            findUserByCredentials.mockResolvedValue(mockUser);
            await signInWithPin('2580', '123456');

            // Verify initial presence update
            expect(updateUserPresence).toHaveBeenCalledWith('test-user-123', true);

            // Advance time by 60 seconds
            jest.advanceTimersByTime(60000);

            // Verify heartbeat sent
            expect(updateUserPresence).toHaveBeenCalledWith('test-user-123', true, true);

            jest.useRealTimers();
        });

        test('should handle presence update failures during session', async () => {
            findUserByCredentials.mockResolvedValue(mockUser);
            updateUserPresence.mockRejectedValueOnce(new Error('Network error'));

            // Should still complete sign-in even if presence fails
            const result = await signInWithPin('2580', '123456');
            expect(result).toEqual(mockUser);
        });
    });

    describe('Sign-Out Flow', () => {
        test('should complete full sign-out flow', async () => {
            jest.useFakeTimers();

            // Sign in first
            findUserByCredentials.mockResolvedValue(mockUser);
            await signInWithPin('2580', '123456');

            // Verify heartbeat is running
            expect(globalThis.presenceInterval).toBeDefined();

            // Sign out
            await signOutUser('test-user-123');

            // Verify heartbeat stopped
            expect(globalThis.presenceInterval).toBeNull();

            // Verify offline status set
            expect(updateUserPresence).toHaveBeenCalledWith('test-user-123', false);

            jest.useRealTimers();
        });

        test('should handle sign-out without active session', async () => {
            // Sign out without signing in first
            await signOutUser('test-user-123');

            // Should still update presence
            expect(updateUserPresence).toHaveBeenCalledWith('test-user-123', false);
        });
    });

    describe('End-to-End Auth Scenarios', () => {
        test('should handle complete user session lifecycle', async () => {
            jest.useFakeTimers();

            // 1. Sign in
            findUserByCredentials.mockResolvedValue(mockUser);
            const user = await signInWithPin('2580', '123456');
            expect(user.uid).toBe('test-user-123');

            // 2. Verify session active
            expect(globalThis.presenceInterval).toBeDefined();

            // 3. Heartbeat sends presence updates
            jest.advanceTimersByTime(60000);
            expect(updateUserPresence).toHaveBeenCalledWith('test-user-123', true, true);

            // 4. Sign out
            await signOutUser('test-user-123');
            expect(globalThis.presenceInterval).toBeNull();

            jest.useRealTimers();
        });

        test('should handle rapid sign-in/sign-out cycles', async () => {
            findUserByCredentials.mockResolvedValue(mockUser);

            // Sign in
            await signInWithPin('2580', '123456');

            // Sign out
            await signOutUser('test-user-123');

            // Sign in again
            await signInWithPin('2580', '123456');

            // Verify new session started
            expect(globalThis.presenceInterval).toBeDefined();

            // Clean up
            await signOutUser('test-user-123');
        });
    });
});

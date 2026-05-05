/**
 * 🛡️ BRUTE-FORCE PROTECTION & RATE LIMITING
 * 
 * PURPOSE:
 * This module acts as the "Bouncer" for the app. It prevents attackers from 
 * guessing PINs or passwords by limiting how fast they can try.
 * 
 * REAL-LIFE ANALOGY:
 * Imagine a keypad at a high-security facility. 
 * - After 3 wrong tries, the keypad stops working for 10 seconds. 
 * - After 5 wrong tries, it stops working for 1 minute.
 * - After 10 wrong tries, it stops for an hour.
 * This makes it impossible for a robot to try thousands of combinations.
 * 
 * HOW IT WORKS (EXPONENTIAL BACKOFF):
 * - The more you fail, the longer you wait.
 * - The wait time doubles with each failure after a certain threshold.
 * - This "Self-Lockout" state is saved to the phone's secure storage, so 
 *   even if you restart the app, the lockout timer remains.
 */
import { SafeStorage } from './utils';
import { Logger } from './logger';

/**
 * BruteForceProtector
 * 
 * Provides rate-limiting and lockout capabilities for sensitive actions like
 * PIN entry, password login, and stealth code verification.
 * 
 * Uses exponential backoff for delays and persists attempt data to storage.
 */
export class BruteForceProtector {
    private context: string;
    private maxAttempts: number;
    private baseDelay: number; // in milliseconds

    constructor(context: string, maxAttempts: number = 5, baseDelay: number = 1000) {
        this.context = context;
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay;
    }

    private getStorageKey(): string {
        return `bfp_attempts_${this.context}`;
    }

    /**
     * Records a failed attempt and returns the required wait time (if any) before the next attempt.
     */
    async recordFailure(): Promise<number> {
        const stats = await this.getStats();
        stats.attempts += 1;
        stats.lastAttempt = Date.now();
        
        await this.saveStats(stats);
        
        const delay = this.calculateDelay(stats.attempts);
        if (delay > 0) {
            Logger.warn(`[Security] Brute force protection triggered for ${this.context}. Attempts: ${stats.attempts}. Delay: ${delay}ms`);
        }
        
        return delay;
    }

    /**
     * Records a successful attempt and resets the counter.
     */
    async recordSuccess(): Promise<void> {
        await SafeStorage.removeItem(this.getStorageKey());
    }

    /**
     * Checks if the user is currently locked out and returns the remaining wait time in milliseconds.
     */
    async getRemainingWaitTime(): Promise<number> {
        const stats = await this.getStats();
        if (stats.attempts === 0) return 0;
        
        const delay = this.calculateDelay(stats.attempts);
        const elapsed = Date.now() - stats.lastAttempt;
        const remaining = Math.max(0, delay - elapsed);
        
        return remaining;
    }

    private calculateDelay(attempts: number): number {
        if (attempts < this.maxAttempts) return 0;
        
        // Exponential backoff after maxAttempts
        // 5 attempts: baseDelay * 2^0 = 1s
        // 6 attempts: baseDelay * 2^1 = 2s
        // 7 attempts: baseDelay * 2^2 = 4s
        // 8 attempts: baseDelay * 2^3 = 8s
        // ... up to a max of 1 hour
        const power = attempts - this.maxAttempts;
        const delay = this.baseDelay * Math.pow(2, power);
        
        return Math.min(delay, 3600000); // Max 1 hour delay
    }

    private async getStats(): Promise<{ attempts: number; lastAttempt: number }> {
        const stats = await SafeStorage.getJson<{ attempts: number; lastAttempt: number }>(this.getStorageKey());
        return stats || { attempts: 0, lastAttempt: 0 };
    }

    private async saveStats(stats: { attempts: number; lastAttempt: number }): Promise<void> {
        await SafeStorage.setJson(this.getStorageKey(), stats);
    }
}

/**
 * Global protector instances for common contexts
 */
export const AuthProtector = new BruteForceProtector('auth', 5, 2000);
export const LocalPinProtector = new BruteForceProtector('local_pin', 5, 1000);
export const StealthCodeProtector = new BruteForceProtector('stealth_code', 3, 3000);

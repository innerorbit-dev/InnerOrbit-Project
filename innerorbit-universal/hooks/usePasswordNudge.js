/**
 * Purpose: Manages the schedule for nudging Google-only users to set a backup password.
 *
 * Schedule:
 *   Skip 0 → show immediately on first Google login (no skip yet)
 *   Skip 1 → show again after 3 days
 *   Skip 2 → show again after 7 days
 *   Skip 3+ → permanently suppressed (user can still set via Settings)
 *
 * AsyncStorage keys:
 *   google_nudge_count       – number of times the nudge has been skipped
 *   google_nudge_last_skip   – ISO timestamp of the last skip
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../lib/logger';

const NUDGE_COUNT_KEY = 'google_nudge_count';
const NUDGE_LAST_SKIP_KEY = 'google_nudge_last_skip';

// Days to wait before re-showing based on skip count
const NUDGE_INTERVALS_DAYS = [
  0,  // skip 0 → show immediately (first login, no prior skip)
  3,  // skip 1 → wait 3 days
  7,  // skip 2 → wait 7 days
];
const MAX_SKIPS = 3; // After 3 skips, stop nudging forever

/**
 * @param {boolean} isGoogleOnlyUser  – true if user signed in via Google AND !hasSetPassword
 */
export function usePasswordNudge(isGoogleOnlyUser) {
  const [shouldNudge, setShouldNudge] = useState(false);
  const [nudgeCount, setNudgeCount] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isGoogleOnlyUser) {
      setIsChecking(false);
      return;
    }
    checkNudgeSchedule();
  }, [isGoogleOnlyUser]);

  const checkNudgeSchedule = async () => {
    try {
      const [rawCount, rawLastSkip] = await Promise.all([
        AsyncStorage.getItem(NUDGE_COUNT_KEY),
        AsyncStorage.getItem(NUDGE_LAST_SKIP_KEY),
      ]);

      const count = rawCount ? parseInt(rawCount, 10) : 0;
      setNudgeCount(count);

      Logger.log(`[PasswordNudge] Skip count: ${count}, Last skip: ${rawLastSkip || 'never'}`);

      // Hard stop after MAX_SKIPS
      if (count >= MAX_SKIPS) {
        Logger.log('[PasswordNudge] 🚫 Nudge permanently suppressed (max skips reached)');
        setShouldNudge(false);
        return;
      }

      // First-time user (no skip yet): show immediately
      if (count === 0) {
        Logger.log('[PasswordNudge] ✅ First-time nudge – showing immediately');
        setShouldNudge(true);
        return;
      }

      // Subsequent skips: check interval
      if (rawLastSkip) {
        const lastSkipDate = new Date(rawLastSkip);
        const daysSinceSkip = (Date.now() - lastSkipDate.getTime()) / (1000 * 60 * 60 * 24);
        const requiredDays = NUDGE_INTERVALS_DAYS[count] ?? 14; // fallback 14 days

        if (daysSinceSkip >= requiredDays) {
          Logger.log(`[PasswordNudge] ✅ Interval elapsed (${daysSinceSkip.toFixed(1)}d >= ${requiredDays}d) – showing nudge`);
          setShouldNudge(true);
        } else {
          Logger.log(`[PasswordNudge] ⏳ Interval not elapsed (${daysSinceSkip.toFixed(1)}d < ${requiredDays}d)`);
          setShouldNudge(false);
        }
      }
    } catch (err) {
      Logger.warn('[PasswordNudge] Failed to read nudge state:', err.message);
      setShouldNudge(false);
    } finally {
      setIsChecking(false);
    }
  };

  /** Call when user taps "Maybe Later" */
  const dismissNudge = useCallback(async () => {
    try {
      const newCount = nudgeCount + 1;
      await Promise.all([
        AsyncStorage.setItem(NUDGE_COUNT_KEY, String(newCount)),
        AsyncStorage.setItem(NUDGE_LAST_SKIP_KEY, new Date().toISOString()),
      ]);
      setNudgeCount(newCount);
      setShouldNudge(false);
      Logger.log(`[PasswordNudge] ⏭️ Nudge skipped (count now: ${newCount})`);
    } catch (err) {
      Logger.warn('[PasswordNudge] Failed to save skip state:', err.message);
    }
  }, [nudgeCount]);

  /** Call when user successfully sets a password – clears nudge forever */
  const completeNudge = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(NUDGE_COUNT_KEY),
        AsyncStorage.removeItem(NUDGE_LAST_SKIP_KEY),
      ]);
      setShouldNudge(false);
      Logger.log('[PasswordNudge] ✅ Password set – nudge cleared permanently');
    } catch (err) {
      Logger.warn('[PasswordNudge] Failed to clear nudge state:', err.message);
    }
  }, []);

  /** Reset nudge schedule (for testing / Settings "Reset Nudge" option) */
  const resetNudge = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(NUDGE_COUNT_KEY),
        AsyncStorage.removeItem(NUDGE_LAST_SKIP_KEY),
      ]);
      setNudgeCount(0);
      setShouldNudge(true);
      Logger.log('[PasswordNudge] 🔄 Nudge schedule reset');
    } catch (err) {
      Logger.warn('[PasswordNudge] Failed to reset nudge state:', err.message);
    }
  }, []);

  return { shouldNudge, isChecking, nudgeCount, dismissNudge, completeNudge, resetNudge };
}

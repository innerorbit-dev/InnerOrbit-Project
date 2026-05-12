/** Purpose: Handles PIN-based authentication, session presence heartbeats, and user logout. */
import { auth } from "./firebase";
import { findUserByCredentials } from "./user-id-generator";
import { updateUserPresence } from "./firestore-service";
import { publishMyKeysOnLogin } from "./ratchet-key-service";
import { Logger } from "./logger";
import { useSensitiveString } from "./memory-hardening";

/**
 * Signs in a user using their User ID and PIN combination
 * Validates credentials against Firestore and initializes the session presence.
 * 
 * @param userId - The 4-digit User ID
 * @param pin - The 6-digit PIN
 * @returns Promise that resolves with the User Profile object
 */
export async function signInWithPin(userId, pin) {
  Logger.trace('AUTH', 'auth-service.js', 'signInWithPin', 'PENDING', `userId=${userId}`);
  return await useSensitiveString(pin, async (pinBuf) => {
    try {

      // 1. Verify Credentials using the buffer-converted string
      const userProfile = await findUserByCredentials(userId, pinBuf.toString());

      if (!userProfile) {
        Logger.trace('AUTH', 'auth-service.js', 'signInWithPin', 'FAILED', 'Invalid credentials');
        throw new Error("Invalid User ID or PIN combination");
      }

      Logger.trace('AUTH', 'auth-service.js', 'signInWithPin', 'SUCCESS', `uid=${userProfile.uid?.substring(0, 5)}...`);


      // 2. Initialize Session Presence (Mark as Online)
      try {
        await updateUserPresence(userProfile.uid, true);
        startSessionHeartbeat(userProfile.uid);
      } catch (presenceError) {
        Logger.warn("[AuthService] Presence update failed (non-fatal):", presenceError);
      }

      // 3. Publish DH + v6 public keys
      publishMyKeysOnLogin(userProfile.uid).catch(e =>
        Logger.warn("[AuthService] Key publish failed (non-fatal):", e?.message)
      );

      return userProfile;

    } catch (error) {
      Logger.trace('AUTH', 'auth-service.js', 'signInWithPin', 'FAILED', error?.message);
      Logger.error("PIN sign in error:", error);
      throw error;
    }

  });
}

/**
 * Starts a 60-second heartbeat to keep the user "Online" in Firestore
 * @param uid - The User UID
 */
export function startSessionHeartbeat(uid) {
  Logger.trace('AUTH', 'auth-service.js', 'startSessionHeartbeat', 'PENDING', `uid=${uid?.substring(0, 5)}...`);
  // Clear any existing interval to prevent duplicates
  if (globalThis.presenceInterval) {
    clearInterval(globalThis.presenceInterval);
  }


  Logger.log("[AuthService] ❤️ Starting Session Heartbeat...");

  // Initial ping
  updateUserPresence(uid, true, true).catch(() => { });

  // Interval ping
  globalThis.presenceInterval = setInterval(() => {
    // Check if we still have a valid session context if needed, 
    // but for now we trust the interval until cleared.
    Logger.log("[AuthService] ❤️ Sending Presence Heartbeat...");
    updateUserPresence(uid, true, true).catch(() => { });
  }, 60000); // 60 seconds
}

/**
 * Signs out the user by clearing the heartbeat and setting status to Offline
 * @param uid - The User UID (Optional, if known)
 */
export async function signOutUser(uid) {
  Logger.trace('AUTH', 'auth-service.js', 'signOutUser', 'PENDING', `uid=${uid?.substring(0, 5)}...`);

  // 1. Stop Heartbeat
  if (globalThis.presenceInterval) {
    clearInterval(globalThis.presenceInterval);
    globalThis.presenceInterval = null;
  }

  // 2. Set Offline Status
  if (uid) {
    try {
      await updateUserPresence(uid, false);
      Logger.trace('AUTH', 'auth-service.js', 'signOutUser', 'SUCCESS');
      Logger.log("[AuthService] 🌑 User marked as Offline");

    } catch (e) {
      Logger.warn("[AuthService] Failed to set offline status:", e);
    }
  }
}

/**
 * Generates a custom Firebase token for a user
 * @deprecated functionality moved to Client-Side Verification pattern
 */
async function generateCustomTokenForUser(uid) {
  Logger.warn("generateCustomTokenForUser is deprecated. Using Client-Side Verification.");
  throw new Error("Use signInWithPin() for client-verification instead.");
}
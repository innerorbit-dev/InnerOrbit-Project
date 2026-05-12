import { Logger } from "./logger";
import { getRatchetSession, DEFAULT_ENCRYPTION_CAPABILITIES } from "./encryption";
import { hasKeyBackup, restoreRatchetSession, backupRatchetSession } from "./key-backup-service";

/**
 * 🛡️ Auto Recovery Service
 * 
 * Orchestrates the secure cross-device message recovery flow.
 * Checks for missing ratchet states, attempts automatic PIN-based decryption of server backups,
 * and initializes/backs up fresh states when appropriate.
 */
export async function ensureSessionWithAutoRecovery(
  conversationId: string,
  user: any,
  foundUid: string,
  activePin: string | null,
  svc: any
): Promise<"RESTORED" | "FRESH" | "NEEDS_PIN" | "ERROR"> {
  // ── Gated by Architectural Hold ──
  if (!DEFAULT_ENCRYPTION_CAPABILITIES.v4) return "ERROR";

  try {
    const existingV4 = await getRatchetSession(conversationId);
    const hasBackup = await hasKeyBackup(user.uid, conversationId);

    // Fetch user profile to check backup settings (defaults to TRUE if undefined)
    const { getUserProfile } = await import("./firestore-service");
    const profile = await getUserProfile(user.uid);
    const isBackupEnabled = profile?.settings?.keyBackupEnabled !== false;
    const isAutoRecoveryEnabled = profile?.settings?.autoRecoveryEnabled !== false; // Default TRUE

    if (!existingV4 && hasBackup) {
      if (isAutoRecoveryEnabled && activePin) {
        // 🔄 AUTO RECOVERY MODE: Session missing locally, but encrypted backup exists
        Logger.log(`[AutoRecovery] Attempting silent restore for conv=${conversationId.substring(0, 8)}...`);
        const restored = await restoreRatchetSession(user.uid, conversationId, foundUid, activePin);

        if (restored) {
          Logger.log("[AutoRecovery] ✅ Success. History unlocked seamlessly.");
          return "RESTORED";
        } else {
          Logger.warn("[AutoRecovery] ⚠️ Failed (Wrong PIN/Corrupt). Initiating fresh ratchet.");
          await svc.initializeRatchetIfNeeded(conversationId, user.uid, foundUid);
          return "FRESH";
        }
      } else {
        // Auto-recovery is OFF, or PIN missing. Need manual entry.
        Logger.log("[AutoRecovery] Auto-recovery disabled or PIN missing. Prompting user.");
        return "NEEDS_PIN";
      }
    } else {
      // 🆕 STANDARD INIT: Session exists OR no backup available
      const success = await svc.initializeRatchetIfNeeded(conversationId, user.uid, foundUid);

      if (success && activePin && isBackupEnabled && !hasBackup) {
        // 💾 AUTO BACKUP: Freshly initialized session + Opted-In -> Securely store root key
        const state = await getRatchetSession(conversationId);
        if ((state as any)?.sharedSecret) {
          Logger.log("[AutoRecovery] Backing up fresh session to cloud...");
          await backupRatchetSession(user.uid, conversationId, (state as any).sharedSecret, user.uid < foundUid, activePin);
        }
      }
      return "FRESH";
    }
  } catch (error) {
    Logger.error("[AutoRecovery] Fatal error during orchestration:", error);
    return "ERROR";
  }
}

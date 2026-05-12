import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp, getDoc, Firestore } from "firebase/firestore";
// @ts-ignore
import * as firebase from "./firebase";
const { db, auth } = firebase as any;
import { Auth } from "firebase/auth";
import { encrypt, decrypt, ENC_VERSION_SIV } from "./encryption";
import { IdentitySecurityService } from "./identity-security-service";
import { Logger } from "./logger";
import CryptoJS from "crypto-js";

const PRESENCE_TOPICS_COLLECTION = "presence_topics";
const USERS_COLLECTION = "users";
const CONVERSATIONS_COLLECTION = "conversations";

export const PresenceService = {
  /**
   * Encrypts and uploads the current online status.
   * @param sharePresence - If false, does nothing (respects privacy toggle).
   * @param isOnline - Explicitly set online/offline status (defaults to true).
   */
  async publishPresence(sharePresence: boolean, isOnline: boolean = true): Promise<void> {
    Logger.trace("PRESENCE", "presence-service.ts", "publishPresence", "PENDING", `sharePresence=${sharePresence}, isOnline=${isOnline}`);
    const firebaseAuth = auth as Auth;
    const user = firebaseAuth.currentUser;

    // Going offline (logout/background): ALWAYS write regardless of sharePresence toggle,
    // so the dot clears correctly for the other party.
    // Going online with sharePresence=false: skip the full blob, but still write isOnline=false stub
    // so stale "online" state from a previous session is never left behind.
    if (!user) {
      Logger.trace("PRESENCE", "presence-service.ts", "publishPresence", "FAILED", "No authenticated user");
      return;
    }
    if (!sharePresence && isOnline) {
      // User has presence sharing OFF and is online — write a minimal offline stub to avoid stale dots
      // from prior sessions, then bail.
      try {
        const firestore = db as Firestore;
        const publicRef = doc(firestore, "publicProfiles", user.uid);
        await setDoc(publicRef, { isOnline: false, lastSeen: serverTimestamp() }, { merge: true });
      } catch (_) { /* best-effort */ }
      return;
    }


    try {
      const profileKey = await IdentitySecurityService.getOrCreateProfileKey();
      if (!profileKey) return;

      const now = new Date().toISOString();
      // Use v3.5 (SIV) for fast, hardware-accelerated encryption
      const encryptedBlob = encrypt(now, profileKey, undefined, ENC_VERSION_SIV);

      const firestore = db as Firestore;
      const userRef = doc(firestore, USERS_COLLECTION, user.uid);
      const publicRef = doc(firestore, "publicProfiles", user.uid);
      
      const updateData = {
        presenceBlob: encryptedBlob,
        isOnline: isOnline,
        lastSeen: serverTimestamp(),
      };

      await Promise.all([
        updateDoc(userRef, updateData),
        setDoc(publicRef, updateData, { merge: true })
      ]);
      
      Logger.trace("PRESENCE", "presence-service.ts", "publishPresence", "SUCCESS", "Presence blob mirrored (private & public).");
      Logger.log("[Presence] ✅ Presence blob mirrored (private & public).");
    } catch (e) {
      Logger.trace("PRESENCE", "presence-service.ts", "publishPresence", "FAILED", String(e));
      Logger.error("[Presence] Failed to publish presence:", e);
    }

  },

  /**
   * Lightweight heartbeat — refreshes isOnline + lastSeen without re-encrypting the blob.
   * Call this every ~3 minutes while the user is in the foreground to keep the status dot
   * from going grey due to the 5-minute lastSeen staleness check in ConversationItem.
   */
  async keepAlivePresence(): Promise<void> {
    const firebaseAuth = auth as Auth;
    const user = firebaseAuth.currentUser;
    if (!user) return;
    try {
      const firestore = db as Firestore;
      const userRef = doc(firestore, USERS_COLLECTION, user.uid);
      const publicRef = doc(firestore, "publicProfiles", user.uid);
      const ping = { isOnline: true, lastSeen: serverTimestamp() };
      await Promise.all([
        updateDoc(userRef, ping),
        setDoc(publicRef, ping, { merge: true })
      ]);
      Logger.log("[Presence] 💓 Keepalive ping sent.");
    } catch (e) {
      Logger.warn("[Presence] Keepalive failed:", e);
    }
  },

  /**
   * Subscribes to a partner's presence updates.
   */
  subscribeToPartnerPresence(
    partnerUid: string,
    partnerProfileKey: string,
    callback: (presence: { isOnline: boolean; lastSeen: string | null } | null) => void
  ): () => void {
    Logger.trace("PRESENCE", "presence-service.ts", "subscribeToPartnerPresence", "PENDING", `partnerUid=${partnerUid}`);
    if (!partnerUid || !partnerProfileKey) {
      Logger.trace("PRESENCE", "presence-service.ts", "subscribeToPartnerPresence", "FAILED", "Missing partnerUid or partnerProfileKey");
      callback(null);
      return () => {};
    }

    // Async helper: tries sync decrypt first; if it returns a failure string (e.g. v5.5 blob
    // written by Android before the SIV pin), falls through to decryptAsync which uses
    // libsodium/ChaCha20 to handle it correctly.
    const decryptBlob = async (blob: string): Promise<string | null> => {
      try {
        let result = decrypt(blob, partnerProfileKey, undefined, true);
        // Sync decrypt returns failure strings instead of throwing for unhandled versions
        if (!result || result.startsWith("🔒")) {
          const { decryptAsync } = await import("./encryption");
          const asyncResult = await decryptAsync(blob, partnerProfileKey);
          result = (asyncResult && typeof asyncResult === "object") ? asyncResult.text : asyncResult;
        }
        // Validate: result should be an ISO date string
        if (result && !result.startsWith("🔒") && result.length > 0) {
          return result;
        }
        return null;
      } catch (e) {
        Logger.warn("[Presence] Blob decryption failed:", e);
        return null;
      }
    };

    const firestore = db as Firestore;
    const publicRef = doc(firestore, "publicProfiles", partnerUid);

    // Converts a Firestore Timestamp or raw value to ISO string for the UI date parser.
    const rawTsToIso = (raw: any): string | null => {
      if (!raw) return null;
      try {
        const ms = raw.toMillis ? raw.toMillis() : (raw.seconds ? raw.seconds * 1000 : new Date(raw).getTime());
        return isNaN(ms) ? null : new Date(ms).toISOString();
      } catch { return null; }
    };

    // Listen to Public collection first (more likely to be allowed on mobile)
    return onSnapshot(publicRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Always use the raw isOnline boolean from Firestore — never infer it from blob presence.
        const isOnline = data.isOnline === true;
        // Raw lastSeen (serverTimestamp) is always available as an unencrypted fallback.
        // publishPresence writes both presenceBlob AND lastSeen: serverTimestamp() every time.
        const rawLastSeen = rawTsToIso(data.lastSeen);

        if (data.presenceBlob) {
          decryptBlob(data.presenceBlob).then(lastSeen => {
            // Use decrypted ISO string from blob if available; fall back to raw Firestore timestamp.
            callback({ isOnline, lastSeen: lastSeen ?? rawLastSeen });
          });
        } else {
          callback({ isOnline, lastSeen: rawLastSeen });
        }
      } else {
        // Fallback to private if rules happen to allow it (e.g. they are a mutual contact)
        const userRef = doc(firestore, USERS_COLLECTION, partnerUid);
        getDoc(userRef).then(snap => {
           if (snap.exists()) {
              const d = snap.data();
              const isOnline = d.isOnline === true;
              const rawLastSeen = rawTsToIso(d.lastSeen);
              if (d.presenceBlob) {
                decryptBlob(d.presenceBlob).then(lastSeen => {
                  callback({ isOnline, lastSeen: lastSeen ?? rawLastSeen });
                });
              } else {
                callback({ isOnline, lastSeen: rawLastSeen });
              }
           } else {
             callback(null);
           }
        }).catch(() => { callback(null); });
      }
    }, (err) => {
      if (err.code === "permission-denied") {
        Logger.trace("PRESENCE", "presence-service.ts", "subscribeToPartnerPresence", "FAILED", "Permission denied for public presence doc.");
        Logger.warn("[Presence] Permission denied for public presence doc.");
      }
      callback(null);
    });
  },


  /**
   * Fallback: Subscribes to a partner's raw (unencrypted) presence from publicProfiles.
   * Used when the partner hasn't shared their encrypted profile key yet.
   */
  subscribeToRawPresence(partnerUid: string, callback: (data: { isOnline: boolean; lastSeen: any } | null) => void): () => void {
    if (!partnerUid) {
      callback(null);
      return () => {};
    }
    const firestore = db as Firestore;
    const publicRef = doc(firestore, "publicProfiles", partnerUid);
    return onSnapshot(publicRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          isOnline: data.isOnline === true,
          lastSeen: data.lastSeen || null,
        });
      } else {
        callback(null);
      }
    }, () => { callback(null); });
  },
  /**
   * Shares the local Profile Key with a conversation partner by encrypting it 
   * with the conversation's stable shared secret.
   */
  async shareProfileKeyWithPartner(conversationId: string, participantUids: string[]): Promise<void> {
    Logger.trace("PRESENCE", "presence-service.ts", "shareProfileKeyWithPartner", "PENDING", `conversationId=${conversationId}`);
    const firebaseAuth = auth as Auth;
    const user = firebaseAuth.currentUser;
    if (!user || !conversationId || !participantUids || participantUids.length < 2) {
      Logger.trace("PRESENCE", "presence-service.ts", "shareProfileKeyWithPartner", "FAILED", "Invalid parameters or user not auth");
      return;
    }


    try {
      const { deriveConversationKey } = await import("./encryption");
      const sharedSecret = deriveConversationKey(conversationId, participantUids);
      if (!sharedSecret) return;
      const myProfileKey = await IdentitySecurityService.getOrCreateProfileKey();
      if (!myProfileKey) return;

      // Encrypt my ProfileKey with the conversation's shared secret
      // We use SIV here for consistency and speed
      const encryptedKey = encrypt(myProfileKey, sharedSecret, undefined, ENC_VERSION_SIV);

      const firestore = db as Firestore;
      const convRef = doc(firestore, CONVERSATIONS_COLLECTION, conversationId);
      await updateDoc(convRef, {
        [`profileKey_${user.uid}`]: encryptedKey
      });
      
      Logger.trace("PRESENCE", "presence-service.ts", "shareProfileKeyWithPartner", "SUCCESS", "Profile Key shared in conversation.");
      Logger.log("[Presence] 🔑 Profile Key shared in conversation.");
    } catch (e) {
      Logger.trace("PRESENCE", "presence-service.ts", "shareProfileKeyWithPartner", "FAILED", String(e));
      Logger.error("[Presence] Failed to share Profile Key:", e);
    }

  },

  /**
   * Retrieves and decrypts the partner's Profile Key from the conversation.
   */
  async getPartnerProfileKey(conversationId: string, participantUids: string[], partnerUid: string): Promise<string | null> {
    if (!conversationId || !participantUids || !partnerUid) return null;

    try {
      const { deriveConversationKey } = await import("./encryption");
      const sharedSecret = deriveConversationKey(conversationId, participantUids);
      if (!sharedSecret) return null;
      const firestore = db as Firestore;
      const convRef = doc(firestore, CONVERSATIONS_COLLECTION, conversationId);
      const snap = await getDoc(convRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const encryptedPartnerKey = data[`profileKey_${partnerUid}`];
        
        if (encryptedPartnerKey) {
          try {
            // Use silent=true to avoid log spam during migration
            return decrypt(encryptedPartnerKey, sharedSecret, undefined, true);
          } catch (e) {
            // Expected during migration to stable keys
            return null;
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Updates the user's typing status for a specific conversation.
   * Uses an anonymous topic derived from the stable shared secret.
   */
  async setTypingStatus(conversationId: string, participantUids: string[], isTyping: boolean): Promise<void> {
    Logger.trace("PRESENCE", "presence-service.ts", "setTypingStatus", "PENDING", `isTyping=${isTyping}`);
    const firebaseAuth = auth as Auth;
    const user = firebaseAuth.currentUser;
    if (!conversationId || !participantUids || !user) return;


    try {
      const { deriveConversationKey } = await import("./encryption");
      const sharedSecret = deriveConversationKey(conversationId, participantUids);
      if (!sharedSecret) return;
      // Derive anonymous Topic ID: SHA256(sharedSecret + "typing")
      const topicId = CryptoJS.SHA256(sharedSecret + "typing").toString();
      const firestore = db as Firestore;
      const topicRef = doc(firestore, PRESENCE_TOPICS_COLLECTION, topicId);

      await setDoc(topicRef, {
        typing: isTyping,
        senderUid: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      Logger.trace("PRESENCE", "presence-service.ts", "setTypingStatus", "SUCCESS");
    } catch (e) {
      Logger.trace("PRESENCE", "presence-service.ts", "setTypingStatus", "FAILED", String(e));
      Logger.warn("[Presence] Failed to update typing status.");
    }

  },

  /**
   * Subscribes to typing indicators for a specific conversation.
   */
  subscribeToTyping(conversationId: string, participantUids: string[], callback: (isTyping: boolean) => void): () => void {
    const firebaseAuth = auth as Auth;
    const currentUser = firebaseAuth.currentUser;
    if (!conversationId || !participantUids || !currentUser) {
      callback(false);
      return () => {};
    }

    const { deriveConversationKey } = require("./encryption");
    const sharedSecret = deriveConversationKey(conversationId, participantUids);
    if (!sharedSecret) {
      callback(false);
      return () => {};
    }

    const topicId = CryptoJS.SHA256(sharedSecret + "typing").toString();
    const firestore = db as Firestore;
    const topicRef = doc(firestore, PRESENCE_TOPICS_COLLECTION, topicId);

    return onSnapshot(topicRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Ignore own typing events — only show partner's typing
        if (data.senderUid === currentUser.uid) {
          callback(false);
          return;
        }
        const now = Date.now();
        const updated = data.updatedAt?.toMillis() || 0;
        // Ignore "ghost" typing if it hasn't been updated in 10 seconds
        if (now - updated < 10000) {
          callback(data.typing === true);
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    });
  }
};

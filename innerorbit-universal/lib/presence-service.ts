import { doc, setDoc, updateDoc, onSnapshot, serverTimestamp, getDoc, Firestore } from "firebase/firestore";
// @ts-ignore
import * as firebase from "./firebase";
const { db, auth } = firebase as any;
import { Auth } from "firebase/auth";
import { encrypt, decrypt, ENC_VERSION_SIV } from "./encryption-core";
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
   */
  async publishPresence(sharePresence: boolean): Promise<void> {
    const firebaseAuth = auth as Auth;
    const user = firebaseAuth.currentUser;
    if (!user || !sharePresence) return;

    try {
      const profileKey = await IdentitySecurityService.getOrCreateProfileKey();
      if (!profileKey) return;

      const now = new Date().toISOString();
      // Use v3.5 (SIV) for fast, hardware-accelerated encryption
      const encryptedBlob = encrypt(now, profileKey, undefined, ENC_VERSION_SIV);

      const firestore = db as Firestore;
      const userRef = doc(firestore, USERS_COLLECTION, user.uid);
      await updateDoc(userRef, {
        presenceBlob: encryptedBlob,
        lastSeen: serverTimestamp(), // Unencrypted fallback for UI sorting (server only)
      });
      
      Logger.log("[Presence] ✅ Presence blob published.");
    } catch (e) {
      Logger.error("[Presence] Failed to publish presence:", e);
    }
  },

  /**
   * Subscribes to a partner's presence updates.
   */
  subscribeToPartnerPresence(partnerUid: string, partnerProfileKey: string, callback: (lastSeen: string | null) => void): () => void {
    if (!partnerUid || !partnerProfileKey) {
      callback(null);
      return () => {};
    }

    const firestore = db as Firestore;
    const userRef = doc(firestore, USERS_COLLECTION, partnerUid);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.presenceBlob) {
          try {
            const decrypted = decrypt(data.presenceBlob, partnerProfileKey);
            callback(decrypted);
          } catch (e) {
            Logger.warn("[Presence] Failed to decrypt partner presence blob.");
            callback(null);
          }
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },

  /**
   * Shares the local Profile Key with a conversation partner by encrypting it 
   * with the conversation's shared secret.
   */
  async shareProfileKeyWithPartner(conversationId: string, sharedSecret: string): Promise<void> {
    const firebaseAuth = auth as Auth;
    const user = firebaseAuth.currentUser;
    if (!user || !conversationId || !sharedSecret) return;

    try {
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
      
      Logger.log("[Presence] 🔑 Profile Key shared in conversation.");
    } catch (e) {
      Logger.error("[Presence] Failed to share Profile Key:", e);
    }
  },

  /**
   * Retrieves and decrypts the partner's Profile Key from the conversation.
   */
  async getPartnerProfileKey(conversationId: string, partnerUid: string, sharedSecret: string): Promise<string | null> {
    if (!conversationId || !partnerUid || !sharedSecret) return null;

    try {
      const firestore = db as Firestore;
      const convRef = doc(firestore, CONVERSATIONS_COLLECTION, conversationId);
      const snap = await getDoc(convRef);
      
      if (snap.exists()) {
        const data = snap.data();
        const encryptedPartnerKey = data[`profileKey_${partnerUid}`];
        
        if (encryptedPartnerKey) {
          return decrypt(encryptedPartnerKey, sharedSecret);
        }
      }
      return null;
    } catch (e) {
      Logger.error("[Presence] Failed to retrieve partner Profile Key:", e);
      return null;
    }
  },

  /**
   * Updates the user's typing status for a specific conversation.
   * Uses an anonymous topic derived from the shared secret.
   */
  async setTypingStatus(conversationId: string, sharedSecret: string, isTyping: boolean): Promise<void> {
    if (!conversationId || !sharedSecret) return;

    try {
      // Derive anonymous Topic ID: SHA256(sharedSecret + "typing")
      const topicId = CryptoJS.SHA256(sharedSecret + "typing").toString();
      const firestore = db as Firestore;
      const topicRef = doc(firestore, PRESENCE_TOPICS_COLLECTION, topicId);

      await setDoc(topicRef, {
        typing: isTyping,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      Logger.warn("[Presence] Failed to update typing status.");
    }
  },

  /**
   * Subscribes to typing indicators for a specific conversation.
   */
  subscribeToTyping(conversationId: string, sharedSecret: string, callback: (isTyping: boolean) => void): () => void {
    if (!conversationId || !sharedSecret) {
      callback(false);
      return () => {};
    }

    const topicId = CryptoJS.SHA256(sharedSecret + "typing").toString();
    const firestore = db as Firestore;
    const topicRef = doc(firestore, PRESENCE_TOPICS_COLLECTION, topicId);

    return onSnapshot(topicRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
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

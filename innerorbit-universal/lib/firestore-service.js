/** Purpose: Data access layer for Firestore (CRUD for users, conversations, messages, reactions, and nicknames). */
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  onSnapshot,
  Timestamp,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  limit,
  orderBy,
  increment,
  updateDoc
} from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import { ref as storageRefFn, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { Logger } from "./logger";
import { IdentitySecurityService } from "./identity-security-service";

/**
 * Firestore Service Module for InnerOrbit
 * Handles all database operations for users, conversations, and messages
 */

// Collection names
const USERS_COLLECTION = "users";
const PUBLIC_PROFILES_COLLECTION = "publicProfiles";
const CONVERSATIONS_COLLECTION = "conversations";
const MESSAGES_SUBCOLLECTION = "messages";
const DEFAULT_ENCRYPTION_CAPABILITIES = {
  v5: true,
  v5_5: true,
  v6: true,
  minReadable: 1,
  maxWritable: 6,
};

/**
 * Creates or updates a user profile in Firestore
 * @param user - Firebase Auth user object
 * @returns Object containing the generated userId and pin
 */
export async function createUserProfile(user) {
  Logger.trace('FIRESTORE', 'firestore-service.js', 'createUserProfile', 'PENDING', `uid=${user?.uid?.substring(0, 5)}...`);
  try {

    const userRef = doc(db, USERS_COLLECTION, user.uid);

    // 1. Check if profile exists BEFORE we do any work
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      if (data.userId && data.pin) {
        if (!data.encryptionCapabilities) {
          await setDoc(userRef, { encryptionCapabilities: DEFAULT_ENCRYPTION_CAPABILITIES }, { merge: true });
          Logger.trace('FIRESTORE', 'firestore-service.js', 'createUserProfile', 'SUCCESS', 'Backfilled encryption capabilities');
        }

        // 🔐 DECRYPT CLOUD IDENTITY (v5.5 -> v3 Fallback handled by service)
        const decryptedUserId = IdentitySecurityService.decryptFromCloud(data.userId, user.uid);
        const decryptedPin = IdentitySecurityService.decryptFromCloud(data.pin, user.uid);

        const sanitizedUid = user.uid ? `${user.uid.substring(0, 5)}...` : 'unknown';
        Logger.trace('FIRESTORE', 'firestore-service.js', 'createUserProfile', 'SUCCESS', `Profile recovered: ${decryptedUserId}`);

        // Calculate isReturningUser: true if lastSeen is older than 7 days
        let isReturningUser = false;
        if (data.lastSeen) {
          try {
            const lastSeenDate = data.lastSeen.toDate();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            if (lastSeenDate < oneWeekAgo) {
              isReturningUser = true;
              Logger.log(`[Firestore] User ${sanitizedUid} is RETURNING (Last seen: ${lastSeenDate.toISOString()})`);
            }
          } catch (e) {
            Logger.warn("[Firestore] Failed to calculate isReturningUser:", e.message);
          }
        }

        // 🔐 Ensure public profile exists for existing users (Lazy Population)
        const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, user.uid);
        const publicSnap = await getDoc(publicRef);
        if (!publicSnap.exists()) {
          Logger.log(`[Firestore] 🛠️ Populating missing public profile for ${sanitizedUid}`);
          await setDoc(publicRef, {
            uid: user.uid,
            userId: decryptedUserId,
            displayName: user.displayName || data.displayName || null,
            photoURL: user.photoURL || data.photoURL || null,
            photoVisibility: data.photoVisibility || 'private',
            dhPublicKey: data.dhPublicKey || null,
            v6PublicKeys: data.v6PublicKeys || null,
            bio: data.bio || null,
            createdAt: data.createdAt || serverTimestamp(),
            lastSeen: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // 🔐 Repair: If public profile exists but userId is missing
          const publicData = publicSnap.data();
          if (!publicData.userId) {
            Logger.log(`[Firestore] 🛠️ Repairing userId in public profile for ${sanitizedUid}`);
            await setDoc(publicRef, {
              userId: decryptedUserId,
              updatedAt: serverTimestamp()
            }, { merge: true });
          }
        }

        return {
          userId: decryptedUserId,
          pin: decryptedPin || decryptedUserId,
          isNewUser: false,
          isReturningUser,
          hasSetPassword: data.hasSetPassword || false
        };
      }
    }

    // 2. SAFETY CHECK: Abort ONLY if this is an OLD account with CORRUPT/PARTIAL data.
    // If the doc is totally MISSING (existingSnap.exists() is false), we allow creation (Repair Mode).
    const creationTime = user.metadata?.creationTime;
    if (creationTime && !existingSnap.exists()) {
      const createdDate = new Date(creationTime);
      const isOldAccount = createdDate < new Date(Date.now() - 10 * 60 * 1000); // > 10 mins
      if (isOldAccount) {
        Logger.warn(`[Firestore] 🛠️ Repairing profile for OLD account (${creationTime}) - Doc was missing.`);
      }
      if (isOldAccount) {
        Logger.warn(`[Firestore] 🛠️ Auto-repairing CORRUPTED profile for OLD account (${creationTime}). Adding missing identity.`);
      }
    }

    // 3. PREPARE: Generate new identity if needed
    const { generateUniqueUserId, generateUniquePin } = await import("./user-id-generator");
    const userId = await generateUniqueUserId();
    const pin = await generateUniquePin();

    // 4. TRANSACTION: Atomic setup
    return await runTransaction(db, async (transaction) => {
      const freshSnap = await transaction.get(userRef);
      if (freshSnap.exists() && freshSnap.data().userId) {
        // Double check inside transaction
        const d = freshSnap.data();
        // Calculate isReturningUser even in transaction case
        let isReturningUser = false;
        if (d.lastSeen) {
          try {
            const lastSeenDate = d.lastSeen.toDate();
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            if (lastSeenDate < oneWeekAgo) {
              isReturningUser = true;
            }
          } catch (e) { }
        }
        return {
          userId: d.userId,
          pin: d.pin,
          isNewUser: false,
          isReturningUser,
          hasSetPassword: d.hasSetPassword || false
        };
      }

      // 🔐 IDENTITY STORAGE MODEL (v5.5 Hybrid)
      // ─────────────────────────────────────────────────────────────────────────
      // userId → PLAIN TEXT: Must remain queryable for PIN login & contact search.
      //          (encryptForCloud uses a per-uid key, making the same userId produce
      //           different ciphertexts for different users → Firestore can't query it)
      // pin    → ENCRYPTED: Never queried; read back only by the owning uid.
      // ─────────────────────────────────────────────────────────────────────────
      const cloudSyncEnabled = await IdentitySecurityService.isCloudSyncEnabled();
      const encryptedPin = cloudSyncEnabled ? IdentitySecurityService.encryptForCloud(pin, user.uid) : "LOCAL_ONLY";

      // 1. Write to Private Collection
      transaction.set(userRef, {
        uid: user.uid,
        email: user.email,
        userId,          // ← plain text (intentional — see model above)
        pin: encryptedPin,
        hasSetPassword: false,
        encryptionCapabilities: DEFAULT_ENCRYPTION_CAPABILITIES,
        profileEncryptionVersion: "v5.5",
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      }, { merge: true });

      // 2. Write to Public Collection
      const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, user.uid);
      transaction.set(publicRef, {
        uid: user.uid,
        userId,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      }, { merge: true });

      const sanitizedUid = user.uid ? `${user.uid.substring(0, 5)}...` : 'unknown';
      Logger.trace('FIRESTORE', 'firestore-service.js', 'createUserProfile', 'SUCCESS', `Created NEW profile: ${userId}`);
      return { userId, pin, isNewUser: true, hasSetPassword: false };
    });
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'createUserProfile', 'FAILED', error.message);
    throw error;
  }
}

/**
 * 🔄 LAZY IDENTITY MIGRATION — v5.5 Hybrid Enforcement
 *
 * Detects and repairs legacy Firestore identity records on every login:
 *   - Encrypted userId   → unwound to plain text (must stay queryable)
 *   - Plain-text pin     → encrypted with v5.5 (must be private)
 *
 * This function is:
 *   • Idempotent: Already-migrated profiles are detected via `profileEncryptionVersion` and skipped.
 *   • Non-blocking: Errors are caught and logged; the caller receives the pre-migration data on failure.
 *   • Atomic:  Only one Firestore write occurs, and only when migration is actually needed.
 *
 * @param userRef   - Firestore DocumentReference for the user
 * @param data      - Current raw Firestore document data (already fetched by caller)
 * @param uid       - Firebase Auth UID of the user (used as encryption key derivation input)
 * @returns { migratedUserId, migratedPin } or nulls if no migration was needed
 */
async function migrateIdentityEncryptionIfNeeded(userRef, data, uid) {
  try {
    // Already fully migrated — no work needed.
    if (data.profileEncryptionVersion === "v5.5") {
      Logger.trace('FIRESTORE', 'firestore-service.js', 'migrateIdentityEncryption', 'SUCCESS', 'Already migrated to v5.5');
      return { migratedUserId: null, migratedPin: null };
    }

    const updates = {};
    let migratedUserId = null;
    let migratedPin = null;

    // --- Repair 1: userId must be PLAIN TEXT ---
    // A ':' character indicates an encrypted v5.5 blob (e.g. "v5.5:nonce:ciphertext").
    // Decrypt it back to plain text so Firestore queries continue to work.
    if (data.userId && data.userId.includes(":")) {
      const plainUserId = IdentitySecurityService.decryptFromCloud(data.userId, uid);
      if (plainUserId && !plainUserId.startsWith("🔒")) {
        updates.userId = plainUserId;
        migratedUserId = plainUserId;
        Logger.log(`[Migration] ✅ Unwound encrypted userId → plain text for ${uid.substring(0, 5)}...`);
      } else {
        Logger.warn(`[Migration] ⚠️ Could not decrypt userId for ${uid.substring(0, 5)}... — leaving unchanged.`);
      }
    } else {
      // Already plain text — no change needed, but note the resolved value
      migratedUserId = null; // null signals "use data.userId as-is"
    }

    // --- Repair 2: pin must be ENCRYPTED ---
    // A ':' character indicates an encrypted blob. If absent, the pin is plain text (legacy).
    if (data.pin && !data.pin.includes(":")) {
      const cloudSyncEnabled = await IdentitySecurityService.isCloudSyncEnabled();
      const encryptedPin = cloudSyncEnabled
        ? IdentitySecurityService.encryptForCloud(data.pin, uid)
        : "LOCAL_ONLY";
      updates.pin = encryptedPin;
      migratedPin = encryptedPin;
      Logger.log(`[Migration] ✅ Encrypted plain-text PIN for ${uid.substring(0, 5)}...`);
    } else {
      migratedPin = null; // null signals "use data.pin as-is"
    }

    // --- Write migration atomically (only if something changed) ---
    if (Object.keys(updates).length > 0) {
      updates.profileEncryptionVersion = "v5.5";
      updates.encryptionMigratedAt = serverTimestamp();
      await setDoc(userRef, updates, { merge: true });
      Logger.log(`[Migration] ✅ Lazy migration complete for ${uid.substring(0, 5)}...`, Object.keys(updates));
    } else {
      // Nothing to change — stamp the version flag so we skip next time
      await setDoc(userRef, { profileEncryptionVersion: "v5.5" }, { merge: true });
    }

    return { migratedUserId, migratedPin };
  } catch (err) {
    Logger.error(`[Migration] ❌ Migration failed for ${uid?.substring(0, 5)}... — falling back to raw data:`, err);
    return { migratedUserId: null, migratedPin: null };
  }
}

/**
 * Retrieves a user profile by UID
 * @param uid - User ID
 * @returns User profile or null if not found
 */
export async function getUserProfile(uid) {
  Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserProfile', 'PENDING', `uid=${uid?.substring(0, 5)}...`);
  if (!uid) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserProfile', 'FAILED', 'Missing uid');
    return null;
  }


  // 1. Attempt Private Profile (Sensitive data, restricted to contacts)
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      // 🔐 DECRYPT CLOUD IDENTITY (v5.5 -> v3 Fallback handled by service)
      if (data.userId) data.userId = IdentitySecurityService.decryptFromCloud(data.userId, uid);
      if (data.pin) data.pin = IdentitySecurityService.decryptFromCloud(data.pin, uid);
      Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserProfile', 'SUCCESS', `Private profile resolved: ${uid.substring(0, 5)}...`);
      return data;
    }
  } catch (privateError) {
    // If not a permission error, log it as a real issue
    if (privateError.code !== 'permission-denied') {
      Logger.warn(`[Firestore] Unexpected error fetching private profile for ${uid}:`, privateError.code);
    } else {
      Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserProfile', 'FAILED', `Private ACCESS DENIED for ${uid.substring(0, 5)}... falling back to public.`);
    }
    // Otherwise, proceed silently to public fallback
  }

  // 2. FALLBACK: Public Profile (Basic data, open to all authenticated users)
  try {
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);
    const publicSnap = await getDoc(publicRef);

    if (publicSnap.exists()) {
      const publicData = publicSnap.data();
      Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserProfile', 'SUCCESS', `Public profile resolved: ${uid.substring(0, 5)}...`);
      return {
        uid: uid,
        ...publicData,
        isPublicOnly: true
      };
    } else {
      Logger.warn(`[Firestore] ❌ No public profile exists for ${uid.substring(0, 5)}...`);
    }
  } catch (publicError) {
    Logger.warn(`[Firestore] Profile lookup failed (Private & Public) for ${uid}:`, publicError.code);
  }

  // 🛡️ EXTREME FALLBACK: Search for identity in connectionRequests if both profile lookups fail
  try {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return null;

    // 1. Check if WE were the SENDER of a request to them
    const q1 = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", currentUid),
      where("receiverId", "==", uid),
      limit(1)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
      const data = snap1.docs[0].data();
      if (data.receiverInfo?.userId) {
        Logger.log(`[Firestore] 🛡️ Identity found in connectionRequest (We sent to them) for ${uid}: ${data.receiverInfo.userId}`);
        return { uid, userId: data.receiverInfo.userId, isFallback: true };
      }
    }

    // 2. Check if THEY were the SENDER of a request to us
    const q2 = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", uid),
      where("receiverId", "==", currentUid),
      limit(1)
    );
    const snap2 = await getDocs(q2);
    if (!snap2.empty) {
      const data = snap2.docs[0].data();
      if (data.senderInfo?.userId) {
        Logger.log(`[Firestore] 🛡️ Identity found in connectionRequest (They sent to us) for ${uid}: ${data.senderInfo.userId}`);
        return { uid, userId: data.senderInfo.userId, isFallback: true };
      }
    }
  } catch (e) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserProfile', 'FAILED', `Identity resolution failed for ${uid.substring(0, 5)}...`);
  }

  return null;
}

/**
 * Updates a user profile
 * @param uid - User ID
 * @param updates - Object containing fields to update (bio, photoURL, photoVisibility, photoMetadata, etc.)
 */
export async function updateUserProfile(uid, updates) {
  Logger.trace('FIRESTORE', 'firestore-service.js', 'updateUserProfile', 'PENDING', `uid=${uid?.substring(0, 5)}...`);
  if (!uid) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateUserProfile', 'FAILED', 'Missing uid');
    return;
  }
  try {

    const userRef = doc(db, USERS_COLLECTION, uid);

    // 🔐 ENCRYPT ONLY PIN (v5.5) — userId MUST remain plain text for Firestore queries
    const secureUpdates = { ...updates };
    const cloudSyncEnabled = await IdentitySecurityService.isCloudSyncEnabled();

    if (secureUpdates.pin && secureUpdates.pin !== "LOCAL_ONLY") {
      secureUpdates.pin = cloudSyncEnabled ? IdentitySecurityService.encryptForCloud(secureUpdates.pin, uid) : "LOCAL_ONLY";
    }

    // Ensure photoVisibility is sanitized
    if (secureUpdates.photoVisibility && !['private', 'contacts'].includes(secureUpdates.photoVisibility)) {
      secureUpdates.photoVisibility = 'private';
    }

    await setDoc(userRef, { ...secureUpdates, updatedAt: serverTimestamp() }, { merge: true });

    // Sync public fields to Public Collection
    const publicFields = ['userId', 'displayName', 'photoURL', 'photoVisibility', 'photoMetadata', 'bio'];
    const publicUpdates = {};
    let hasPublicUpdates = false;

    for (const field of publicFields) {
      if (field in updates) {
        publicUpdates[field] = updates[field];
        hasPublicUpdates = true;
      }
    }

    if (hasPublicUpdates) {
      const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);
      await setDoc(publicRef, { ...publicUpdates, updatedAt: serverTimestamp() }, { merge: true });
    }

    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateUserProfile', 'SUCCESS', `Updated profile for ${uid.substring(0, 5)}...`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateUserProfile', 'FAILED', error.message);
    throw error;
  }
}

/**
 * 🛠️ REPAIR PUBLIC PROFILE
 * Fetches the private profile, decrypts identity, and ensures the public profile is in sync.
 * @param {string} uid - User UID
 */
export async function repairPublicProfile(uid) {
  if (!uid) return;
  try {
    const profile = await getUserProfile(uid);
    // If we only have public data, we can't repair from it (no source of truth)
    if (!profile || profile.isPublicOnly) {
      Logger.warn(`[Firestore] 🛠️ Cannot repair ${uid.substring(0, 5)}...: No private profile access.`);
      return;
    }

    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);
    const publicFields = ['userId', 'displayName', 'photoURL', 'photoVisibility', 'photoMetadata', 'bio', 'dhPublicKey', 'v6PublicKeys'];
    const publicUpdates = {};

    for (const field of publicFields) {
      if (profile[field] !== undefined) {
        publicUpdates[field] = profile[field];
      }
    }

    // Always ensure userId is present if it's in the private profile
    if (profile.userId && !publicUpdates.userId) {
      publicUpdates.userId = profile.userId;
    }

    if (Object.keys(publicUpdates).length > 0) {
      Logger.log(`[Firestore] 🛠️ Writing repair to public profile for ${uid.substring(0, 5)}...`, Object.keys(publicUpdates));
      await setDoc(publicRef, {
        ...publicUpdates,
        updatedAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      }, { merge: true });
      Logger.trace('FIRESTORE', 'firestore-service.js', 'repairPublicProfile', 'SUCCESS', `Public profile repaired for ${uid.substring(0, 5)}...`);
    }
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'repairPublicProfile', 'FAILED', error.message);
  }
}

/**
 * Publishes this user's X25519 DH public key to their Firestore profile.
 * Called on login via ratchet-key-service.publishMyKeysOnLogin().
 * Other users fetch this key to initialize v4 Double Ratchet sessions.
 *
 * @param {string} uid - Firebase UID of the current user
 * @param {string} dhPublicKeyBase64 - Base64-encoded X25519 public key
 */
export async function publishDhPublicKey(uid, dhPublicKeyBase64) {
  try {
    const currentUid = auth.currentUser?.uid;
    Logger.log(`[Firestore] Publishing DH key for ${uid.substring(0, 5)}... (Active Session: ${currentUid?.substring(0, 5) || "None"})`);

    if (uid !== currentUid) {
      Logger.warn(`[Firestore] ⚠️ UID mismatch detected during DH publication! Target: ${uid}, Auth: ${currentUid}`);
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);

    await Promise.all([
      setDoc(userRef, { dhPublicKey: dhPublicKeyBase64 }, { merge: true }),
      setDoc(publicRef, { dhPublicKey: dhPublicKeyBase64 }, { merge: true })
    ]);

    Logger.trace('FIRESTORE', 'firestore-service.js', 'publishDhPublicKey', 'SUCCESS', `DH key published for ${uid.substring(0, 5)}...`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'publishDhPublicKey', 'FAILED', error.message);
    throw error;
  }
}


/**
 * Publishes this user's v6 public keys (DH + ML-KEM-768) to their Firestore profile.
 * Called on login via ratchet-key-service.publishMyKeysOnLogin().
 *
 * @param {string} uid - Firebase UID of the current user
 * @param {string} dhPublicKey - Base64-encoded X25519 public key
 * @param {string} pqcPublicKey - Base64-encoded ML-KEM-768 public key
 * @param {string} identityPublicKey - Base64-encoded Ed25519 public key
 * @param {string} capabilitiesSignature - Base64-encoded digital signature
 */
export async function publishV6PublicKeys(uid, dhPublicKey, pqcPublicKey, identityPublicKey, capabilitiesSignature) {
  try {
    const currentUid = auth.currentUser?.uid;
    Logger.log(`[Firestore] Publishing v6 PQC keys for ${uid.substring(0, 5)}... (Active Session: ${currentUid?.substring(0, 5) || "None"})`);

    if (uid !== currentUid) {
      Logger.warn(`[Firestore] ⚠️ UID mismatch detected during v6 publication! Target: ${uid}, Auth: ${currentUid}`);
    }

    const userRef = doc(db, USERS_COLLECTION, uid);
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);

    const keyPayload = {
      v6PublicKeys: {
        dh: dhPublicKey,
        pqc: pqcPublicKey,
        identity: identityPublicKey,
        signature: capabilitiesSignature,
        updatedAt: serverTimestamp()
      }
    };

    await Promise.all([
      setDoc(userRef, keyPayload, { merge: true }),
      setDoc(publicRef, keyPayload, { merge: true })
    ]);

    Logger.trace('FIRESTORE', 'firestore-service.js', 'publishV6PublicKeys', 'SUCCESS', `v6 keys published for ${uid.substring(0, 5)}...`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'publishV6PublicKeys', 'FAILED', error.message);
    throw error;
  }
}


/**
 * Fetches a user's X25519 DH public key from Firestore.
 * Called by ratchet-key-service.initializeRatchetIfNeeded() when opening a chat.
 *
 * @param {string} uid - Firebase UID of the target user
 * @returns {string|null} Base64-encoded public key, or null if not published yet
 */
export async function fetchDhPublicKey(uid) {
  try {
    // Keys should now be read from the Public collection so others can access them
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);
    const snap = await getDoc(publicRef);
    if (snap.exists() && snap.data().dhPublicKey) {
      Logger.trace('FIRESTORE', 'firestore-service.js', 'fetchDhPublicKey', 'SUCCESS', `DH key fetched for ${uid.substring(0, 5)}...`);
      return snap.data().dhPublicKey;
    }
    return null;
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'fetchDhPublicKey', 'FAILED', error.message);
    return null;
  }
}

/**
 * Fetches a user's v6 public keys from Firestore.
 *
 * @param {string} uid - Firebase UID of the target user
 * @returns {object|null} Object { dh, pqc, identity, signature }, or null if not published
 */
export async function fetchV6PublicKeys(uid) {
  try {
    // Keys should now be read from the Public collection so others can access them
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);
    const snap = await getDoc(publicRef);
    if (snap.exists() && snap.data().v6PublicKeys) {
      Logger.trace('FIRESTORE', 'firestore-service.js', 'fetchV6PublicKeys', 'SUCCESS', `v6 keys fetched for ${uid.substring(0, 5)}...`);
      return snap.data().v6PublicKeys;
    }
    return null;
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'fetchV6PublicKeys', 'FAILED', error.message);
    return null;
  }
}

/**
 * Saves an encrypted ratchet session backup for cross-device recovery.
 * Stored at: users/{uid}/keyBackups/{convId}
 * The value is an AES-GCM ciphertext encrypted with the user's PIN-derived key —
 * the server cannot read it.
 *
 * @param {string} uid     - Firebase UID of the current user
 * @param {string} convId  - Conversation document ID
 * @param {string} encryptedB64 - Base64 AES-GCM ciphertext of the ratchet shared secret
 */
export async function saveKeyBackup(uid, convId, encryptedB64) {
  try {
    const backupRef = doc(db, USERS_COLLECTION, uid, "keyBackups", convId);
    await setDoc(backupRef, {
      encryptedSecret: encryptedB64,
      updatedAt: serverTimestamp(),
    });
    Logger.trace('FIRESTORE', 'firestore-service.js', 'saveKeyBackup', 'SUCCESS', `Key backup saved: ${convId.substring(0, 8)}`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'saveKeyBackup', 'FAILED', error.message);
  }
}

/**
 * Fetches an encrypted ratchet session backup from Firestore.
 *
 * @param {string} uid    - Firebase UID of the current user
 * @param {string} convId - Conversation document ID
 * @returns {string|null} Base64 AES-GCM ciphertext, or null if not found
 */
export async function fetchKeyBackup(uid, convId) {
  try {
    const backupRef = doc(db, USERS_COLLECTION, uid, "keyBackups", convId);
    const snap = await getDoc(backupRef);
    if (snap.exists() && snap.data().encryptedSecret) {
      Logger.trace('FIRESTORE', 'firestore-service.js', 'fetchKeyBackup', 'SUCCESS', `Key backup fetched: ${convId.substring(0, 8)}`);
      return snap.data().encryptedSecret;
    }
    return null;
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'fetchKeyBackup', 'FAILED', error.message);
    return null;
  }
}

/**
 * Deletes a user profile (Account Deletion)
 * @param uid - User ID to delete
 */
export async function deleteUserProfile(uid) {
  if (!uid) return;
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, uid);
    await Promise.all([
      deleteDoc(userRef),
      deleteDoc(publicRef)
    ]);
    Logger.trace('FIRESTORE', 'firestore-service.js', 'deleteUserProfile', 'SUCCESS', `Deleted profile: ${uid.substring(0, 5)}...`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'deleteUserProfile', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Searches for users by email
 * @param searchEmail - Email to search for
 * @returns Array of matching user profiles
 */
export async function searchUsersByEmail(searchEmail) {
  try {
    const q = query(collection(db, USERS_COLLECTION), where("email", "==", searchEmail));
    const querySnapshot = await getDocs(q);
    Logger.trace('FIRESTORE', 'firestore-service.js', 'searchUsersByEmail', 'SUCCESS', `Found ${querySnapshot.size} matches`);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'searchUsersByEmail', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Searches for a user by their 4-digit userId
 * @param userId - 4-digit user ID to search for
 * @returns User profile or null if not found
 */
export async function searchUserByUserId(userId) {
  try {
    const q = query(collection(db, USERS_COLLECTION), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const userDoc = querySnapshot.docs[0];
    Logger.trace('FIRESTORE', 'firestore-service.js', 'searchUserByUserId', 'SUCCESS', `Found ${userId}`);
    return {
      uid: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'searchUserByUserId', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Creates a new conversation between two users
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Conversation ID
 */
export async function createConversation(userId1, userId2) {
  try {
    // Check if conversation already exists
    const existingConv = await getConversationBetweenUsers(userId1, userId2);
    if (existingConv) {
      return existingConv.id;
    }

    // Create new conversation
    const conversationRef = collection(db, CONVERSATIONS_COLLECTION);
    const docRef = await addDoc(conversationRef, {
      participantIds: [userId1, userId2],
      createdAt: Timestamp.now(),
    });

    Logger.trace('FIRESTORE', 'firestore-service.js', 'createConversation', 'SUCCESS', `Created conv: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'createConversation', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Gets a conversation between two users
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Conversation or null if not found
 */
export async function getConversationBetweenUsers(userId1, userId2) {
  const currentUid = auth.currentUser?.uid;
  const queryUid = (userId2 === currentUid) ? userId2 : userId1;
  const otherUid = (queryUid === userId1) ? userId2 : userId1;

  let attempt = 0;
  const maxRetries = 2;

  while (attempt < maxRetries) {
    try {
      const q = query(
        collection(db, CONVERSATIONS_COLLECTION),
        where("participantIds", "array-contains", queryUid)
      );

      const querySnapshot = await getDocs(q);
      const conversation = querySnapshot.docs.find((doc) => {
        const data = doc.data();
        return data.participantIds && Array.isArray(data.participantIds) && data.participantIds.includes(otherUid);
      });

      if (conversation) {
        Logger.trace('FIRESTORE', 'firestore-service.js', 'getConversationBetweenUsers', 'SUCCESS', `Found conv: ${conversation.id}`);
      }
      return conversation ? { id: conversation.id, ...conversation.data() } : null;
    } catch (error) {
      if (error.code === 'permission-denied' && attempt < maxRetries - 1) {
        attempt++;
        Logger.trace('FIRESTORE', 'firestore-service.js', 'getConversationBetweenUsers', 'FAILED', `permission-denied (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        continue;
      }
      Logger.trace('FIRESTORE', 'firestore-service.js', 'getConversationBetweenUsers', 'FAILED', error.message);
      throw error;
    }
  }
}

/**
 * Gets all conversations for a user
 * @param userId - User ID
 * @returns Array of conversations
 */
export async function getUserConversations(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, CONVERSATIONS_COLLECTION),
      where("participantIds", "array-contains", userId)
    );

    const querySnapshot = await getDocs(q);
    Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserConversations', 'SUCCESS', `Found ${querySnapshot.size} convs`);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'getUserConversations', 'FAILED', error.message);
    throw error;
  }
}

/**
 * @param encryptedText - Encrypted message text (or image URL)
 * @param replyTo - Optional object { id, text, senderName } for threading
 * @param type - Message type: 'text' or 'image'
 * @param scheduledSeconds - Seconds to delay the message send
 * @param ephemeralDuration - Seconds the message lasts after being read (Receiver only)
 * @returns Message ID
 */
export async function sendMessage(conversationId, senderId, encryptedText, replyTo = null, scheduledSeconds = 0, type = 'text', ephemeralDuration = 0, options = {}) {
  Logger.trace('FIRESTORE', 'firestore-service.js', 'sendMessage', 'PENDING', `conv=${conversationId?.substring(0, 5)}... type=${type}`);
  try {

    const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
    const serverTime = Timestamp.now();
    const { encVersion = null, mimeType = null } = options || {};

    const messageData = {
      // 🕶️ SEALED SENDER: senderId removed from top-level
      encryptedText,
      timestamp: serverTime,
      status: 'sent', // 'sent', 'delivered', 'read'
      replyTo, // Store the quoted message info
      type, // 'text' or 'image'
    };
    if (encVersion) {
      messageData.encVersion = encVersion;
    }
    if (mimeType) {
      messageData.mimeType = mimeType;
    }

    if (scheduledSeconds > 0) {
      messageData.scheduledAt = new Timestamp(serverTime.seconds + scheduledSeconds, serverTime.nanoseconds);
      messageData.status = 'scheduled'; // Custom status for filtering
    }

    if (ephemeralDuration > 0) {
      messageData.ephemeralDuration = ephemeralDuration;
    }

    const docRef = await addDoc(messagesRef, messageData);

    // Update conversation's last message and increment unread count for recipient
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);

    // We need to find the recipient to increment their specific counter
    const convSnap = await getDoc(conversationRef);
    if (convSnap.exists()) {
      const convData = convSnap.data();
      const recipientId = convData.participantIds?.find(id => id !== senderId);

      const updates = {
        lastMessage: type === 'image' || type === 'vault_media' ? (mimeType?.startsWith('image/') ? "📷 Image" : "📄 Document") : encryptedText,
        lastMessageTime: serverTime,
        lastMessageId: docRef.id,
        // 🕶️ SEALED SENDER: lastMessageSenderId anonymized
        lastMessageSenderId: 'sealed',
        lastMessageStatus: 'sent',
      };
      if (encVersion && type === 'text') {
        updates.lastMessageEncVersion = encVersion;
      }

      if (recipientId) {
        updates[`unreadCount_${recipientId}`] = increment(1);
      }

      await updateDoc(conversationRef, updates);
    }

    Logger.trace('FIRESTORE', 'firestore-service.js', 'sendMessage', 'SUCCESS', `Sent msg: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'sendMessage', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Uploads an image to Firebase Storage
 * @param uri - Local image URI
 * @param conversationId - Conversation ID context
 * @returns Download URL
 */
export async function uploadChatImage(uri, conversationId) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `chats/${conversationId}/${Date.now()}.jpg`;
    const objectRef = storageRefFn(storage, filename);
    await uploadBytes(objectRef, blob);
    Logger.trace('FIRESTORE', 'firestore-service.js', 'uploadChatImage', 'SUCCESS', `Uploaded image to storage`);
    return await getDownloadURL(objectRef);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'uploadChatImage', 'FAILED', error.message);
    throw error;
  }
}

/**
 * 🔒 SECURE PROFILE PHOTO METADATA
 * 
 * Instead of direct photoURL, we store v5.5 cryptographic pointers.
 * The actual blob is in profiles/{uid}/avatar.enc
 */
export async function updateProfilePhotoMetadata(uid, metadata, visibility = 'private') {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      photoVisibility: visibility,
      updatedAt: serverTimestamp()
    });
    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateProfilePhotoMetadata', 'SUCCESS', `Updated photo metadata for ${uid.substring(0, 5)}...`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateProfilePhotoMetadata', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Updates a message (Edit)
 */
export async function updateMessage(conversationId, messageId, updates) {
  try {
    const msgRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
    await setDoc(msgRef, { ...updates, isEdited: true }, { merge: true });
    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateMessage', 'SUCCESS', `Edited msg: ${messageId.substring(0, 8)}`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'updateMessage', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Deletes a message for everyone (Soft Delete)
 */
export async function deleteMessageForEveryone(conversationId, messageId) {
  try {
    const msgRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
    await setDoc(msgRef, { isDeleted: true, encryptedText: "" }, { merge: true });
    Logger.trace('FIRESTORE', 'firestore-service.js', 'deleteMessageForEveryone', 'SUCCESS', `Deleted msg: ${messageId.substring(0, 8)}`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'deleteMessageForEveryone', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Hard deletes a scheduled message before it arrives
 */
export async function hardDeleteMessage(conversationId, messageId) {
  try {
    const msgRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
    await deleteDoc(msgRef);
    Logger.trace('FIRESTORE', 'firestore-service.js', 'hardDeleteMessage', 'SUCCESS', `Hard deleted msg: ${messageId.substring(0, 8)}`);
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'hardDeleteMessage', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Hides a message for the current user (Delete for Me)
 * This requires fetching current 'hiddenFor' array and appending
 */
export async function deleteMessageForMe(conversationId, messageId, userId) {
  // This is complex without array-union helper imported, doing simple read-write
  try {
    const msgRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
    const snap = await getDoc(msgRef);
    if (snap.exists()) {
      const data = snap.data();
      const hiddenFor = data.hiddenFor || [];
      if (!hiddenFor.includes(userId)) {
        await setDoc(msgRef, { hiddenFor: [...hiddenFor, userId] }, { merge: true });
        Logger.trace('FIRESTORE', 'firestore-service.js', 'deleteMessageForMe', 'SUCCESS', `Hid msg: ${messageId.substring(0, 8)}`);
      }
    }
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'deleteMessageForMe', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Gets all messages from a conversation
 * @param conversationId - Conversation ID
 * @returns Array of messages
 */
export async function getConversationMessages(conversationId) {
  try {
    const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
    const querySnapshot = await getDocs(messagesRef);
    Logger.trace('FIRESTORE', 'firestore-service.js', 'getConversationMessages', 'SUCCESS', `Fetched ${querySnapshot.size} msgs`);
    return querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
  } catch (error) {
    Logger.trace('FIRESTORE', 'firestore-service.js', 'getConversationMessages', 'FAILED', error.message);
    throw error;
  }
}

/**
 * Subscribes to real-time message updates for a conversation
 * @param conversationId - Conversation ID
 * @param callback - Function to call when messages update
 * @returns Unsubscribe function
 */
export function subscribeToMessages(conversationId, callback) {
  try {
    const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
    const q = query(messagesRef);

    return onSnapshot(q, (querySnapshot) => {
      const messages = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

      callback(messages);
    }, (error) => {
      if (error?.code === "permission-denied") {
        Logger.warn(`[Firestore] subscribeToMessages: permission-denied for ${conversationId.substring(0, 5)}... (transient auth lag)`);
        return;
      }
      Logger.error("Error in messages listener:", error);
    });
  } catch (error) {
    Logger.error("Error subscribing to messages:", error);
    throw error;
  }
}

/**
 * Subscribes to real-time conversation updates for a user
 * @param userId - User ID
 * @param callback - Function to call when conversations update
 * @returns Unsubscribe function
 */
export function subscribeToConversations(userId, callback, onError) {
  Logger.trace('FIRESTORE', 'firestore-service.js', 'subscribeToConversations', 'PENDING', `uid=${userId?.substring(0, 5)}...`);
  if (!userId) {
    // Return a no-op unsubscribe if called before auth is ready
    Logger.trace('FIRESTORE', 'firestore-service.js', 'subscribeToConversations', 'FAILED', 'Missing userId');
    Logger.warn("[Firestore] subscribeToConversations called without userId — skipping.");
    return () => { };
  }

  try {
    const q = query(
      collection(db, CONVERSATIONS_COLLECTION),
      where("participantIds", "array-contains", userId)
    );

    return onSnapshot(q, (querySnapshot) => {
      const conversations = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(conversations);
    }, (error) => {
      // Ignore permission-denied — happens transiently while Firebase auth token propagates
      if (error?.code === "permission-denied") {
        Logger.warn("[Firestore] subscribeToConversations: permission-denied (auth token still propagating — will retry on next mount).");
        return; // Silently swallow; caller can retry by re-mounting once user is confirmed
      }
      Logger.error("Firestore subscription error:", error);
      if (onError) onError(error);
    });
  } catch (error) {
    Logger.error("Error subscribing to conversations:", error);
    throw error;
  }
}

/**
 * Saves a custom nickname for a contact
 * @param userId - Current user's ID
 * @param contactUid - Contact's UID
 * @param nickname - Custom nickname to set
 */
export async function saveContactNickname(userId, contactUid, nickname) {
  try {
    const contactRef = doc(db, USERS_COLLECTION, userId, "contacts", contactUid);
    await setDoc(contactRef, { nickname }, { merge: true });
    Logger.log(`[Firestore] ✅ Nickname set for ${contactUid.substring(0, 5)}...: ${nickname}`);
  } catch (error) {
    Logger.error("Error saving nickname:", error);
    throw error;
  }
}

/**
 * Subscribes to the user's custom nicknames
 * @param userId - Current user's ID
 * @param callback - Function to call with the nicknames map { contactUid: nickname }
 * @returns Unsubscribe function
 */
export function subscribeToContactNicknames(userId, callback) {
  try {
    const contactsRef = collection(db, USERS_COLLECTION, userId, "contacts");
    return onSnapshot(contactsRef, (snapshot) => {
      const nicknames = {};
      snapshot.forEach((doc) => {
        nicknames[doc.id] = doc.data().nickname;
      });
      callback(nicknames);
    }, (error) => {
      if (error?.code === "permission-denied") {
        Logger.warn("[Firestore] subscribeToContactNicknames: permission-denied (auth token still propagating)");
        return;
      }
      Logger.error("[Firestore] Error in nicknames listener:", error);
    });
  } catch (error) {
    Logger.error("Error subscribing to nicknames:", error);
    // Return dummy unsubscribe to prevent crashes
    return () => { };
  }
}

/**
 * Deletes all messages in a conversation and optionally the images in storage
 */
export async function clearChatData(conversationId, deleteMedia = false) {
  try {
    Logger.log(`[Firestore] Clearing chat data for conv=${conversationId} deleteMedia=${deleteMedia}`);
    // 1. Get all messages
    const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);
    const snap = await getDocs(messagesRef);

    // 2. Delete all message documents in Firestore
    const deletePromises = snap.docs.map(mDoc => deleteDoc(doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, mDoc.id)));
    await Promise.all(deletePromises);
    Logger.log(`[Firestore] ✅ Deleted ${snap.docs.length} messages from Firestore.`);

    // 3. Optionally delete all media in Storage for this conversation
    if (deleteMedia) {
      // ⚠️ Firebase Storage listAll() is blocked by CORS on web (localhost and web deployments).
      // Skip storage cleanup on web — media files become inaccessible once their Firestore
      // messages are deleted. On mobile/native, proceed normally.
      const isWebEnv = typeof document !== 'undefined';
      if (isWebEnv) {
        Logger.warn(`[Storage] Skipping media cleanup on web (CORS restriction). Files will be orphaned but inaccessible.`);
      } else {
        try {
          const folderRef = storageRefFn(storage, `chats/${conversationId}`);
          let listRes;
          try {
            listRes = await listAll(folderRef);
          } catch (listErr) {
            // Folder may not exist or Storage rules may deny listing — not a fatal error
            Logger.warn(`[Storage] Could not list media for ${conversationId} (folder may not exist or access denied): ${listErr?.message}`);
            listRes = { items: [] };
          }

          if (listRes.items.length > 0) {
            const storageDeletes = listRes.items.map(async (item) => {
              try {
                await deleteObject(item);
              } catch (err) {
                Logger.warn(`[Storage] Failed to delete item ${item.fullPath}: ${err?.message}`);
              }
            });
            await Promise.all(storageDeletes);
            Logger.log(`[Storage] ✅ Deleted ${listRes.items.length} media items.`);
          } else {
            Logger.log(`[Storage] No media items found to delete for ${conversationId}.`);
          }
        } catch (storageError) {
          Logger.warn(`[Storage] Media cleanup skipped due to error: ${storageError?.message}`);
          // Non-fatal — Firestore messages are already deleted
        }
      }
    }

    // 4. Update conversation's last message and metadata
    const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const convSnap = await getDoc(convRef);
    const updates = {
      lastMessage: "",
      lastMessageTime: serverTimestamp(),
      lastMessageId: "",
      lastMessageStatus: "",
      lastMessageSenderId: "",
    };

    // Also clear any versioning or sender-specific flags that might confuse the UI
    if (convSnap.exists()) {
      const data = convSnap.data();
      // Remove versioning flag if it exists
      if (data.lastMessageEncVersion) {
        updates.lastMessageEncVersion = "";
      }
      // Reset unread counts for all participants
      if (data.participantIds) {
        data.participantIds.forEach(uid => {
          updates[`unreadCount_${uid}`] = 0;
        });
      }
    }

    await updateDoc(convRef, updates);
    Logger.log(`[Firestore] ✅ Conversation metadata cleared for ${conversationId.substring(0, 5)}...`);

    return true;
  } catch (error) {
    Logger.error("[Firestore] ❌ Error clearing chat data:", error);
    throw error;
  }
}

/**
 * Hides all current messages for the current user only by setting a clearedAt timestamp.
 */
export async function clearChatForMe(conversationId, userId) {
  try {
    const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const clearedAtField = `clearedAt_${userId}`;

    await updateDoc(convRef, {
      [clearedAtField]: Timestamp.now(),
      [`unreadCount_${userId}`]: 0 // Also reset their unread count
    });

    Logger.log(`[Firestore] ✅ Chat cleared FOR ME (${userId.substring(0, 5)}...) in conv ${conversationId.substring(0, 5)}...`);
    return true;
  } catch (error) {
    Logger.error("[Firestore] Error clearing chat for me:", error);
    throw error;
  }
}

/**
 * Deletes a conversation
 * @param conversationId - ID of conversation to delete
 */
export async function deleteConversation(conversationId) {
  try {
    const ref = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    await deleteDoc(ref);
  } catch (error) {
    Logger.error("Error deleting conversation:", error);
    throw error;
  }
}

/**
 * Updates user presence status
 * @param userId - User UID
 * @param isOnline - Boolean status
 */
export async function updateUserPresence(userId, isOnline, silent = false) {
  if (!userId) return;
  try {
    if (!silent) Logger.log(`[Firestore] Updating presence for ${userId} to ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    const userRef = doc(db, USERS_COLLECTION, userId);
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, userId);
    const data = {
      isOnline,
      lastSeen: Timestamp.now()
    };
    
    await Promise.all([
      setDoc(userRef, data, { merge: true }),
      setDoc(publicRef, data, { merge: true })
    ]);
    
    if (!silent) Logger.log(`[Firestore] ✅ Presence mirrored (private & public) for ${userId.substring(0, 5)}...`);
  } catch (error) {
    if (!silent) {
      Logger.error(`[Firestore] ❌ Error updating presence for ${userId}:`, error);
      Logger.error('[Firestore] Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
    }
    throw error; // Re-throw to see in auth-context
  }
}

/**
 * Subscribes to a specific user's presence/status
 * @param userId - Target User UID
 * @param callback - Function(data) { isOnline, lastSeen }
 */
export function subscribeToUserPresence(userId, callback) {
  if (!userId) return () => { };
  try {
    Logger.log(`[Firestore] Subscribing to presence for ${userId.substring(0, 5)}...`);
    // 🛡️ MOBILE FIX: Use Public collection for presence to avoid 'Permission Denied' on private users doc
    const publicRef = doc(db, PUBLIC_PROFILES_COLLECTION, userId);
    return onSnapshot(publicRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        Logger.log(`[Firestore] Presence update for ${userId.substring(0, 5)}...: ${data.isOnline}`);
        callback({ isOnline: data.isOnline, lastSeen: data.lastSeen });
      } else {
        // Fallback to private if possible (for same-user or if rules allow)
        const userRef = doc(db, USERS_COLLECTION, userId);
        getDoc(userRef).then(snap => {
           if (snap.exists()) callback({ isOnline: snap.data().isOnline, lastSeen: snap.data().lastSeen });
           else callback(null);
        }).catch(() => callback(null));
      }
    }, (error) => {
      if (error?.code === "permission-denied") {
        // Log this specifically to track if public collection is also restricted
        Logger.warn(`[Firestore] subscribeToUserPresence: permission-denied for PUBLIC doc ${userId.substring(0, 5)}...`);
        return;
      }
      Logger.error("Error in presence listener:", error);
    });
  } catch (error) {
    Logger.error("Error subscribing to presence:", error);
    return () => { };
  }
}

/**
 * Marks a message as read
 */
export async function markMessageAsRead(conversationId, messageId) {
  try {
    const msgRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
    const msgSnap = await getDoc(msgRef);
    if (msgSnap.exists()) {
      const data = msgSnap.data();
      const updates = { status: 'read' };

      // Ephemeral Logic: If message has a read-timer, set expiresAt NOW
      if (data.ephemeralDuration && data.ephemeralDuration > 0 && !data.expiresAt) {
        const now = Timestamp.now();
        updates.expiresAt = new Timestamp(now.seconds + data.ephemeralDuration, now.nanoseconds);
      }

      await setDoc(msgRef, updates, { merge: true });
      Logger.log(`[Firestore] ✅ Message ${messageId.substring(0, 5)}... marked as read`);

      // Update conversation if this is the last message
      const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists() && convSnap.data().lastMessageId === messageId) {
        await setDoc(convRef, { lastMessageStatus: 'read' }, { merge: true });
      }
    }
  } catch (error) {
    Logger.error("Error marking message as read:", error);
  }
}

/**
 * Marks all 'sent' messages in a conversation as 'delivered'
 * This is called when the recipient's app receives the message update (even in background/list view)
 */
export async function markMessagesAsDelivered(conversationId, recipientUserId) {
  try {
    const messagesRef = collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION);

    // Query for messages stuck in 'sent' that were NOT sent by me (the recipient)
    const q = query(messagesRef, where("status", "==", "sent"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return;

    const updates = [];

    querySnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.senderId !== recipientUserId) {
        // It's an incoming message for me
        updates.push(setDoc(docSnap.ref, { status: 'delivered' }, { merge: true }));
      }
    });

    if (updates.length > 0) {
      await Promise.all(updates);

      // Update conversation lastMessageStatus if needed
      const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const convData = convSnap.data();
        if (convData.lastMessageStatus === 'sent' && convData.lastMessageSenderId !== recipientUserId) {
          await setDoc(convRef, { lastMessageStatus: 'delivered' }, { merge: true });
        }
      }
    }

  } catch (error) {
    Logger.error("Error marking messages as delivered:", error);
  }
}

/**
 * Toggles a reaction (emoji) on a message
 */
export async function toggleMessageReaction(conversationId, messageId, userId, emoji) {
  try {
    const msgRef = doc(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_SUBCOLLECTION, messageId);
    const msgSnap = await getDoc(msgRef);
    if (!msgSnap.exists()) return;

    const data = msgSnap.data();
    const reactions = data.reactions || {};

    // Toggle user in the specific emoji array
    if (reactions[emoji] && reactions[emoji].includes(userId)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      if (!reactions[emoji]) reactions[emoji] = [];
      reactions[emoji].push(userId);
    }

    await setDoc(msgRef, { reactions }, { merge: true });
  } catch (error) {
    Logger.error("Error toggling reaction:", error);
  }
}

/**
 * Sends a connection request to another user
 */
export async function sendConnectionRequest(senderUid, receiverUid, senderInfo, receiverInfo = null) {
  if (!senderUid || !receiverUid) throw new Error("Missing UIDs");

  try {
    // 1. Check if they are already connected
    const q = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", senderUid)
    );
    const snap = await getDocs(q);
    const existing = snap.docs.find(d => d.data().participantIds.includes(receiverUid));

    if (existing) {
      return { status: 'already_connected', conversationId: existing.id };
    }

    // 2. Check if a request already exists in either direction
    const qOut = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", senderUid),
      where("receiverId", "==", receiverUid),
      where("status", "==", "pending")
    );
    const snapOut = await getDocs(qOut);
    if (!snapOut.empty) return { status: 'request_sent_already' };

    const qIn = query(
      collection(db, "connectionRequests"),
      where("senderId", "==", receiverUid),
      where("receiverId", "==", senderUid),
      where("status", "==", "pending")
    );
    const snapIn = await getDocs(qIn);
    if (!snapIn.empty) {
      // Auto-accept reciprocal request
      const requestId = snapIn.docs[0].id;
      await respondToConnectionRequest(requestId, 'accepted', receiverUid, senderUid);
      return { status: 'success', autoAccepted: true };
    }

    // 3. Create new request
    await addDoc(collection(db, "connectionRequests"), {
      senderId: senderUid,
      receiverId: receiverUid,
      senderInfo,
      receiverInfo, 
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return { status: 'success' };
  } catch (error) {
    Logger.error("Error sending connection request:", error);
    throw error;
  }
}

/**
 * Subscribes to the full user profile (including ID, PIN, Bio)
 * @param userId - Target User UID
 * @param callback - Function(data)
 */
export function subscribeToUserProfile(userId, callback) {
  if (!userId) return () => { };
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.userId) data.userId = IdentitySecurityService.decryptFromCloud(data.userId, userId);
        Logger.log(`[Firestore] 🔔 Profile update for ${userId.substring(0, 5)}... ID: ${data.userId}`);
        callback(data);
      } else {
        Logger.warn(`[Firestore] 🔔 Profile listener: Doc NOT FOUND for ${userId.substring(0, 5)}...`);
        callback(null);
      }
    }, (error) => {
      if (error?.code === "permission-denied") {
        Logger.warn(`[Firestore] subscribeToUserProfile: permission-denied for ${userId.substring(0, 5)}... (transient auth lag)`);
        return;
      }
      Logger.error("Error in profile listener:", error);
    });
  } catch (error) {
    console.error("Error setting up profile subscription:", error);
    return () => { };
  }
}

/**
 * Subscribes to incoming connection requests for a user
 */
export function subscribeToIncomingRequests(receiverUid, callback) {
  try {
    const q = query(
      collection(db, "connectionRequests"),
      where("receiverId", "==", receiverUid),
      where("status", "==", "pending")
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      Logger.log(`[Firestore] Received ${requests.length} pending requests for ${receiverUid}`);
      callback(requests);
    }, (error) => {
      if (error?.code === "permission-denied") {
        Logger.warn(`[Firestore] subscribeToIncomingRequests: permission-denied for ${receiverUid.substring(0, 5)}... (auth lag)`);
        return;
      }
      Logger.error("[Firestore] error in subscribeToIncomingRequests:", error);
    });
  } catch (error) {
    Logger.error("Error subscribing to requests:", error);
    return () => { };
  }
}

/**
 * Responds to a connection request (Accept/Decline)
 */
export async function respondToConnectionRequest(requestId, status, senderId, receiverId) {
  try {
    const requestRef = doc(db, "connectionRequests", requestId);

    if (status === 'accepted') {
      // Create conversation atomically if accepted
      await createConversation(senderId, receiverId);
    }

    // Update request status
    await setDoc(requestRef, { status, respondedAt: serverTimestamp() }, { merge: true });
    return true;
  } catch (error) {
    Logger.error("Error responding to connection request:", error);
    throw error;
  }
}


/**
 * Resets the unread count for a specific user in a conversation
 * @param conversationId - Conversation ID
 * @param userId - User ID to reset count for
 */
export async function resetUnreadCount(conversationId, userId) {
  if (!conversationId || !userId) return;
  try {
    const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    const updateField = `unreadCount_${userId}`;
    await updateDoc(conversationRef, {
      [updateField]: 0
    });
    Logger.log(`[Firestore] ✅ Unread count reset for user ${userId.substring(0, 5)}... in conv ${conversationId.substring(0, 5)}...`);
  } catch (error) {
    // Ignore if document doesn't exist or field is missing
    Logger.warn(`[Firestore] Failed to reset unread count: ${error.message}`);
  }
}

/**
 * Saves an encrypted account-level key backup (Identity/DH/PQC keys)
 * @param uid - User UID
 * @param backupData - Object containing encrypted key blobs
 */
export async function saveAccountKeyBackup(uid, backupData) {
  try {
    const backupRef = doc(db, USERS_COLLECTION, uid, "keyBackups", "account_identity");
    await setDoc(backupRef, {
      ...backupData,
      updatedAt: serverTimestamp()
    });
    Logger.log(`[Firestore] ✅ Account key backup saved for ${uid.substring(0, 5)}...`);
  } catch (error) {
    Logger.error("Error saving account key backup:", error);
    throw error;
  }
}

/**
 * Fetches the user's encrypted account-level key backup
 * @param uid - User UID
 * @returns Backup data or null
 */
export async function fetchAccountKeyBackup(uid) {
  let attempt = 0;
  const maxRetries = 2;

  while (attempt < maxRetries) {
    try {
      const backupRef = doc(db, USERS_COLLECTION, uid, "keyBackups", "account_identity");
      const snap = await getDoc(backupRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (error) {
      if (error.code === 'permission-denied' && attempt < maxRetries - 1) {
        attempt++;
        Logger.warn(`[Firestore] fetchAccountKeyBackup: permission-denied (attempt ${attempt}/${maxRetries}). Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }
      Logger.error("Error fetching account key backup:", error);
      return null;
    }
  }
}

/**
 * Updates the stealth mode of a conversation (persistence bypass)
 */
export async function updateConversationStealthMode(conversationId, isStealth) {
  try {
    const convRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
    await updateDoc(convRef, { isStealth });
    Logger.log(`[Firestore] ✅ Stealth Mode updated to ${isStealth} for conv: ${conversationId.substring(0, 5)}...`);
  } catch (error) {
    Logger.error("Error updating stealth mode:", error);
    throw error;
  }
}

export { db, auth, storage };

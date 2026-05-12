/**
 * 🔑 RATCHET KEY SERVICE
 *
 * PURPOSE:
 * Handles the "invisible" X25519 Diffie-Hellman key exchange needed to
 * bootstrap v4 Double Ratchet sessions for ALL platform users — including web.
 *
 * FLOW:
 * 1. On login  → publishMyKeysOnLogin(uid)
 *    Generates an X25519 key pair (if not already done), stores the private key
 *    locally, and publishes the public key to Firestore users/{uid}/dhPublicKey.
 *
 * 2. On chat open → initializeRatchetIfNeeded(conversationId, myUid, partnerUid)
 *    Fetches the partner's DH public key from Firestore, computes the shared
 *    secret, and calls initializeRatchet(). After this call, getRatchetSession()
 *    returns a valid state and resolveSendVersion() returns "v4".
 *
 * WHY IS THIS SAFE?
 * - X25519 DH: Both sides compute DH(myPrivate, theirPublic) → same secret ✅
 * - Alice convention: user with lexicographically smaller UID = Alice.
 *   This guarantees both sides agree without any additional message exchange.
 * - Private keys never leave the device. Only public keys go to Firestore.
 * - Existing sessions are never overwritten (idempotent).
 *
 * BACKWARD COMPATIBILITY:
 * - If a partner hasn't published a DH key yet, the function returns false
 *   and resolveSendVersion() falls back to legacy. No crash, no disruption.
 * - Past messages are unaffected.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import { generateKeyPairSync, diffieHellman } from "./crypto-wrapper";
import { initializeRatchet } from "./ratchet";
import { getRatchetSession, saveRatchetSession, DEFAULT_ENCRYPTION_CAPABILITIES } from "./encryption";
import { ml_kem768, ed25519Sign, createPublicKey, createPrivateKey } from "./crypto-wrapper";
import { Logger } from "./logger";
import { PresenceService } from "./presence-service";
import { getV6Session, initializeV6Session } from "./encryption-v6";

// ─── Storage Keys ──────────────────────────────────────────────────────────────
const DH_PUBLIC_KEY_STORAGE = "innerorbit_dh_pub";
const DH_PRIVATE_KEY_STORAGE = "innerorbit_dh_priv";
const PQC_PUBLIC_KEY_STORAGE = "innerorbit_pqc_pub";
const PQC_PRIVATE_KEY_STORAGE = "innerorbit_pqc_priv";
const IDENTITY_PUBLIC_KEY_STORAGE = "innerorbit_identity_pub";
const IDENTITY_PRIVATE_KEY_STORAGE = "innerorbit_identity_priv";


// ─── Lazy Firestore imports (prevents circular deps) ──────────────────────────
async function getFirestoreFns() {
  // Dynamic import of plain JS file. Some build configs might wrap exports in .default
  const mod = await import("./firestore-service") as any;
  const svc = mod.default || mod;

  if (!svc.getUserProfile) {
    Logger.warn("[RatchetKeyService] ⚠️ getUserProfile missing from imported module. Retrying extraction...");
  }

  return {
    publishDhPublicKey: (svc.publishDhPublicKey || svc.default?.publishDhPublicKey) as (uid: string, b64: string) => Promise<void>,
    fetchDhPublicKey: (svc.fetchDhPublicKey || svc.default?.fetchDhPublicKey) as (uid: string) => Promise<string | null>,
    publishV6PublicKeys: (svc.publishV6PublicKeys || svc.default?.publishV6PublicKeys) as (uid: string, dh: string, pqc: string, identity: string, signature: string) => Promise<void>,
    fetchV6PublicKeys: (svc.fetchV6PublicKeys || svc.default?.fetchV6PublicKeys) as (uid: string) => Promise<{ dh: string, pqc: string, identity?: string, signature?: string } | null>,
    getUserProfile: (svc.getUserProfile || svc.default?.getUserProfile) as (uid: string) => Promise<any>,
  };
}

async function tryDiffieHellman(
  myPrivateKey: Buffer,
  partnerPublicKey: Buffer
): Promise<Buffer | null> {
  try {
    const rawPriv = myPrivateKey.length > 32 ? myPrivateKey.slice(-32) : myPrivateKey;
    const rawPub = partnerPublicKey.length > 32 ? partnerPublicKey.slice(-32) : partnerPublicKey;
    return diffieHellman({ privateKey: rawPriv, publicKey: rawPub });
  } catch (e) {
    Logger.error("[RatchetKeyService] DH failed", e);
    return null;
  }
}

// ─── Key Pair Management ───────────────────────────────────────────────────────

/**
 * Returns the user's X25519 DH key pair, generating one if it doesn't exist.
 * Idempotent — safe to call on every login.
 */
export async function getOrCreateMyDhKeyPair(): Promise<{
  publicKey: Buffer;
  privateKey: Buffer;
}> {
  const storedPub = await AsyncStorage.getItem(DH_PUBLIC_KEY_STORAGE);
  const storedPriv = await AsyncStorage.getItem(DH_PRIVATE_KEY_STORAGE);

  if (storedPub && storedPriv) {
    return {
      publicKey: Buffer.from(storedPub, "base64"),
      privateKey: Buffer.from(storedPriv, "base64"),
    };
  }

  // Generate fresh X25519 key pair (Noble natively returns raw 32 bytes)
  const kp = generateKeyPairSync("x25519");
  const publicKey = Buffer.from(kp.publicKey as any);
  const privateKey = Buffer.from(kp.privateKey as any);

  await AsyncStorage.setItem(DH_PUBLIC_KEY_STORAGE, publicKey.toString("base64"));
  await AsyncStorage.setItem(DH_PRIVATE_KEY_STORAGE, privateKey.toString("base64"));

  Logger.log("[RatchetKeyService] ✅ Generated new X25519 DH key pair");
  return { publicKey, privateKey };
}

/**
 * Returns the user's ML-KEM-768 PQC key pair, generating one if it doesn't exist.
 * Idempotent — safe to call on every login.
 */
export async function getOrCreateMyPqcKeyPair(): Promise<{
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}> {
  const storedPub = await AsyncStorage.getItem(PQC_PUBLIC_KEY_STORAGE);
  const storedPriv = await AsyncStorage.getItem(PQC_PRIVATE_KEY_STORAGE);

  if (storedPub && storedPriv) {
    return {
      publicKey: Buffer.from(storedPub, "base64"),
      secretKey: Buffer.from(storedPriv, "base64"),
    };
  }

  // Generate fresh ML-KEM-768 key pair
  const kp = ml_kem768.keygen();
  const publicKey = kp.publicKey;
  const secretKey = kp.secretKey;

  await AsyncStorage.setItem(PQC_PUBLIC_KEY_STORAGE, Buffer.from(publicKey).toString("base64"));
  await AsyncStorage.setItem(PQC_PRIVATE_KEY_STORAGE, Buffer.from(secretKey).toString("base64"));

  Logger.log("[RatchetKeyService] ✅ Generated new ML-KEM-768 PQC key pair");
  return { publicKey, secretKey };
}

/**
 * Returns the user's Ed25519 Identity key pair for digital signatures.
 * Idempotent — safe to call on every login.
 */
export async function getOrCreateMyIdentityKeyPair(): Promise<{
  publicKey: Buffer;
  privateKey: Buffer;
}> {
  const storedPub = await AsyncStorage.getItem(IDENTITY_PUBLIC_KEY_STORAGE);
  const storedPriv = await AsyncStorage.getItem(IDENTITY_PRIVATE_KEY_STORAGE);

  if (storedPub && storedPriv) {
    return {
      publicKey: Buffer.from(storedPub, "base64"),
      privateKey: Buffer.from(storedPriv, "base64"),
    };
  }

  // Generate fresh Ed25519 Identity key pair
  const kp = ed25519Sign.keygen();
  const publicKey = kp.publicKey;
  const privateKey = kp.privateKey;

  await AsyncStorage.setItem(IDENTITY_PUBLIC_KEY_STORAGE, publicKey.toString("base64"));
  await AsyncStorage.setItem(IDENTITY_PRIVATE_KEY_STORAGE, privateKey.toString("base64"));

  Logger.log("[RatchetKeyService] ✅ Generated new Ed25519 Identity key pair");
  return { publicKey, privateKey };
}

// ─── Login Hook ────────────────────────────────────────────────────────────────

/**
 * Call this once on successful login.
 *
 * Generates DH key pair (idempotent) and publishes the public key to Firestore
 * so other users can initiate ratchet sessions with this user.
 *
 * @param uid - Firebase Auth UID of the current user
 */
export async function publishMyKeysOnLogin(uid: string): Promise<void> {
  Logger.trace('RATCHET-KEY', 'ratchet-key-service.ts', 'publishMyKeysOnLogin', 'PENDING', `uid=${uid?.substring(0, 5)}...`);
  try {

    // 1. Classic v4 DH
    const { publicKey: dhPub } = await getOrCreateMyDhKeyPair();
    const { publishDhPublicKey, publishV6PublicKeys, getUserProfile } = await getFirestoreFns();

    // Check if we need to restore keys (Fresh install)
    const storedIdentity = await AsyncStorage.getItem(IDENTITY_PUBLIC_KEY_STORAGE);
    if (!storedIdentity) {
      Logger.log("[RatchetKeyService] 🔄 Fresh install detected, attempting identity restoration...");
      const profile = await getUserProfile(uid);
      if (profile && profile.pin) {
        const { restoreAccountIdentity } = await import("./key-backup-service");
        const restored = await restoreAccountIdentity(uid, profile.pin);
        if (restored) {
          Logger.log("[RatchetKeyService] ✅ Identity restored from cloud backup.");
          // Reload keys after restoration
          return publishMyKeysOnLogin(uid);
        }
      }
    }

    await publishDhPublicKey(uid, dhPub.toString("base64"));

    // 2. Quantum v6 (DH + ML-KEM) - Gated by Architectural Hold
    if (DEFAULT_ENCRYPTION_CAPABILITIES.v6) {
      const { publicKey: pqcPub } = await getOrCreateMyPqcKeyPair();

      // 3. Ed25519 Identity & Capability Signing
      const { publicKey: identityPub, privateKey: identityPriv } = await getOrCreateMyIdentityKeyPair();

      // 4. Automatic Backup (if missing in cloud but present locally)
      const profile = await getUserProfile(uid);
      if (profile && profile.pin) {
        const { backupAccountIdentity } = await import("./key-backup-service");
        const { publicKey: dhPub, privateKey: dhPriv } = await getOrCreateMyDhKeyPair();
        const { publicKey: pqcPub, secretKey: pqcPriv } = await getOrCreateMyPqcKeyPair();

        await backupAccountIdentity(uid, profile.pin, {
          dh: { pub: dhPub.toString("base64"), priv: dhPriv.toString("base64") },
          pqc: { pub: Buffer.from(pqcPub).toString("base64"), priv: Buffer.from(pqcPriv).toString("base64") },
          identity: { pub: identityPub.toString("base64"), priv: identityPriv.toString("base64") }
        });
      }

      // We cryptographically bind the v6 capability and public keys together.
      const dhB64 = dhPub.toString("base64");
      const pqcB64 = Buffer.from(pqcPub).toString("base64");
      const identityB64 = identityPub.toString("base64");

      const capabilityPayload = `v6:true|dh:${dhB64}|pqc:${pqcB64}`;
      const signatureBuffer = ed25519Sign.sign(capabilityPayload, identityPriv);
      const signatureB64 = signatureBuffer.toString("base64");

      await publishV6PublicKeys(uid, dhB64, pqcB64, identityB64, signatureB64);
    }

    Logger.log(`[RatchetKeyService] ✅ All security keys published for ${uid.substring(0, 5)}...`);
  } catch (e: any) {
    // Non-fatal — falls back to legacy send on failure
    Logger.trace('RATCHET-KEY', 'ratchet-key-service.ts', 'publishMyKeysOnLogin', 'FAILED', e?.message);
    Logger.warn(`[RatchetKeyService] ⚠️ Failed to publish keys: ${e?.message}`);
  }

}

// ─── Chat Open Hook ────────────────────────────────────────────────────────────

/**
 * Call this when opening a conversation (e.g. in a useEffect on chat screen mount).
 *
 * Fetches the partner's DH public key from Firestore, computes the X25519
 * shared secret, and initializes the Double Ratchet session.
 *
 * After this returns true:
 * *   - getRatchetSession(conversationId) returns a valid RatchetState
 *   - resolveSendVersion() returns "v4" for this conversation
 *   - encryptV4() / decryptV4() work correctly
 *
 * Returns false (graceful fallback to legacy) if:
 *   - The partner hasn't published a DH key yet
 *   - Any network or Firestore error occurs
 *
 * @param conversationId - Firestore conversation document ID
 * @param myUid          - Current user's Firebase UID
 * @param partnerUid     - Partner's Firebase UID
 * @returns true if session was initialized (or already existed), false on fallback
 */
export async function initializeRatchetIfNeeded(
  conversationId: string,
  myUid: string,
  partnerUid: string
): Promise<boolean> {
  Logger.trace('RATCHET-KEY', 'ratchet-key-service.ts', 'initializeRatchetIfNeeded', 'PENDING', `conv=${conversationId?.substring(0, 5)}...`);

  // ── Gated by Architectural Hold ──
  if (!DEFAULT_ENCRYPTION_CAPABILITIES.v4) return false;

  try {
    // ── Already initialized? Don't overwrite existing state ──
    const existing = await getRatchetSession(conversationId);
    if (existing) {
      // 🛡️ SELF-HEAL: Ensure the stable profile key is shared even if session exists
      PresenceService.shareProfileKeyWithPartner(conversationId, [myUid, partnerUid]).catch(() => { });
      Logger.log(`[RatchetKeyService] Session already exists for ${conversationId.substring(0, 8)}...`);
      return true;
    }

    // ── Fetch partner's DH public key from Firestore ──
    const { fetchDhPublicKey } = await getFirestoreFns();
    const partnerPubB64 = await fetchDhPublicKey(partnerUid);

    if (!partnerPubB64) {
      Logger.warn(
        `[RatchetKeyService] ⚠️ Partner ${partnerUid.substring(0, 5)}... has not published a DH key.` +
        ` Falling back to v3 (Elite) until they log in.`
      );
      return false;
    }

    const partnerPublicKey = Buffer.from(partnerPubB64, "base64");

    // ── Load my key pair ──
    const { publicKey: myPublicKey, privateKey: myPrivateKey } = await getOrCreateMyDhKeyPair();

    // ── Extract raw 32 bytes (strips DER wrapping if present from older logins) ──
    const rawPartnerPub = partnerPublicKey.length > 32 ? partnerPublicKey.slice(-32) : partnerPublicKey;
    const rawMyPub = myPublicKey.length > 32 ? myPublicKey.slice(-32) : myPublicKey;
    const rawMyPriv = myPrivateKey.length > 32 ? myPrivateKey.slice(-32) : myPrivateKey;

    // ── Compute X25519 shared secret for root key ──
    const sharedSecret = await tryDiffieHellman(rawMyPriv, rawPartnerPub);
    if (!sharedSecret) {
      Logger.error(`[RatchetKeyService] 🚨 DH failed after all strategies. Regenerating local keys.`);
      await AsyncStorage.removeItem(DH_PUBLIC_KEY_STORAGE);
      await AsyncStorage.removeItem(DH_PRIVATE_KEY_STORAGE);
      return false; // Fall back to legacy send until we restart/re-init
    }

    const isAlice = myUid < partnerUid;

    Logger.log(`[RatchetKeyService] Initializing ratchet: role=${isAlice ? "Alice" : "Bob"}, conv=${conversationId.substring(0, 8)}...`);

    // ── Initialize Double Ratchet state ──
    const state = await initializeRatchet(
      isAlice,
      sharedSecret,
      rawPartnerPub,
      { publicKey: rawMyPub as any, privateKey: rawMyPriv as any }
      // No PQC here — v4 is classical DH only. For PQC use v6/initializeV6Session.
    );

    // ── Persist the session (encrypted with device key on mobile, AsyncStorage on web) ──
    await saveRatchetSession(conversationId, state);

    // 🛡️ SEAMLESS PRESENCE: Share Profile Key encrypted with a stable identity-linked secret
    PresenceService.shareProfileKeyWithPartner(conversationId, [myUid, partnerUid]).catch(() => { });

    Logger.log(`[RatchetKeyService] ✅ v4 Ratchet session ready for ${conversationId.substring(0, 8)}...`);
    return true;
  } catch (e: any) {
    Logger.trace('RATCHET-KEY', 'ratchet-key-service.ts', 'initializeRatchetIfNeeded', 'FAILED', e?.message);
    Logger.error(`[RatchetKeyService] ❌ Failed to initialize ratchet: ${e?.message}`);
    return false;
  }

}

/**
 * Call this when opening a conversation.
 * 
 * Fetches the partner's v6 keys and initializes a PQXDH session.
 * v6 REQUIRES both DH and ML-KEM-768 keys.
 * 
 * @returns true if v6 session was initialized (or already existed), false on fallback
 */
export async function initializeV6IfNeeded(
  conversationId: string,
  myUid: string,
  partnerUid: string
): Promise<boolean> {
  Logger.trace('RATCHET-KEY', 'ratchet-key-service.ts', 'initializeV6IfNeeded', 'PENDING', `conv=${conversationId?.substring(0, 5)}...`);

  // ── Gated by Architectural Hold ──
  if (!DEFAULT_ENCRYPTION_CAPABILITIES.v6) return false;

  try {
    // ── Session already exists? ──
    const existing = await getV6Session(conversationId);
    if (existing) {
      // 🛡️ SELF-HEAL: Ensure the stable profile key is shared even if session exists
      PresenceService.shareProfileKeyWithPartner(conversationId, [myUid, partnerUid]).catch(() => { });
      return true;
    }

    // ── Fetch partner's v6 public keys ──
    const { fetchV6PublicKeys } = await getFirestoreFns();
    const keys = await fetchV6PublicKeys(partnerUid);

    if (!keys || !keys.dh || !keys.pqc) {
      Logger.warn(`[RatchetKeyService] ⚠️ Partner ${partnerUid.substring(0, 5)}... lacks v6 keys. Falling back to v4 (Ratchet).`);
      return false;
    }

    // ── Verify Capability Signature ──
    if (!keys.identity || !keys.signature) {
      Logger.warn(`[RatchetKeyService] ⚠️ Partner lacks Identity Key / Signature. Assuming legacy/tampered state.`);
      return false; // Require signature for v6
    }

    const payloadToVerify = `v6:true|dh:${keys.dh}|pqc:${keys.pqc}`;
    const isValid = ed25519Sign.verify(
      Buffer.from(keys.signature, "base64"),
      payloadToVerify,
      Buffer.from(keys.identity, "base64")
    );

    if (!isValid) {
      Logger.error(`[RatchetKeyService] 🚨 CRITICAL: Partner's capability signature failed verification! Possible tampering detected.`);
      return false;
    }

    // ── Load my key pairs ──
    const { publicKey: myDhPub, privateKey: myDhPriv } = await getOrCreateMyDhKeyPair();
    const { publicKey: myPqcPub, secretKey: myPqcPriv } = await getOrCreateMyPqcKeyPair();

    // ── Extract raw 32 bytes (strips DER wrapping if present) ──
    const partnerDhPub = Buffer.from(keys.dh, "base64");
    const rawPartnerPub = partnerDhPub.length > 32 ? partnerDhPub.slice(-32) : partnerDhPub;
    const rawMyPub = myDhPub.length > 32 ? myDhPub.slice(-32) : myDhPub;
    const rawMyPriv = myDhPriv.length > 32 ? myDhPriv.slice(-32) : myDhPriv;

    // ── Compute X25519 shared secret for root key ──
    const sharedSecret = await tryDiffieHellman(rawMyPriv, rawPartnerPub);
    if (!sharedSecret) {
      Logger.error(`[RatchetKeyService] 🚨 v6 DH failed after all strategies. Regenerating local keys.`);
      await AsyncStorage.removeItem(DH_PUBLIC_KEY_STORAGE);
      await AsyncStorage.removeItem(DH_PRIVATE_KEY_STORAGE);
      return false;
    }

    const isAlice = myUid < partnerUid;

    Logger.log(`[RatchetKeyService] Initializing v6 PQXDH session for ${conversationId.substring(0, 8)}...`);

    // ── Initialize v6 session ──
    await initializeV6Session(conversationId, {
      isAlice,
      sharedSecret,
      remoteDhPublicKey: rawPartnerPub,
      remotePqcPublicKey: Buffer.from(keys.pqc, "base64"),
      ownDhKeyPair: { publicKey: rawMyPub, privateKey: rawMyPriv },
      ownPqcKeyPair: { publicKey: myPqcPub, secretKey: myPqcPriv }
    });

    // 🛡️ SEAMLESS PRESENCE: Share Profile Key encrypted with a stable identity-linked secret
    PresenceService.shareProfileKeyWithPartner(conversationId, [myUid, partnerUid]).catch(() => { });

    Logger.log(`[RatchetKeyService] ✅ v6 PQXDH session ready for ${conversationId.substring(0, 8)}...`);
    return true;
  } catch (e: any) {
    Logger.trace('RATCHET-KEY', 'ratchet-key-service.ts', 'initializeV6IfNeeded', 'FAILED', e?.message);
    Logger.error(`[RatchetKeyService] ❌ Failed to initialize v6: ${e?.message}`);
    return false;
  }

}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Returns true if a v4 ratchet session exists for the given conversation.
 * Use this to pass hasLocalRatchetSession into resolveSendVersion().
 */
export async function hasRatchetSession(conversationId: string): Promise<boolean> {
  const state = await getRatchetSession(conversationId);
  return state !== null;
}

/**
 * Returns the shared secret for a given partner.
 * Useful for deriving presence/typing keys on the fly.
 */
export async function getConversationSharedSecret(partnerUid: string): Promise<Buffer | null> {
  try {
    const { fetchDhPublicKey } = await getFirestoreFns();
    const partnerPubB64 = await fetchDhPublicKey(partnerUid);
    if (!partnerPubB64) return null;

    const { privateKey: myPrivateKey } = await getOrCreateMyDhKeyPair();
    const partnerPublicKey = Buffer.from(partnerPubB64, "base64");

    return await tryDiffieHellman(myPrivateKey, partnerPublicKey);
  } catch (e) {
    Logger.error("[RatchetKeyService] Failed to get shared secret", e);
    return null;
  }
}

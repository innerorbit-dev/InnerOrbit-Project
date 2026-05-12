import * as fb from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from "firebase/storage";
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, Firestore } from "firebase/firestore";

const db = fb.db as unknown as Firestore;
const storage = fb.storage as unknown as FirebaseStorage;
import { encrypt, decrypt, ENC_VERSION_SIV, encryptSivBinary, decryptSivBinary } from "./encryption";
import { encryptAegis256, decryptAegis256, generateAegisNonce } from "./aegis-wrapper";
import { ml_kem768, randomBytes } from "./crypto-wrapper";
import { Logger } from "./logger";
import { Buffer } from "buffer";

/**
 * 🎞️ MEDIA VAULT SERVICE (Phase 7)
 * 
 * DESIGN:
 * 3-Layer Cryptographic Pipeline for Zero-Knowledge Media Storage.
 * 
 * 1. Layer 1 (AES-256-SIV): Deterministic inner safe for data integrity.
 * 2. Layer 2 (AEGIS-256): High-performance outer wrapper for 4K throughput.
 * 3. Layer 3 (ML-KEM-768): Post-quantum key encapsulation for the Media Master Key (MMK).
 */

export interface MediaVaultMetadata {
    id: string;
    ownerUid: string;
    conversationId: string;
    mimeType: string;
    fileName: string;
    size: number;
    pqcCiphertext: string; // Shared Secret ciphertext from ML-KEM-768
    wrappedMmk: string;    // MMK encrypted by PQC shared secret (Base64)
    aegisNonce: string;    // Nonce for AEGIS-256 (Base64)
    sivIv: string;         // IV for Layer 1 AES-SIV (Base64)
    sivTag: string;        // Auth Tag for Layer 1 AES-SIV (Base64)
    timestamp: any;
}

export class MediaVaultService {
    
    /**
     * Encrypts and uploads a file to the vault.
     */
    static async uploadMedia(
        uri: string,
        conversationId: string,
        ownerUid: string,
        recipientPqcPublicKey: Uint8Array,
        mimeType: string = 'image/jpeg'
    ): Promise<string> {
        try {
            Logger.log("[MediaVault] 🚀 Starting 3-layer encryption pipeline...");

            // 1. Fetch file as blob/arraybuffer
            const response = await fetch(uri);
            const arrayBuffer = await response.arrayBuffer();
            const rawData = new Uint8Array(arrayBuffer);

            // 1.1 Check File Size Limit (100MB)
            const MAX_SIZE_BYTES = 100 * 1024 * 1024;
            if (rawData.length > MAX_SIZE_BYTES) {
                Logger.error(`[MediaVault] ❌ File too large: ${(rawData.length / (1024 * 1024)).toFixed(2)}MB. Max limit is 100MB.`);
                throw new Error("FILE_TOO_LARGE");
            }

            // 1.2 Check MIME Type (Images & Documents only)
            const isImage = mimeType.startsWith('image/');
            const isDoc = mimeType.startsWith('application/pdf') || 
                          mimeType.startsWith('text/') ||
                          mimeType.includes('officedocument') ||
                          mimeType.includes('msword');

            if (!isImage && !isDoc) {
                Logger.error(`[MediaVault] ❌ Unsupported file type: ${mimeType}`);
                throw new Error("UNSUPPORTED_FILE_TYPE");
            }

            // 2. Generate Media Master Key (MMK) - 32 bytes
            const mmk = crypto.getRandomValues(new Uint8Array(32));

            // 3. Layer 1: AES-256-SIV (Inner Safe)
            // We use the MMK as the 'secretKey' for this layer.
            const mmkBuffer = Buffer.from(mmk);
            const { ciphertext: layer1Data, iv: sivIv, tag: sivTag } = await encryptSivBinary(rawData, mmkBuffer);

            // 4. Layer 2: AEGIS-256 (Outer Wrapper)
            const aegisNonce = await generateAegisNonce();
            const finalCiphertext = await encryptAegis256(layer1Data, mmk, aegisNonce);

            // 5. Layer 3: ML-KEM-768 (Quantum Layer)
            // Encapsulate the MMK for the recipient
            const { cipherText: pqcCt, sharedSecret } = ml_kem768.encapsulate(recipientPqcPublicKey);
            
            // Key Wrap the MMK using the shared secret
            const mmkWrapperKey = Buffer.from(sharedSecret).toString('hex');
            const wrappedMmk = encrypt(Buffer.from(mmk).toString('base64'), mmkWrapperKey, undefined, ENC_VERSION_SIV);

            // 6. Upload Encrypted Blob to Firebase Storage
            // 🛡️ SECURITY HARDENED: Use randomBytes for fileId entropy instead of Math.random()
            const entropy = randomBytes(4).toString('hex');
            const fileId = `${Date.now()}_${entropy}`;
            const storagePath = `vault/${conversationId}/${fileId}.bin`;
            if (!storage) throw new Error("FIREBASE_STORAGE_UNAVAILABLE");
            const storageRef = ref(storage as FirebaseStorage, storagePath);
            
            await uploadBytes(storageRef, finalCiphertext);
            Logger.log("[MediaVault] ✅ Binary encrypted blob uploaded to Storage.");

            // 7. Store Metadata in Firestore
            if (!db) throw new Error("FIRESTORE_UNAVAILABLE");
            const metadata: Omit<MediaVaultMetadata, 'id'> = {
                ownerUid,
                conversationId,
                mimeType,
                fileName: uri.split('/').pop() || 'media.bin',
                size: rawData.length,
                pqcCiphertext: Buffer.from(pqcCt).toString('base64'),
                wrappedMmk,
                aegisNonce: Buffer.from(aegisNonce).toString('base64'),
                sivIv: Buffer.from(sivIv).toString('base64'),
                sivTag: Buffer.from(sivTag).toString('base64'),
                timestamp: serverTimestamp()
            };

            const docRef = await addDoc(collection(db as Firestore, "media_vault"), metadata);
            Logger.log(`[MediaVault] 🔒 Vault entry created: ${docRef.id}`);

            return docRef.id;
        } catch (error) {
            Logger.error("[MediaVault] ❌ Upload failed:", error);
            throw error;
        }
    }

    /**
     * Downloads and decrypts media from the vault.
     */
    static async downloadMedia(
        vaultId: string,
        recipientPqcSecretKey: Uint8Array
    ): Promise<string> {
        try {
            Logger.log(`[MediaVault] 🔓 Unlocking vault entry: ${vaultId}...`);

            // 1. Fetch Metadata
            if (!db) throw new Error("FIRESTORE_UNAVAILABLE");
            const docRef = doc(db as Firestore, "media_vault", vaultId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) throw new Error("VAULT_ENTRY_NOT_FOUND");
            
            const metadata = snap.data() as MediaVaultMetadata;

            // 2. Layer 3 Decryption (ML-KEM-768)
            const pqcCt = Buffer.from(metadata.pqcCiphertext, 'base64');
            const sharedSecret = ml_kem768.decapsulate(pqcCt, recipientPqcSecretKey);
            
            // Unwrap the MMK
            const mmkWrapperKey = Buffer.from(sharedSecret).toString('hex');
            const unwrappedMmkB64 = decrypt(metadata.wrappedMmk, mmkWrapperKey);
            const mmk = Buffer.from(unwrappedMmkB64, 'base64');

            // 3. Download Encrypted Blob
            if (!storage) throw new Error("FIREBASE_STORAGE_UNAVAILABLE");
            
            const fileRef = ref(storage as FirebaseStorage, `vault/${metadata.conversationId}/${snap.id}.bin`);
            const downloadUrl = await getDownloadURL(fileRef);
            const response = await fetch(downloadUrl);
            const encryptedBytes = new Uint8Array(await response.arrayBuffer());

            // 4. Layer 2 Decryption (AEGIS-256)
            const aegisNonce = Buffer.from(metadata.aegisNonce, 'base64');
            const layer1Bytes = await decryptAegis256(encryptedBytes, mmk, aegisNonce);

            // 5. Layer 1 Decryption (AES-256-SIV)
            const sivIv = Buffer.from(metadata.sivIv, 'base64');
            const sivTag = Buffer.from(metadata.sivTag, 'base64');
            const rawData = await decryptSivBinary(layer1Bytes, Buffer.from(mmk), sivIv, sivTag);

            // 6. Return as Object URL
            const blob = new Blob([rawData as any], { type: metadata.mimeType });
            return URL.createObjectURL(blob);
        } catch (error) {
            Logger.error("[MediaVault] ❌ Decryption failed:", error);
            throw error;
        }
    }
}

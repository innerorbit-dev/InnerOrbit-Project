import * as fb from "./firebase";
import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from "firebase/storage";
import { doc, getDoc, updateDoc, Firestore } from "firebase/firestore";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system";
import { Buffer } from "buffer";
import { 
    encryptSivBinary, 
    decryptSivBinary, 
    ENC_VERSION_QUANTUM_CHACHA,
} from "./encryption";
import { ml_kem768, createHash } from "./crypto-wrapper";
import { Logger } from "./logger";
import { IdentitySecurityService } from "./identity-security-service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const db = fb.db as unknown as Firestore;
const storage = fb.storage as unknown as FirebaseStorage;

const PROFILE_CACHE_PREFIX = "avatar_cache_v3.5_";
const AVATAR_SIZE = 512;
const COMPRESSION_QUALITY = 0.85;

export interface ProfilePhotoMetadata {
    iv: string;
    tag: string;
    pqcCt: string;
    version: string;
}

export class ProfilePictureService {

    /**
     * Pipeline: Pick -> Compress -> Encrypt -> Upload -> Store Metadata
     */
    static async uploadSecureProfilePicture(
        uid: string,
        uri: string,
        pqcPublicKey: Uint8Array,
        profileKey: string
    ): Promise<ProfilePhotoMetadata> {
        try {
            Logger.log("[ProfilePic] 🚀 Starting secure upload pipeline...");

            // 1. Compress Image (512x512, 0.85 quality)
            const manipulated = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
                { compress: COMPRESSION_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
            );

            // 2. Read file as binary
            const base64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: 'base64' });
            const rawData = new Uint8Array(Buffer.from(base64, "base64"));

            // 3. Encrypt for Cloud (v5.5 Hybrid)
            // We use a deterministic Master Key for the sync layer
            const masterKey = createHash("sha256").update(`profile-vault-${uid}`).digest();
            
            // Hybrid Encapsulation (ML-KEM-768)
            const { cipherText: pqcCt, sharedSecret } = ml_kem768.encapsulate(pqcPublicKey);
            const hybridKey = createHash("sha256").update(Buffer.concat([masterKey, Buffer.from(sharedSecret)])).digest();
            
            // Binary Encryption (AES-GCM-SIV v3.5 baseline inside v5.5 container)
            const { ciphertext, iv, tag } = await encryptSivBinary(rawData, hybridKey as any);

            // 4. Upload to Firebase Storage
            if (!storage) throw new Error("STORAGE_UNAVAILABLE");
            const storagePath = `profiles/${uid}/avatar.enc`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, ciphertext);
            Logger.log("[ProfilePic] ✅ Encrypted blob uploaded to cloud.");

            // 5. Cache locally (v3.5 SIV)
            await this.cacheLocalAvatar(uid, rawData, profileKey);

            // 6. Return metadata for Firestore
            return {
                iv: Buffer.from(iv).toString("base64"),
                tag: Buffer.from(tag).toString("base64"),
                pqcCt: Buffer.from(pqcCt).toString("base64"),
                version: ENC_VERSION_QUANTUM_CHACHA
            };

        } catch (error) {
            Logger.error("[ProfilePic] ❌ Secure upload failed:", error);
            throw error;
        }
    }

    /**
     * Pipeline: Fetch Metadata -> Download -> Decrypt -> Cache -> Return URI
     */
    static async getSecureProfilePicture(
        uid: string,
        metadata: ProfilePhotoMetadata,
        pqcSecretKey: Uint8Array | null,
        profileKey: string,
        forceRefresh = false
    ): Promise<string | null> {
        try {
            // 1. Check Local Cache First (v3.5)
            if (!forceRefresh) {
                const cached = await this.getFromLocalCache(uid, profileKey);
                if (cached) return cached;
            }

            // If no local cache and no secret key, we can't decrypt from cloud
            if (!pqcSecretKey) return null;

            Logger.log(`[ProfilePic] 🔓 Decrypting secure avatar from cloud for ${uid}...`);

            // 2. Download Blob
            const storagePath = `profiles/${uid}/avatar.enc`;
            const storageRef = ref(storage, storagePath);
            const downloadUrl = await getDownloadURL(storageRef);
            const response = await fetch(downloadUrl);
            const encryptedBytes = new Uint8Array(await response.arrayBuffer());

            // 3. Decrypt (v5.5 Hybrid)
            const masterKey = createHash("sha256").update(`profile-vault-${uid}`).digest();
            const pqcCt = Buffer.from(metadata.pqcCt, "base64");
            const sharedSecret = ml_kem768.decapsulate(pqcCt, pqcSecretKey);
            const hybridKey = createHash("sha256").update(Buffer.concat([masterKey, Buffer.from(sharedSecret)])).digest();

            const iv = Buffer.from(metadata.iv, "base64");
            const tag = Buffer.from(metadata.tag, "base64");
            const rawData = await decryptSivBinary(encryptedBytes, hybridKey as unknown as Buffer, iv, tag);

            // 4. Cache and Return
            await this.cacheLocalAvatar(uid, rawData, profileKey);
            return this.binaryToUri(rawData);

        } catch (error) {
            Logger.warn("[ProfilePic] ⚠️ Secure fetch failed:", error);
            return null;
        }
    }

    /**
     * 🛡️ Local Caching with v3.5 (AES-GCM-SIV)
     */
    private static async cacheLocalAvatar(uid: string, data: Uint8Array, profileKey: string): Promise<void> {
        try {
            if (!profileKey) return;

            const keyBuffer = Buffer.from(profileKey, "hex");
            const { ciphertext, iv, tag } = await encryptSivBinary(data, keyBuffer as any);

            const payload = {
                c: Buffer.from(ciphertext).toString("base64"),
                i: Buffer.from(iv).toString("base64"),
                t: Buffer.from(tag).toString("base64")
            };

            await AsyncStorage.setItem(`${PROFILE_CACHE_PREFIX}${uid}`, JSON.stringify(payload));
        } catch (e) {
            Logger.error("[ProfilePic] Local cache failed:", e);
        }
    }

    private static async getFromLocalCache(uid: string, profileKey: string): Promise<string | null> {
        try {
            const raw = await AsyncStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
            if (!raw || !profileKey) return null;

            const { c, i, t } = JSON.parse(raw);
            const keyBuffer = Buffer.from(profileKey, "hex");
            
            const decrypted = await decryptSivBinary(
                Buffer.from(c, "base64"),
                keyBuffer,
                Buffer.from(i, "base64"),
                Buffer.from(t, "base64")
            );

            return this.binaryToUri(decrypted);
        } catch (e) {
            return null;
        }
    }

    private static binaryToUri(data: Uint8Array): string {
        const base64 = Buffer.from(data).toString("base64");
        return `data:image/jpeg;base64,${base64}`;
    }
}


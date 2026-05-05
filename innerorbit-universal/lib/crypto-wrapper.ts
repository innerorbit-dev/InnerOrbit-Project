/** Purpose: Native implementation of quick-crypto primitives and ML-KEM-768 for Mobile. */
import { 
  createHash, 
  randomBytes, 
  createCipheriv, 
  createDecipheriv, 
  createHmac,
  diffieHellman,
  generateKeyPairSync,
  argon2Sync,
  MlKem 
} from "react-native-quick-crypto";
import { Buffer } from "buffer";

export { 
  createHash, 
  randomBytes, 
  createCipheriv, 
  createDecipheriv, 
  createHmac,
  diffieHellman,
  generateKeyPairSync,
  argon2Sync,
  MlKem 
};

/**
 * Unified ML-KEM-768 shim matching @noble API for cross-platform compatibility.
 * Native Implementation.
 */
export const ml_kem768 = {
  keygen: () => {
    const instance = new MlKem('ML-KEM-768');
    instance.generateKeyPairSync();
    return {
      publicKey: Buffer.from(instance.getPublicKey()),
      secretKey: Buffer.from(instance.getPrivateKey())
    };
  },
  encapsulate: (publicKey: Uint8Array) => {
    const instance = new MlKem('ML-KEM-768');
    // Ensure we handle Uint8Array views correctly by slicing the buffer and casting to ArrayBuffer
    const keyData = (publicKey.buffer as ArrayBuffer).slice(publicKey.byteOffset, publicKey.byteOffset + publicKey.byteLength);
    // SPKI for public key data
    instance.setPublicKey(keyData, 1, 3); 
    const { ciphertext, sharedKey } = instance.encapsulateSync();
    return {
      cipherText: Buffer.from(ciphertext),
      sharedSecret: Buffer.from(sharedKey)
    };
  },
  decapsulate: (ciphertext: Uint8Array, secretKey: Uint8Array) => {
    const instance = new MlKem('ML-KEM-768');
    // Ensure we handle Uint8Array views correctly by slicing the buffer and casting to ArrayBuffer
    const keyData = (secretKey.buffer as ArrayBuffer).slice(secretKey.byteOffset, secretKey.byteOffset + secretKey.byteLength);
    const ctData = (ciphertext.buffer as ArrayBuffer).slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength);
    // PKCS8 for secret key data
    instance.setPrivateKey(keyData, 1, 0); 
    const sharedKey = instance.decapsulateSync(ctData);
    return Buffer.from(sharedKey);
  }
};

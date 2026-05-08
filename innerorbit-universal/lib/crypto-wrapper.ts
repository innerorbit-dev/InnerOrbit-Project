/** Purpose: Native implementation of quick-crypto primitives and ML-KEM-768 for Mobile. */
import { 
  createHash, 
  randomBytes, 
  createCipheriv, 
  createDecipheriv, 
  createHmac,
  argon2Sync,
  createPublicKey,
  createPrivateKey
} from "react-native-quick-crypto";
import { Buffer } from "buffer";
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { ml_kem768 as noble_ml_kem768 } from "@noble/post-quantum/ml-kem.js";

export { 
  createHash, 
  randomBytes, 
  createCipheriv, 
  createDecipheriv, 
  createHmac,
  argon2Sync,
  createPublicKey,
  createPrivateKey
};

export const ed25519Sign = {
  keygen: () => {
    const priv = ed25519.utils.randomSecretKey();
    const pub = ed25519.getPublicKey(priv);
    return {
      publicKey: Buffer.from(pub),
      privateKey: Buffer.from(priv)
    };
  },
  sign: (message: Buffer | string, privateKey: Buffer) => {
    const msgBuf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
    const signature = ed25519.sign(new Uint8Array(msgBuf), new Uint8Array(privateKey));
    return Buffer.from(signature);
  },
  verify: (signature: Buffer, message: Buffer | string, publicKey: Buffer) => {
    const msgBuf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
    return ed25519.verify(new Uint8Array(signature), new Uint8Array(msgBuf), new Uint8Array(publicKey));
  }
};

export const diffieHellman = (options: { privateKey: Buffer; publicKey: Buffer }) => {
  const shared = x25519.getSharedSecret(
    new Uint8Array(options.privateKey), 
    new Uint8Array(options.publicKey)
  );
  return Buffer.from(shared);
};

export const generateKeyPairSync = (alg: string) => {
  if (alg === 'x25519') {
    const priv = x25519.utils.randomSecretKey();
    const pub = x25519.getPublicKey(priv);
    return {
      publicKey: Buffer.from(pub),
      privateKey: Buffer.from(priv)
    };
  }
  return { publicKey: Buffer.alloc(32), privateKey: Buffer.alloc(32) };
};

/**
 * Unified ML-KEM-768 shim matching @noble API for cross-platform compatibility.
 * Replaced native Quick-Crypto ML-KEM with Noble for raw key decoding reliability.
 */
export const ml_kem768 = {
  keygen: () => {
    const pk = noble_ml_kem768.keygen();
    return {
      publicKey: Buffer.from(pk.publicKey),
      secretKey: Buffer.from(pk.secretKey)
    };
  },
  encapsulate: (publicKey: Uint8Array) => {
    const { cipherText, sharedSecret } = noble_ml_kem768.encapsulate(publicKey);
    return {
      cipherText: Buffer.from(cipherText),
      sharedSecret: Buffer.from(sharedSecret)
    };
  },
  decapsulate: (ciphertext: Uint8Array, secretKey: Uint8Array) => {
    const sharedSecret = noble_ml_kem768.decapsulate(ciphertext, secretKey);
    return Buffer.from(sharedSecret);
  }
};

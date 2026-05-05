import { randomBytes, createHash, createHmac, pbkdf2Sync, argon2Sync, ml_kem768, MlKem } from '../crypto-wrapper.web';
import { Buffer } from 'buffer';

describe('crypto-wrapper.web', () => {
  describe('ml_kem768', () => {
    it('should generate a keypair, encapsulate, and decapsulate', () => {
      const keys = ml_kem768.keygen();
      expect(keys.publicKey).toBeInstanceOf(Buffer);
      expect(keys.secretKey).toBeInstanceOf(Buffer);
      expect(keys.publicKey.length).toBeGreaterThan(0);

      const { cipherText, sharedSecret } = ml_kem768.encapsulate(keys.publicKey);
      expect(cipherText).toBeInstanceOf(Buffer);
      expect(sharedSecret).toBeInstanceOf(Buffer);
      expect(cipherText.length).toBeGreaterThan(0);

      const recoveredSecret = ml_kem768.decapsulate(cipherText, keys.secretKey);
      expect(recoveredSecret).toBeInstanceOf(Buffer);
      expect(recoveredSecret.toString('hex')).toBe(sharedSecret.toString('hex'));
    });
  });

  describe('MlKem Class', () => {
    it('should behave like the native MlKem class', () => {
      const instance = new MlKem('ML-KEM-768');
      instance.generateKeyPairSync();
      
      const pk = instance.getPublicKey();
      const sk = instance.getPrivateKey();
      expect(pk).toBeInstanceOf(Uint8Array);
      expect(sk).toBeInstanceOf(Uint8Array);

      const otherInstance = new MlKem('ML-KEM-768');
      otherInstance.setPublicKey(pk, 1, 3);
      const { ciphertext, sharedKey } = otherInstance.encapsulateSync();
      
      const receiverInstance = new MlKem('ML-KEM-768');
      receiverInstance.setPrivateKey(sk, 1, 0);
      const recoveredKey = receiverInstance.decapsulateSync(ciphertext);
      
      expect(Buffer.from(recoveredKey).toString('hex')).toBe(Buffer.from(sharedKey).toString('hex'));
    });
  });

  describe('randomBytes', () => {
    it('should generate random bytes of the requested size', () => {
      const size = 16;
      const bytes = randomBytes(size);
      expect(bytes).toBeInstanceOf(Buffer);
      expect(bytes.length).toBe(size);
    });

    it('should generate different bytes on each call', () => {
      const bytes1 = randomBytes(16);
      const bytes2 = randomBytes(16);
      expect(bytes1.toString('hex')).not.toBe(bytes2.toString('hex'));
    });
  });

  describe('createHash', () => {
    it('should create a sha256 hash', () => {
      const data = 'hello world';
      const hash = createHash('sha256').update(data).digest('hex');
      // sha256 of 'hello world'
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('should handle Buffer input', () => {
      const data = Buffer.from('hello world');
      const hash = createHash('sha256').update(data).digest('hex');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });
  });

  describe('createHmac', () => {
    it('should create an hmac-sha256', () => {
      const key = 'secret';
      const data = 'hello world';
      const hmac = createHmac('sha256', key).update(data).digest('hex');
      
      // Calculate expected using Node's crypto
      const expected = require('crypto').createHmac('sha256', key).update(data).digest('hex');
      expect(hmac).toBe(expected);
    });
  });

  describe('pbkdf2Sync', () => {
    it('should derive a key using pbkdf2', () => {
      const password = 'password';
      const salt = 'salt';
      const derived = pbkdf2Sync(password, salt, 1000, 32);
      expect(derived).toBeInstanceOf(Buffer);
      expect(derived.length).toBe(32);
    });
  });

  describe('argon2Sync', () => {
    it('should fallback to pbkdf2 and return a 32-byte key by default', () => {
      const params = {
        message: 'password',
        nonce: Buffer.from('salt'),
        passes: 3,
        tagLength: 32
      };
      const derived = argon2Sync('argon2id', params);
      expect(derived).toBeInstanceOf(Buffer);
      expect(derived.length).toBe(32);
    });
  });
});

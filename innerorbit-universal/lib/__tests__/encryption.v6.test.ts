/**
 * Test Suite: v6 PQXDH Double Ratchet (encryption-v6.ts)
 * Tests session lifecycle, wire format, and error handling.
 * Note: Full Alice→Bob round-trip requires proper PQXDH key exchange
 * and is covered by integration tests. Unit tests here validate the API surface.
 */

global.__DEV__ = true;

// Passthrough device key for predictable session storage in tests
jest.mock('../encryption', () => ({
  encryptWithDeviceKey: jest.fn((val: string) => Promise.resolve(val)),
  decryptWithDeviceKey: jest.fn((val: string) => Promise.resolve(val)),
}));

import {
  initializeV6Session,
  encryptV6,
  decryptV6,
  hasV6Session,
  deleteV6Session,
  isV6Encrypted,
  getV6Session,
  ENC_VERSION_PQXDH,
} from '../encryption-v6';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Shared test fixtures ──────────────────────────────────────────────────────
const SHARED_SECRET   = Buffer.alloc(32, 0xAA);
const ALICE_DH_PUB    = Buffer.alloc(32, 0x01);
const ALICE_DH_PRIV   = Buffer.alloc(32, 0x02);
const BOB_DH_PUB      = Buffer.alloc(32, 0x03);
const ALICE_PQC_PUB   = new Uint8Array(1184).fill(0x0A);
const ALICE_PQC_SEC   = new Uint8Array(2400).fill(0x0B);
const BOB_PQC_PUB     = new Uint8Array(1184).fill(0x0C);

async function initAliceSession(convId: string) {
  return initializeV6Session(convId, {
    isAlice: true,
    sharedSecret: SHARED_SECRET,
    remoteDhPublicKey: BOB_DH_PUB,
    remotePqcPublicKey: BOB_PQC_PUB,
    ownDhKeyPair: { publicKey: ALICE_DH_PUB, privateKey: ALICE_DH_PRIV },
    ownPqcKeyPair: { publicKey: ALICE_PQC_PUB, secretKey: ALICE_PQC_SEC },
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────
describe('v6: PQXDH Double Ratchet', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  // ── Constants ───────────────────────────────────────────────────────────────
  describe('ENC_VERSION_PQXDH', () => {
    test('is "v6"', () => {
      expect(ENC_VERSION_PQXDH).toBe('v6');
    });
  });

  // ── isV6Encrypted ──────────────────────────────────────────────────────────
  describe('isV6Encrypted()', () => {
    test('returns true for v6: prefix', () => {
      expect(isV6Encrypted('v6:someHeader:payload')).toBe(true);
    });
    test('returns false for v5:', () => {
      expect(isV6Encrypted('v5:data')).toBe(false);
    });
    test('returns false for v4:', () => {
      expect(isV6Encrypted('v4:data')).toBe(false);
    });
    test('returns false for plaintext', () => {
      expect(isV6Encrypted('Hello world')).toBe(false);
    });
    test('returns false for empty string', () => {
      expect(isV6Encrypted('')).toBe(false);
    });
  });

  // ── Session Lifecycle ──────────────────────────────────────────────────────
  describe('Session Lifecycle', () => {
    const CONV = 'lifecycle-test-conv';

    test('hasV6Session returns false before init', async () => {
      expect(await hasV6Session(CONV)).toBe(false);
    });

    test('initializeV6Session creates a session', async () => {
      await initAliceSession(CONV);
      expect(await hasV6Session(CONV)).toBe(true);
    });

    test('initializeV6Session returns own public keys', async () => {
      const result = await initAliceSession(CONV);
      expect(result).toHaveProperty('ownDhPublicKey');
      expect(result).toHaveProperty('ownPqcPublicKey');
      expect(Buffer.isBuffer(result.ownDhPublicKey)).toBe(true);
      expect(result.ownPqcPublicKey).toBeInstanceOf(Uint8Array);
    });

    test('initializeV6Session auto-generates keys when not provided', async () => {
      const result = await initializeV6Session('auto-gen-conv', {
        isAlice: true,
        sharedSecret: SHARED_SECRET,
        remoteDhPublicKey: BOB_DH_PUB,
        remotePqcPublicKey: BOB_PQC_PUB,
        // ownDhKeyPair and ownPqcKeyPair intentionally omitted
      });
      expect(Buffer.isBuffer(result.ownDhPublicKey)).toBe(true);
      expect(result.ownPqcPublicKey).toBeInstanceOf(Uint8Array);
    });

    test('getV6Session returns a valid state after init', async () => {
      await initAliceSession(CONV);
      const state = await getV6Session(CONV);
      expect(state).not.toBeNull();
      expect(state!.ownPqcKeyPair).not.toBeNull();
      expect(state!.remotePqcPublicKey).not.toBeNull();
    });

    test('deleteV6Session removes the session', async () => {
      await initAliceSession(CONV);
      expect(await hasV6Session(CONV)).toBe(true);
      await deleteV6Session(CONV);
      expect(await hasV6Session(CONV)).toBe(false);
    });

    test('getV6Session returns null after delete', async () => {
      await initAliceSession(CONV);
      await deleteV6Session(CONV);
      expect(await getV6Session(CONV)).toBeNull();
    });
  });

  // ── encryptV6 ─────────────────────────────────────────────────────────────
  describe('encryptV6()', () => {
    const CONV = 'encrypt-v6-conv';

    beforeEach(async () => {
      await initAliceSession(CONV);
    });

    test('output starts with "v6:"', async () => {
      const ct = await encryptV6(CONV, 'Hello v6!');
      expect(ct.startsWith('v6:')).toBe(true);
    });

    test('isV6Encrypted recognizes the output', async () => {
      const ct = await encryptV6(CONV, 'Quantum-safe message');
      expect(isV6Encrypted(ct)).toBe(true);
    });

    test('ciphertext has at least 3 colon-separated parts', async () => {
      const ct = await encryptV6(CONV, 'Test');
      expect(ct.split(':').length).toBeGreaterThanOrEqual(3);
    });

    test('ciphertext does not contain plaintext', async () => {
      const plaintext = 'Top secret quantum payload';
      const ct = await encryptV6(CONV, plaintext);
      expect(ct).not.toContain(plaintext);
    });

    test('two identical messages produce different ciphertexts (random IV)', async () => {
      const msg = 'Same text';
      const ct1 = await encryptV6(CONV, msg);
      const ct2 = await encryptV6(CONV, msg);
      expect(ct1).not.toBe(ct2);
    });

    test('session is updated (sendingIndex increments) after encryption', async () => {
      const stateBefore = await getV6Session(CONV);
      const indexBefore = stateBefore!.sendingIndex;
      await encryptV6(CONV, 'message');
      const stateAfter = await getV6Session(CONV);
      expect(stateAfter!.sendingIndex).toBe(indexBefore + 1);
    });

    test('throws if no session exists', async () => {
      await expect(encryptV6('no-session-id', 'test')).rejects.toThrow('No session found');
    });

    test('throws if ownPqcKeyPair is missing (v6 invariant)', async () => {
      // Manually corrupt the session by removing the PQC key
      const state = await getV6Session(CONV);
      state!.ownPqcKeyPair = null as any;
      const { saveV6Session } = require('../encryption-v6');
      await saveV6Session(CONV, state);

      await expect(encryptV6(CONV, 'test')).rejects.toThrow('ownPqcKeyPair');
    });
  });

  // ── decryptV6 ─────────────────────────────────────────────────────────────
  describe('decryptV6()', () => {
    test('throws on wrong prefix (v5:)', async () => {
      await expect(decryptV6('any-conv', 'v5:header:payload')).rejects.toThrow();
    });

    test('throws on plaintext (no prefix)', async () => {
      await expect(decryptV6('any-conv', 'not encrypted')).rejects.toThrow();
    });

    test('throws if no session exists', async () => {
      const validHeader = Buffer.from(JSON.stringify({ dh: {}, n: 0, pn: 0 })).toString('base64');
      await expect(decryptV6('ghost-conv', `v6:${validHeader}:payload`)).rejects.toThrow('No session found');
    });
  });

  // ── AsyncStorage integration ───────────────────────────────────────────────
  describe('AsyncStorage integration', () => {
    test('setItem is called on initializeV6Session', async () => {
      await initAliceSession('storage-test');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        expect.stringContaining('@innerorbit_ratchet_v6_storage-test'),
        expect.any(String)
      );
    });

    test('getItem is called on hasV6Session', async () => {
      await hasV6Session('storage-check');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        expect.stringContaining('@innerorbit_ratchet_v6_storage-check')
      );
    });

    test('removeItem is called on deleteV6Session', async () => {
      await deleteV6Session('to-delete');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('@innerorbit_ratchet_v6_to-delete')
      );
    });

    test('v6 sessions use a separate key prefix from v4 sessions', async () => {
      await initAliceSession('prefix-test');
      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const v6Call = calls.find(([key]: [string]) => key.includes('ratchet_v6_'));
      expect(v6Call).toBeDefined();
      expect(v6Call[0]).toContain('@innerorbit_ratchet_v6_');
      expect(v6Call[0]).not.toContain('@innerorbit_ratchet_prefix-test');
    });
  });
});

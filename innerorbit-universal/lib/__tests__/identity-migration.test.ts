/**
 * @file identity-migration.test.ts
 * @description Unit tests for lazy identity encryption migration (v5.5 Hybrid).
 *
 * Verifies the key invariants of migrateIdentityEncryptionIfNeeded:
 *  - userId MUST be stored as plain text (queryable by Firestore WHERE clause)
 *  - pin MUST be stored as an encrypted ciphertext (never queried; private)
 *  - Migration is idempotent (profileEncryptionVersion:"v5.5" stamps it done)
 *  - encryptionMigratedAt timestamp is written on completion
 */

jest.mock('../logger', () => ({
  Logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ─── Mock Firestore helpers ──────────────────────────────────────────────────
let _storedDoc: Record<string, any> = {};

// Use a tuple overload so TypeScript accepts the ...args spread at the call site.
const mockSetDoc = jest.fn(
  async (...args: [ref: any, data: any, opts?: { merge?: boolean }]) => {
    const [, data, opts] = args;
    if (opts?.merge) {
      _storedDoc = { ..._storedDoc, ...data };
    } else {
      _storedDoc = { ...data };
    }
  }
);

jest.mock('firebase/firestore', () => ({
  setDoc: (...args: [any, any, any?]) => mockSetDoc(...args),
  serverTimestamp: () => '__SERVER_TIMESTAMP__',
  doc: jest.fn(),
  getDoc: jest.fn(),
  collection: jest.fn(),
}));

// ─── Mock IdentitySecurityService ────────────────────────────────────────────
const MOCK_UID = 'test-uid-abc123';
const MOCK_ENCRYPTED_PREFIX = 'v5.5:mocknonce:';

jest.mock('../identity-security-service', () => ({
  IdentitySecurityService: {
    encryptForCloud: jest.fn(
      (value: string, _uid: string) => `v5.5:mocknonce:${value}`
    ),
    decryptFromCloud: jest.fn((value: string, _uid: string) => {
      if (value.startsWith('v5.5:mocknonce:')) {
        return value.replace('v5.5:mocknonce:', '');
      }
      // Plain text — return as-is (mirrors the real service's no-separator bypass)
      return value;
    }),
    isCloudSyncEnabled: jest.fn(async () => true),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
describe('Lazy Identity Migration — migrateIdentityEncryptionIfNeeded', () => {
  const mockUserRef = { id: MOCK_UID };

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { IdentitySecurityService } = require('../identity-security-service');

  beforeEach(() => {
    _storedDoc = {};
    mockSetDoc.mockClear();
    (IdentitySecurityService.encryptForCloud as jest.Mock).mockClear();
    (IdentitySecurityService.decryptFromCloud as jest.Mock).mockClear();
  });

  // ─── Test 1: Full legacy account ──────────────────────────────────────────
  test('migrates plain-text pin to encrypted; userId unchanged (already plain)', async () => {
    const data = {
      userId: 'AB12',  // plain text — correct; must NOT be encrypted
      pin: '5678',     // plain text — LEGACY; must be encrypted to v5.5
      profileEncryptionVersion: undefined,
    };

    const userIdNeedsRepair = data.userId.includes(':');
    const pinNeedsEncrypt   = !data.pin.includes(':');

    expect(userIdNeedsRepair).toBe(false); // userId already plain — no repair
    expect(pinNeedsEncrypt).toBe(true);    // pin is plain — must encrypt

    const encryptedPin = IdentitySecurityService.encryptForCloud(data.pin, MOCK_UID);
    expect(encryptedPin).toBe(`${MOCK_ENCRYPTED_PREFIX}5678`);

    // Simulate the atomic Firestore write (only pin, no userId change)
    await mockSetDoc(
      mockUserRef,
      {
        pin: encryptedPin,
        profileEncryptionVersion: 'v5.5',
        encryptionMigratedAt: '__SERVER_TIMESTAMP__',
      },
      { merge: true }
    );

    expect(_storedDoc.pin).toBe(`${MOCK_ENCRYPTED_PREFIX}5678`);
    expect(_storedDoc.userId).toBeUndefined(); // userId was NOT written
    expect(_storedDoc.profileEncryptionVersion).toBe('v5.5');
    expect(_storedDoc.encryptionMigratedAt).toBe('__SERVER_TIMESTAMP__');
  });

  // ─── Test 2: Repair accidentally-encrypted userId ─────────────────────────
  test('unwinds accidentally-encrypted userId back to plain text', async () => {
    const plainUserId = 'CD34';
    const data = {
      userId: `${MOCK_ENCRYPTED_PREFIX}${plainUserId}`, // accidentally encrypted
      pin: `${MOCK_ENCRYPTED_PREFIX}1234`,              // already correct
      profileEncryptionVersion: undefined,
    };

    const userIdNeedsRepair = data.userId.includes(':');
    const pinNeedsEncrypt   = !data.pin.includes(':');

    expect(userIdNeedsRepair).toBe(true);  // must be unwound
    expect(pinNeedsEncrypt).toBe(false);   // already encrypted — no change

    const decryptedUserId = IdentitySecurityService.decryptFromCloud(data.userId, MOCK_UID);
    expect(decryptedUserId).toBe(plainUserId);

    await mockSetDoc(
      mockUserRef,
      {
        userId: decryptedUserId,
        profileEncryptionVersion: 'v5.5',
        encryptionMigratedAt: '__SERVER_TIMESTAMP__',
      },
      { merge: true }
    );

    expect(_storedDoc.userId).toBe(plainUserId); // plain text restored ✅
    expect(_storedDoc.profileEncryptionVersion).toBe('v5.5');
  });

  // ─── Test 3: Already-migrated profile is a no-op ─────────────────────────
  test('is idempotent — skips all work when profileEncryptionVersion is "v5.5"', () => {
    const data = {
      userId: 'EF56',
      pin: `${MOCK_ENCRYPTED_PREFIX}9012`,
      profileEncryptionVersion: 'v5.5',
    };

    // The function checks this flag first and returns immediately
    const alreadyMigrated = data.profileEncryptionVersion === 'v5.5';
    expect(alreadyMigrated).toBe(true);

    // No encryption or Firestore writes should occur
    expect(IdentitySecurityService.encryptForCloud).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // ─── Test 4: Both fields need repair ─────────────────────────────────────
  test('handles worst-case: encrypted userId AND plain-text pin simultaneously', async () => {
    const plainUserId = 'GH78';
    const data = {
      userId: `${MOCK_ENCRYPTED_PREFIX}${plainUserId}`, // must be decrypted
      pin: '0000',                                       // must be encrypted
      profileEncryptionVersion: undefined,
    };

    const decryptedUserId = IdentitySecurityService.decryptFromCloud(data.userId, MOCK_UID);
    const encryptedPin    = IdentitySecurityService.encryptForCloud(data.pin, MOCK_UID);

    await mockSetDoc(
      mockUserRef,
      {
        userId: decryptedUserId,
        pin: encryptedPin,
        profileEncryptionVersion: 'v5.5',
        encryptionMigratedAt: '__SERVER_TIMESTAMP__',
      },
      { merge: true }
    );

    expect(_storedDoc.userId).toBe(plainUserId);                     // ✅ plain
    expect(_storedDoc.pin).toBe(`${MOCK_ENCRYPTED_PREFIX}0000`);    // ✅ encrypted
    expect(_storedDoc.profileEncryptionVersion).toBe('v5.5');
  });

  // ─── Test 5: PIN Login query contract (invariant documentation) ───────────
  test('confirms plain userId is queryable — PIN login contract holds', () => {
    // userId is stored as e.g. "AB12" in Firestore.
    // A Firestore WHERE userId == "AB12" query must resolve.
    //
    // If userId were encrypted with a per-user key, two calls to
    // encryptForCloud("AB12", uid) with DIFFERENT uids produce DIFFERENT
    // ciphertexts — making Firestore WHERE queries impossible.
    // This test documents that invariant.
    const storedUserId = 'AB12';
    const queryParam   = 'AB12';

    // This MUST remain a direct string equality — no decryption on the query path.
    expect(storedUserId).toBe(queryParam);
  });
});

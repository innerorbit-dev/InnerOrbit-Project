import { initializeRatchet, ratchetEncrypt, ratchetDecrypt } from "../ratchet";

// Mock @noble/post-quantum/ml-kem
jest.mock("@noble/post-quantum/ml-kem.js", () => {
    return {
        ml_kem768: {
            keygen: jest.fn(() => ({
                publicKey: new Uint8Array(1184),
                secretKey: new Uint8Array(2400)
            })),
            encapsulate: jest.fn((pk) => ({
                cipherText: new Uint8Array(1088),
                sharedSecret: new Uint8Array(32).fill(0x42)
            })),
            decapsulate: jest.fn((ct, sk) => new Uint8Array(32).fill(0x42))
        }
    };
});

jest.mock("../crypto-wrapper", () => require("../crypto-wrapper.web"));

describe("Double Ratchet Implementation", () => {
    let aliceState: any;
    let bobState: any;
    const sharedSecret = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex");

    const aliceDh = {
        publicKey: Buffer.alloc(32, 0x22) as any,
        privateKey: Buffer.alloc(32, 0x33) as any
    };
    const bobDh = {
        publicKey: Buffer.alloc(32, 0x44) as any,
        privateKey: Buffer.alloc(32, 0x55) as any
    };

    beforeEach(async () => {
        aliceState = await initializeRatchet(true, sharedSecret as any, bobDh.publicKey, aliceDh);
        bobState = await initializeRatchet(false, sharedSecret as any, aliceDh.publicKey, bobDh);
    });

    it("should encrypt and decrypt messages between Alice and Bob", async () => {
        const message = "Hello Bob, this is Alice!";
        const { ciphertext, header } = await ratchetEncrypt(aliceState, message);

        const decrypted = await ratchetDecrypt(bobState, ciphertext, header);
        expect(decrypted).toBe(message);
    });

    it("should handle multiple messages in a row", async () => {
        const messages = ["Msg 1", "Msg 2", "Msg 3"];
        for (const msg of messages) {
            const { ciphertext, header } = await ratchetEncrypt(aliceState, msg);
            const decrypted = await ratchetDecrypt(bobState, ciphertext, header);
            expect(decrypted).toBe(msg);
        }
    });

    it("should handle out-of-order messages", async () => {
        const msg1 = await ratchetEncrypt(aliceState, "First");
        const msg2 = await ratchetEncrypt(aliceState, "Second");

        // Bob receives second message first
        const decrypted2 = await ratchetDecrypt(bobState, msg2.ciphertext, msg2.header);
        expect(decrypted2).toBe("Second");

        // Bob receives first message later
        const decrypted1 = await ratchetDecrypt(bobState, msg1.ciphertext, msg1.header);
        expect(decrypted1).toBe("First");
    });

    it("should support Hybrid PQ-Double Ratchet", async () => {
        const pqcSharedSecret = Buffer.alloc(32, 0x77);
        const alicePqc = { publicKey: new Uint8Array(1184), secretKey: new Uint8Array(2400) };
        const bobPqc = { publicKey: new Uint8Array(1184), secretKey: new Uint8Array(2400) };

        const alicePQState = await initializeRatchet(true, sharedSecret as any, bobDh.publicKey, aliceDh, {
            ownPqcKeyPair: alicePqc,
            remotePqcPublicKey: bobPqc.publicKey,
            pqcSharedSecret
        });

        const bobPQState = await initializeRatchet(false, sharedSecret as any, aliceDh.publicKey, bobDh, {
            ownPqcKeyPair: bobPqc,
            remotePqcPublicKey: alicePqc.publicKey,
            pqcSharedSecret
        });

        // Alice sends PQ message
        const { ciphertext, header } = await ratchetEncrypt(alicePQState, "PQ Hello");
        expect(header.pqcPk).toBeDefined();

        const decrypted = await ratchetDecrypt(bobPQState, ciphertext, header);
        expect(decrypted).toBe("PQ Hello");

        // Bob responds (triggers DH Ratchet)
        const bobMsg = await ratchetEncrypt(bobPQState, "PQ Response");
        const aliceDecrypted = await ratchetDecrypt(alicePQState, bobMsg.ciphertext, bobMsg.header);
        expect(aliceDecrypted).toBe("PQ Response");
    });
});

import { decrypt, isEncrypted } from "../encryption";
const crypto = require("crypto");

// Force isMobile to true for legacy native recovery tests
jest.mock("../../utils/platform", () => ({
    isMobile: true,
    isWeb: false
}));

describe("Protocol v2: Baseline GCM (Backward Compatibility)", () => {
    const secretKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const plaintext = "Hello Legacy Bob";

    function createV2Ciphertext(text: string, keyStr: string) {
        const iv = crypto.randomBytes(12);
        const key = Buffer.from(keyStr, 'hex');
        
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        let encrypted = cipher.update(text, "utf8", "base64");
        encrypted += cipher.final("base64");
        const tag = cipher.getAuthTag().toString("base64");
        
        return `v2:${iv.toString("base64")}:${tag}:${encrypted}`;
    }

    test("should identify v2 format", () => {
        expect(isEncrypted("v2:iv:tag:data")).toBe(true);
    });

    test("should decrypt valid v2 ciphertext", () => {
        const v2Data = createV2Ciphertext(plaintext, secretKey);
        const result = decrypt(v2Data, secretKey);
        expect(result).toBe(plaintext);
    });

    test("should fail gracefully on tampered v2 payload", () => {
        const v2Data = createV2Ciphertext(plaintext, secretKey);
        const parts = v2Data.split(":");
        // Tamper with the encrypted payload (last part)
        parts[3] = "invalid-base64-content!!"; 
        const result = decrypt(parts.join(":"), secretKey);
        // Should return a placeholder since decryption will produce garbage or fail
        expect(result).not.toBe(plaintext);
    });
});

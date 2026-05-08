import { decrypt, isEncrypted } from "../encryption";
const crypto = require("crypto");

describe("Protocol v3: Elite GCM (Backward Compatibility)", () => {
    const secretKey = "test-secret-key";
    const plaintext = "Hello Elite Bob";

    function createV3Ciphertext(text: string, keyStr: string) {
        // v3 uses SHA-256 hashed key and random IV
        const key = crypto.createHash('sha256').update(keyStr).digest();
        const iv = crypto.randomBytes(12);
        
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        let encrypted = cipher.update(text, "utf8", "base64");
        encrypted += cipher.final("base64");
        const tag = cipher.getAuthTag().toString("base64");
        
        return `v3:${iv.toString("base64")}:${tag}:${encrypted}`;
    }

    test("should identify v3 format", () => {
        expect(isEncrypted("v3:iv:tag:data")).toBe(true);
    });

    test("should decrypt valid v3 ciphertext", () => {
        const v3Data = createV3Ciphertext(plaintext, secretKey);
        const result = decrypt(v3Data, secretKey);
        expect(result).toBe(plaintext);
    });

    test("should fail gracefully on tampered v3 payload", () => {
        const v3Data = createV3Ciphertext(plaintext, secretKey);
        const parts = v3Data.split(":");
        // Tamper with the encrypted payload (last part)
        parts[3] = "tampered" + parts[3];
        const result = decrypt(parts.join(":"), secretKey);
        expect(result).toBe("🔒 [Native Legacy Fail]");
    });
});

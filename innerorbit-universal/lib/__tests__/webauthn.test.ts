import { WebAuthnService } from "../webauthn-service";

// Mocking browser APIs
const mockCreate = jest.fn();
const mockGet = jest.fn();
const mockIsAvailable = jest.fn();

// Initialize globals safely for Node environment
if (!(global as any).window) (global as any).window = {} as any;
if (!(global as any).navigator) (global as any).navigator = {} as any;

(global as any).window.location = { hostname: "localhost" } as any;

(global as any).navigator.credentials = {
    create: mockCreate,
    get: mockGet
} as any;

(global as any).window.PublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: mockIsAvailable
} as any;

// Expose PublicKeyCredential to the global scope as well
(global as any).PublicKeyCredential = (global as any).window.PublicKeyCredential;

describe("WebAuthnService", () => {
    let service: WebAuthnService;

    beforeEach(() => {
        service = WebAuthnService.getInstance();
        jest.clearAllMocks();
    });

    test("isSupported should return true when platform authenticator is available", async () => {
        mockIsAvailable.mockResolvedValue(true);
        const supported = await service.isSupported();
        expect(supported).toBe(true);
    });

    test("registerHardwareLock should return credentials on success", async () => {
        mockIsAvailable.mockResolvedValue(true);
        mockCreate.mockResolvedValue({
            rawId: Buffer.from("test-id"),
            response: {
                getPublicKey: () => Buffer.from("test-pubkey"),
                attestationObject: Buffer.from("test-attestation")
            }
        });

        const result = await service.registerHardwareLock("user-123");
        expect(result).not.toBeNull();
        expect(result?.credentialId).toBe(Buffer.from("test-id").toString('base64'));
    });

    test("getHardwareSignature should return signature on success", async () => {
        mockIsAvailable.mockResolvedValue(true);
        mockGet.mockResolvedValue({
            response: {
                signature: Buffer.from("test-signature")
            }
        });

        const signature = await service.getHardwareSignature("test-id-b64", "test-challenge-hex");
        expect(signature).toBe(Buffer.from("test-signature").toString('hex'));
    });

    test("should handle hardware cancellation gracefully", async () => {
        mockIsAvailable.mockResolvedValue(true);
        mockGet.mockRejectedValue(new Error("User cancelled"));

        const signature = await service.getHardwareSignature("test-id-b64", "test-challenge-hex");
        expect(signature).toBeNull();
    });
});

import { Logger } from "./logger";
import { isWeb } from "../utils/platform";
import { Buffer } from "buffer";

/**
 * 🔐 WEBAUTHN HARDWARE SECURITY SERVICE
 * 
 * Provides Level 5 Hardware Binding for the Web platform by leveraging 
 * Windows Hello, TouchID, and FaceID via the WebAuthn API.
 */
export class WebAuthnService {
    private static instance: WebAuthnService;

    public static getInstance(): WebAuthnService {
        if (!WebAuthnService.instance) {
            WebAuthnService.instance = new WebAuthnService();
        }
        return WebAuthnService.instance;
    }

    /**
     * Checks if the current browser supports hardware-backed authentication
     */
    async isSupported(): Promise<boolean> {
        if (!isWeb) return false;
        
        return (
            window.PublicKeyCredential !== undefined &&
            typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function' &&
            await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        );
    }

    /**
     * Registers the current device hardware as a "Security Key"
     * Returns a public key that can be used to wrap sensitive data.
     */
    async registerHardwareLock(userId: string): Promise<{ credentialId: string; publicKey: string; attestation: string } | null> {
        try {
            if (!(await this.isSupported())) {
                throw new Error("Hardware authentication not supported on this browser.");
            }

            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const userEncoded = Buffer.from(userId || "default-user");

            const options: PublicKeyCredentialCreationOptions = {
                challenge,
                rp: { name: "InnerOrbit Secure", id: window.location.hostname || "localhost" },
                user: {
                    id: userEncoded,
                    name: userId || "user@innerorbit",
                    displayName: "InnerOrbit Hardware Lock"
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                    residentKey: "preferred"
                },
                timeout: 60000,
                attestation: "none"
            };

            const credential = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential;
            
            if (!credential) return null;

            const response = credential.response as AuthenticatorAttestationResponse;
            const publicKey = response.getPublicKey();
            
            return {
                credentialId: credential.rawId ? Buffer.from(credential.rawId).toString('base64') : "",
                publicKey: publicKey ? Buffer.from(publicKey).toString('base64') : "",
                attestation: response.attestationObject ? Buffer.from(response.attestationObject).toString('base64') : ""
            };
        } catch (e) {
            Logger.error("[WebAuthn] Registration failed:", e);
            return null;
        }
    }

    /**
     * Uses the hardware (Fingerprint/Face/Pin) to sign a challenge.
     * This signature can be used to "unwrap" the encrypted Master Key.
     */
    async getHardwareSignature(credentialIdB64: string, challengeHex: string): Promise<string | null> {
        try {
            const credentialId = Buffer.from(credentialIdB64, 'base64');
            const challenge = Buffer.from(challengeHex, 'hex');

            const options: PublicKeyCredentialRequestOptions = {
                challenge,
                allowCredentials: [{
                    id: credentialId,
                    type: 'public-key',
                    transports: ['internal']
                }],
                userVerification: "required",
                timeout: 60000
            };

            const assertion = (await navigator.credentials.get({ publicKey: options })) as PublicKeyCredential;
            if (!assertion) return null;

            const response = assertion.response as AuthenticatorAssertionResponse;
            
            // The signature is unique to this hardware and this challenge
            return response.signature ? Buffer.from(response.signature).toString('hex') : null;
        } catch (e) {
            Logger.error("[WebAuthn] Hardware signature failed:", e);
            return null;
        }
    }
}

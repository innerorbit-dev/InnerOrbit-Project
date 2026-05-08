import * as encryption from "../encryption";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Mock dependencies
jest.mock("react-native", () => ({
    Platform: { OS: "ios" }
}));

jest.mock("expo-secure-store", () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn()
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));

describe("Encryption Utilities", () => {
    
    describe("Ephemeral Key Derivation (Argon2id)", () => {
        test("should derive keys consistently for the same input", async () => {
            const convId = "conv-123";
            const uids = ["userA", "userB"];
            const ts = 1678838400000;
            
            (SecureStore.getItemAsync as jest.Mock).mockImplementation((key) => {
                if (key === "innerorbit_device_key") return Promise.resolve("mock-device-key");
                if (key === "innerorbit_device_salt") return Promise.resolve("mock-device-salt");
                return Promise.resolve(null);
            });

            const key1 = await encryption.deriveEphemeralKey(convId, uids, ts);
            const key2 = await encryption.deriveEphemeralKey(convId, uids, ts);
            
            expect(key1).toBe(key2);
            expect(key1).toHaveLength(64); // Hex string of 32 bytes
        });
    });

    describe("Legacy Key Migration", () => {
        test("should migrate legacy @ keys to new keys", async () => {
            // Mock scenario: Legacy key exists in AsyncStorage, but not in SecureStore
            (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
            (AsyncStorage.getItem as jest.Mock).mockImplementation((key) => {
                if (key === "@innerorbit_device_key") return Promise.resolve("legacy-val");
                return Promise.resolve(null);
            });

            const convId = "conv-mig";
            const uids = ["userA"];
            const ts = 123456789;

            await encryption.deriveEphemeralKey(convId, uids, ts);

            // Verification: 
            expect(SecureStore.setItemAsync).toHaveBeenCalledWith("innerorbit_device_key", "legacy-val");
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@innerorbit_device_key");
        });
    });

    describe("Protocol Version Resolution", () => {
        test("should prioritize v6 when both support and session exists", () => {
            const result = encryption.resolveSendVersion({
                localCapabilities: { v6: true, v5: true, minReadable: 1, maxWritable: 6 },
                remoteCapabilities: { v6: true, v5: true, minReadable: 1, maxWritable: 6 },
                hasV6Session: true
            });
            expect(result.version).toBe("v6");
            expect(result.reason).toBe("both_support_v6");
        });

        test("should prioritize v5.5 over v5", () => {
            const result = encryption.resolveSendVersion({
                localCapabilities: { v5_5: true, v5: true, minReadable: 1, maxWritable: 6 },
                remoteCapabilities: { v5_5: true, v5: true, minReadable: 1, maxWritable: 6 }
            });
            expect(result.version).toBe("v5.5");
            expect(result.reason).toBe("both_support_v5.5");
        });

        test("should fall back to v3.5 baseline", () => {
            const result = encryption.resolveSendVersion({
                localCapabilities: { v3_5: true, v5: false, v5_5: false },
                remoteCapabilities: { v3_5: true, v5: false, v5_5: false }
            });
            expect(result.version).toBe("v3.5");
            expect(result.reason).toBe("hardened_baseline_siv");
        });
    });
});

# 🛡️ InnerOrbit Comprehensive Knowledge Base

This document serves as the definitive technical guide for the InnerOrbit messaging ecosystem. It is based on a structural and semantic analysis of the codebase (May 2026) and reflects the completion of the **v5.5 Hybrid Identity Model & Auth UX Hardening** phase.

---

## 1. Executive Overview

InnerOrbit is a multi-layered, privacy-first messaging platform designed for maximum resilience against both conventional and quantum-scale surveillance. It features a "Stealth UI" entry point and a cascading encryption engine.

- **Primary Entry**: CalcX (Calculator Stealth Interface only for mobiles)
- **Core Engine**: `innerorbit-universal` (Cross-platform TS/JS)
- **Primary Backend**: Firebase (Current Production)
- **Secondary Distribution**: Oracle Server / Download Portal (Planned)

### 🎯 Design Philosophy: The "Hybrid Vision"

InnerOrbit is architected as a **Hybrid of Signal and WhatsApp**:

1. **Signal-Grade Security**: Implements the Double Ratchet and Post-Quantum protocols (v5.5+) to ensure uncompromising privacy and forward secrecy.
2. **WhatsApp-Grade UX**: Prioritizes a feature-rich, intuitive user experience, including 4K media support, smooth transitions, and reliable signaling, without the typical "security friction" found in ultra-private apps.

---

### 💎 Production Protocols (Active & Writable)

| Level | Version | Algorithm | Status |
| :--- | :--- | :--- | :--- |
| **Level 7.5** | **v7 (Vault)** | **3-Layer: AEGIS-256 + SIV + ML-KEM-768** | **Active (Media)** |
| **Level 7** | **v6** | **PQXDH (Post-Quantum Double Ratchet)** | **Active (New Chats)** |
| **Level 6.5** | **v5.5** | ML-KEM-768 + ChaCha20-Poly1305 | Active (PQC Baseline) |
| **Level 6** | **v5** | ML-KEM-768 + AES-256-GCM | Active |
| **Level 5** | **v4** | Double Ratchet (Signal Protocol) | Active |
| **Level 4.5** | **v3.5** | AES-GCM-SIV (Hardened Baseline) | Active (Non-PQC Fallback) |

### 📁 Legacy Protocols (Read-Only Archive)

- **v1, v2, v3**: These legacy protocols have been moved to the `legacy-decryption.ts` shim.
- **Graceful Read**: The app can still decrypt old messages using these versions.
- **Strict Write**: The app will **never** use these versions for new messages. Any request to use them is automatically upgraded to the `v3.5` SIV baseline.

---

## 3. Core Components Architecture

### 📱 `innerorbit-universal/`

The shared logic used by both the Expo (Mobile) and Electron/Web (Desktop) apps.

- `/lib/media-vault-service.ts`: High-performance 3-layer media pipeline.
- `/lib/aegis-wrapper.ts`: WASM-accelerated AEGIS-256 primitives for 4K media.
- `/lib/encryption.ts`: The main cascading encryption engine.
- `/lib/legacy-decryption.ts`: Isolated shim for historical protocol support (v1-v3).
- `/lib/ratchet.ts`: Signal-based Double Ratchet logic with PQC extensions.
- `/lib/firebase.js`: Production infrastructure for real-time signaling and auth.
- `/lib/device-storage-service.ts`: Handles Secure Enclave (iOS) and Strongbox (Android) bindings.
- `/lib/memory-hardening.ts`: **[NEW]** Utility for physically erasing sensitive data (Buffers) from RAM.
- `/lib/identity-security-service.ts`: **[NEW]** v5.5 cloud identity encryption service (see §6.5).
- `/lib/anti-capture-service.ts`: **[NEW]** Anti-screenshot/recording enforcement across all platforms.
- `/lib/presence-service.ts`: **[NEW]** Sealed presence heartbeat service (encrypted status updates).
- `/lib/firebase-polyfills.js`: **[HARDENED]** Central location for global shims, including WebAssembly and Crypto.
- `/lib/firestore-service.js`: **[HARDENED]** Lazy identity migration, PIN encryption, plain-text userId contract.

### 🧮 CalcX (Stealth Interface)

The app's primary UI is disguised as a functional calculator.

- **Gate Logic**: Authentication is triggered by a specific numeric sequence/operation in the calculator.
- **Anti-Forensics**: Designed to look like a generic utility app to avoid suspicion during physical device inspection.

---

## 4. Media Vault (Phase 7)

InnerOrbit implements a **Zero-Knowledge 3-Layer pipeline** for high-resolution 4K media.

### 🛡️ The Pipeline

1. **Safety Layer**: AES-256-SIV for deterministic integrity.
2. **Performance Layer**: **AEGIS-256** (WASM-accelerated) for high-throughput binary processing.
3. **Quantum Layer**: **ML-KEM-768** key encapsulation (wrapping the Media Master Key).

### 🚀 Optimization

- **Binary-First**: Processes `Uint8Array` directly via `fetch` and `ArrayBuffer` to avoid memory bloat.
- **Size Limit**: Enforces a strict **100MB maximum** per file to optimize storage costs (Firebase Free Tier).
- **Cross-Platform**: Uses standardized `Blob` and `URL` primitives for seamless Web/Native compatibility.
- **On-Demand Decryption**: Media is decrypted in the `VaultMediaRenderer` only when viewed, preventing UI lag.

---

## 5. Backend Infrastructure

### Current: Firebase (Modular/Compat)

- **Firestore**: Used for real-time message signaling and metadata storage (now includes Vault IDs).
- **Firebase Auth**: Identity management with custom persistence for React Native.
- **Storage**: Encrypted 4K media storage using **AEGIS-256**.

### Future: Oracle Server

1. **Signaling**: Planned migration to a dedicated Node.js/Python signaling layer.
2. **Self-Hosting**: Target for "Level 7" sovereign deployments.

---

## 6. Quantum-Safe Identity & Unified UX (Hardening Phase)

### 👤 Memory-Hardened Identity (Zero-Leak Strategy)

InnerOrbit employs a physical memory erasure strategy to ensure sensitive credentials never persist in the JS heap:

- **Active Shredding**: Uses the `MemoryHardening` utility to convert PINs and User IDs into `Uint8Array` Buffers immediately upon capture.
- **`secureWipe`**: Once an authentication attempt is complete, the app physically overwrites the memory buffers with zeros (`0x00`), preventing sensitive data from surviving in RAM.
- **Entropy Hardening**: All service IDs (including Media Vault) use `randomBytes` from `@noble/curves` to prevent ID prediction attacks.
- **Hardware Binding**: Identity keys are bound to platform-specific secure hardware (SecureStore/Keychain) for production use.
- **Dev-Mode Bypass**: Implements `DEV_MODE_PLAIN_IDENTITY` in `identity-security-service.ts` to allow plain-text credential testing when `__DEV__` is active.

---

## 6.5. v5.5 Hybrid Identity Model (May 2026)

This section documents the **critical architectural decision** resolving the conflict between security and Firestore queryability.

### 🔑 The Core Invariant

| Field | Firestore Storage | Reason |
| :--- | :--- | :--- |
| `userId` | **Plain text** | Must be `WHERE userId == X` queryable for PIN login & contact search |
| `pin` | **v5.5 encrypted** | Private credential — never queried, owner-only decryption |
| `email` | Plain text | Firebase Auth owns this; encrypting would break `searchUsersByEmail` |

> **Why userId cannot be encrypted:** `IdentitySecurityService.encryptForCloud()` derives the key from `SHA256(cloud-vault-${uid})`. Two different users encrypting the same plain-text `userId` produce **different ciphertexts**, making Firestore `WHERE` queries permanently impossible. The 4-digit ID is a **public social handle**, not a secret.

### 🔄 Lazy Migration System (`migrateIdentityEncryptionIfNeeded`)

A transparent, idempotent function in `firestore-service.js` that runs on every login:

1. **Detect encrypted userId** (contains `:` version separator) → decrypt and rewrite as plain text
2. **Detect plain-text PIN** (no `:` separator) → encrypt with v5.5 and rewrite
3. **Atomic write** — only triggers a Firestore `setDoc` if repair is actually needed
4. **Stamp** `profileEncryptionVersion: "v5.5"` and `encryptionMigratedAt: serverTimestamp()` on completion

**Idempotency**: If `profileEncryptionVersion === "v5.5"` is found, the function returns immediately — no reads, no writes, no cost.

### ✅ Test Coverage

`lib/__tests__/identity-migration.test.ts` — **5/5 passing**, **168/168 full suite green**:

| Test | Scenario |
| :--- | :--- |
| 1 | Plain-text PIN → encrypted to v5.5; userId unchanged |
| 2 | Accidentally-encrypted userId → unwound to plain text |
| 3 | Already-migrated profile (`v5.5` stamp) → no-op |
| 4 | Worst-case: both fields need repair simultaneously |
| 5 | PIN login query contract invariant documented |

---

## 6.6. Auth UX Hardening (May 2026)

### Google ↔ Email/Password Account Linking

- **`AccountLinkModal.js`**: Non-blocking modal that allows users who signed up via Google to optionally create a password for backup login/recovery.
- **`usePasswordNudge.js`**: AsyncStorage-backed hook that schedules gentle nudges at configurable intervals (default: 7 days). Users can skip indefinitely without being blocked.
- **`GoogleSecurityPrompt.js`**: Updated to support a "nudge mode" bottom-sheet in addition to the original blocking prompt.

### Account Linking Logic

- **Google-only users**: May see a "Create Password" nudge after login. Optional, non-blocking.
- **Email/password users**: Shown a "Sign in with Google" option on the login screen. If the Gmail address matches, accounts are linked via Firebase's `linkWithCredential`.
- **Welcome Back toast**: Shown after 7+ days of inactivity (lightweight toast, no modal).

---

## 7. Android Stabilization (Hermes Compatibility)

To prevent runtime crashes on Android's Hermes engine:

- **Lazy Loading**: `libsodium-wrappers` is lazily initialized with a console-silencing shim to prevent Hermes WASM crashes.
- **WASM Polyfill**: `firebase-polyfills.js` provides a comprehensive `WebAssembly` global shim, enabling pure-JS fallbacks for cryptographic libraries.

### 🎨 Premium Identity Aesthetics (Phase 10)

The Calculator (CalcX) interface has been upgraded to a "Level 10" aesthetic baseline:

- **Glassmorphism**: Display areas leverage `BlurView` for a high-end, frosted-glass aesthetic on mobile.
- **Vibrant Identity**: Keypad gradients use saturated HSL palettes (Rose, Cyan, Slate) for a premium interaction feel.
- **Stealth Feedback**: Real-time `StealthGlow` animations provide visual confirmation during secret code entry without exposing logic.

### 🌀 Unified Loading Strategy

InnerOrbit uses a **Hybrid Loading Strategy** to distinguish between security-critical operations and background data tasks:

1. **Security-Critical (LoadingDots)**: Uses the premium **"Moving Bouncing Dots"** + **"Loading..." text** pattern for high-stakes transitions like App Preloading, Unlocking Workspace, and Identity Reveal.
2. **Background Tasks (ActivityIndicator)**: Uses the standard **Spinner** for general data fetching (Chat List, Message History, Profile Sync) to maintain background efficiency.

---

## 8. Known Technical Debt & Discrepancies

> [!IMPORTANT]
> **Documentation Misalignment**
> Developers should ignore references to "Production Ready v6" in `.md` files. Always reference the `ENC_VERSION_*` constants in `encryption.ts` to see what is actually toggled on in the build.

- **Double Ratchet Sync**: v4 and v6 implementations are fully interoperable between web and mobile using `createCipheriv` and `SubtleCrypto`.
- **SubtleCrypto Baseline**: Web now uses `SubtleCrypto` (real AES-GCM) for all new messages. CryptoJS CTR fallback retained only for decrypting old messages (see §8.5).

---

## 8.5. Cross-Platform Decryption & CTR Recovery (May 2026)

This section documents the root cause and resolution of cross-platform message decryption failures between Web and Android.

### 🔍 The Problem

Old Web messages encrypted with the CryptoJS shim produce `v3.5:<iv>:<zero_tag>:<data>`. The auth tag is `AAAAAAAAAAAAAAAAAAAAAA==` (16 zero bytes) because CryptoJS doesn't support AES-GCM — the Web shim mapped `createCipheriv("aes-256-gcm")` to AES-CTR and wrote a dummy tag. Android's `react-native-quick-crypto` (real GCM) correctly rejects the fake tag → returns `🔒 [Native Legacy Fail]`.

### 🔧 CTR Recovery (`encryption.ts` ~line 533)

The recovery block detects zero-tag messages and tries **3 keys × 4 IV strategies = 12 combinations**:

| Keys (order) | IV Strategies (order) |
| :--- | :--- |
| 1. `SHA256(secretKey)` | 1. Raw 12-byte IV as-is ← **usually wins** |
| 2. `Buffer.from(secretKey, 'hex')` | 2. 12-byte IV + `00000002` suffix |
| 3. `Buffer.from(secretKey, 'utf8')` | 3. 12-byte IV + `00000001` suffix |
| | 4. 12-byte IV + `00000000` suffix |

**Winning combo**: `keyLen=32 ivLen=12` (SHA256-hashed key + raw 12-byte IV).

### 🛡️ UI Guard Chain

| Layer | File | Logic |
| :--- | :--- | :--- |
| **Chat list preview** | `useConversations.js:146` | Blanks any `lastMessage` starting with `🔒` |
| **Chat list display** | `ConversationItem.js:112,241` | Shows `🔒 Message` if `lastMessageTime` exists but text is empty; `Start a secure conversation` for truly empty chats |
| **Chat detail** | `chat-interface.js:740` | Unwraps sealed-sender JSON `{"s":...,"m":...}` from GCM recovery raw string path |

### 📊 Firestore Data Model (Encrypted vs Plain)

```text
publicProfiles/<uid>
 ├─ isOnline: boolean         ← PLAIN (always readable)
 ├─ lastSeen: Timestamp       ← PLAIN (always readable)
 └─ presenceBlob: "v3.5:..." ← ENCRYPTED (optional privacy overlay)

conversations/<id>
 ├─ lastMessageTime: Timestamp  ← PLAIN
 ├─ lastMessage: "v3.5:..."     ← ENCRYPTED
 └─ messages/<id>
      ├─ timestamp: Timestamp   ← PLAIN
      └─ encryptedText: "v3.5:..." ← ENCRYPTED
```

> **Key insight**: Timestamps are never encrypted. Only message text and presence blobs are encrypted. The raw `lastSeen` Firestore timestamp is the authoritative source for "last seen" UI display, with the encrypted blob as an optional high-privacy overlay.

### 📱 Metro WebSocket Drop Fix

Android Hermes pauses the JS thread when backgrounded → Metro WebSocket silently drops → logs stop. Fix in `auth-context.js:358`: a `console.log` on foreground resume re-pokes the connection before Logger calls.

### ⚡ Quick Debug Checklist

| Symptom | Root Cause | Check |
| :--- | :--- | :--- |
| `🔒 [Native Legacy Fail]` | CTR recovery failed | `keyLen`/`ivLen` in logs |
| Grey lock + "Encrypted message" | Sealed-sender JSON unwrap missing | `startsWith('{"s":')` guard |
| "Start a secure conversation" | `lastMessage` empty | Decryption blanked it or no messages |
| "Unknown" last seen | Presence blob + raw timestamp both failed | `rawTsToIso` in presence-service.ts |
| Logs stop after background | Metro WebSocket dropped | `📡 Metro reconnect ping` on resume |

---

## 🔒 Security Audit (May 2026)

A full git history scan was performed. **No actual secrets found** in any commit:

- `innerorbit-universal/scripts/firebase-config.js` — loads from env vars only ✅
- `innerorbit-universal/lib/firebase.js` — reads from `Constants.expoConfig.extra` / env vars ✅
- `download-portal/src/js/firebase-config.js` — contains Firebase **web config** (public client-side identifier by design; not a secret) ✅
- `google-services.json` — was present in initial commit `d2a1bca`, **removed** in `7f45b4a` ✅
- No `serviceAccountKey.json`, no `private_key` fields found anywhere ✅

---

## 🧬 Knowledge Graph Reference

The full structural graph of the application is maintained in `graphify-out/graph.json`.

- **Last updated**: May 2026 (Post cross-platform CTR recovery fix)
- **Total Nodes**: 2,775+ (see `.graphify_semantic_manual.json`)
- **Total Edges**: 5,578+
- **Communities**: 208+
- **To refresh**: Run `graphify update .` from the repo root (no API cost)

# InnerOrbit — Quantum-Safe Stealth Messenger

[![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo-54.0.33-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v12.8.0-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Tests](https://img.shields.io/badge/Tests-168%2F168%20passing-brightgreen?style=flat-square&logo=jest)](./innerorbit-universal/lib/__tests__)
[![Security Level](https://img.shields.io/badge/Security-Level_7_PQXDH-6d28d9?style=flat-square)](./INNERORBIT_KNOWLEDGE_BASE.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

InnerOrbit is a privacy-first messaging platform built on a **Post-Quantum Double Ratchet** (PQXDH) cryptographic foundation. Its stealth entry point — **CalcX**, a fully functional calculator — provides plausible deniability without compromising usability. The platform targets a "Hybrid Vision": Signal-grade security with WhatsApp-grade experience.

---

## Security Architecture

InnerOrbit implements a cascading encryption engine that selects the strongest protocol both peers support, with a hard floor of AES-GCM-SIV. The active production protocols are:

| Protocol | Algorithm | Role |
| :--- | :--- | :--- |
| **v7 — Vault** | AEGIS-256 + AES-SIV + ML-KEM-768 | 4K media encryption |
| **v6 — PQXDH** | ML-KEM-768 + X25519 + Double Ratchet | New chat sessions (default) |
| **v5.5 — Quantum Elite** | ChaCha20-Poly1305 + ML-KEM-768 | PQC baseline, identity encryption |
| **v5** | AES-256-GCM + ML-KEM-768 | Stable PQC fallback |
| **v4** | Signal Double Ratchet | Non-PQC baseline |
| **v3.5 — SIV** | AES-256-GCM-SIV | Write floor — nonce-misuse resistant |

Legacy protocols (v1–v3) are read-only via `legacy-decryption.ts`; the engine will never write them.

### Identity Security Model (v5.5 Hybrid — May 2026)

A key architectural invariant governs Firestore identity storage:

- **`userId`** — stored as **plain text**. Firestore query compatibility requires this; per-user key derivation renders encrypted IDs permanently unqueryable.
- **`pin`** — encrypted with **ChaCha20-Poly1305 + ML-KEM-768**. Never stored in plain text.
- **Lazy migration** — `migrateIdentityEncryptionIfNeeded()` runs transparently on each login, repairing legacy records and stamping `profileEncryptionVersion: "v5.5"`. Idempotent; zero-cost on already-migrated profiles.

---

## Features

- **Stealth Entry Point** — CalcX presents as a calculator. A specific numeric sequence reveals the secure workspace.
- **Post-Quantum Encryption** — Hybrid ML-KEM-768 (NIST FIPS 203) protects against harvest-now/decrypt-later attacks.
- **Sealed Sender Messaging** — The server stores no `senderId` in message documents. Sender identity is recovered client-side from the decrypted payload only.
- **Hardware-Bound Key Storage** — Keys are bound to the Secure Enclave (iOS), Android Keystore (Android), or DPAPI (Windows). Not recoverable from a backup alone.
- **Zero-Knowledge Media Vault** — Three-layer pipeline (AES-SIV → AEGIS-256 → ML-KEM-768) for encrypted 4K media.
- **Sealed Presence** — Online status transmitted as encrypted heartbeats; the server cannot correlate presence to identity.
- **Anti-Capture** — Screenshot and screen-recording blocked globally on Android, iOS, Web, and Desktop.
- **Memory Hardening** — Credentials converted to `Uint8Array` immediately on capture; physically zeroed post-authentication via `secureWipe()`.
- **Cross-Platform** — Single codebase targets Android, iOS, Web (PWA), and Desktop (Electron) via Expo SDK 54.

---

## Technology Stack

### Application Layer

| Concern | Technology |
| :--- | :--- |
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based, server-capable) |
| State | Zustand |
| Persistence | SecureStore (hardware-bound) + AsyncStorage |

### Cryptographic Layer

| Concern | Technology |
| :--- | :--- |
| PQC Primitives | `@noble/post-quantum` (ML-KEM-768 / Kyber) |
| Symmetric | `@noble/ciphers` (ChaCha20-Poly1305, AES-SIV) |
| WASM Primitives | `libsodium-wrappers` (AEGIS-256) |
| Native Acceleration | `react-native-quick-crypto` |
| Web Fallback | `SubtleCrypto` + `CryptoJS` |

### Backend & Infrastructure

| Concern | Technology |
| :--- | :--- |
| Real-time Database | Firebase Cloud Firestore |
| Authentication | Firebase Auth (Google One-Tap + Email/Password) |
| Media Storage | Firebase Storage (encrypted at-rest) |
| Hosting | Firebase Hosting |

---

## Project Structure

```text
InnerOrbit-Mobile-Web-App/
├── innerorbit-universal/          # Cross-platform application core
│   ├── app/                       # Screen routing (Expo Router)
│   ├── components/                # UI components (Calculator, Chat, Modals)
│   ├── context/                   # React Contexts (Auth, Theme, Security)
│   ├── hooks/                     # Custom hooks (usePasswordNudge, etc.)
│   ├── lib/                       # Core services and cryptographic engine
│   │   ├── encryption.ts          # Cascading encryption engine (v1–v7)
│   │   ├── firestore-service.js   # Firestore + lazy identity migration
│   │   ├── identity-security-service.ts  # v5.5 cloud identity encryption
│   │   ├── memory-hardening.ts    # RAM erasure utility (secureWipe)
│   │   ├── ratchet.ts             # Double Ratchet + PQXDH session logic
│   │   ├── legacy-decryption.ts   # Read-only shim for v1–v3 archives
│   │   └── __tests__/             # Jest test suite (168 tests)
│   ├── styles/                    # Theme system (Dark / Decoy palettes)
│   └── desktop/                   # Electron main process + auto-updater
├── download-portal/               # Firebase-hosted distribution portal
├── oracle-server-backend/         # Node.js + Oracle DB backend (planned)
├── graphify-out/                  # Knowledge graph (2,775 nodes, 5,578 edges)
├── INNERORBIT_KNOWLEDGE_BASE.md   # Definitive architectural reference
├── SECURITY_TEST_STEPS.md         # Security verification procedures
├── encryption_details.md          # Protocol deep-dive (v1–v7)
└── TO-DO-LIST.md                  # Development roadmap
```

---

## Getting Started

### Prerequisites

- Node.js v18 or later
- npm or yarn
- Expo Go (for physical device testing) or an Android/iOS emulator

### Installation

```bash
# 1. Clone and enter the application directory
git clone https://github.com/your-username/InnerOrbit-Mobile-Web-App.git
cd InnerOrbit-Mobile-Web-App/innerorbit-universal

# 2. Install dependencies
npm install

# 3. Configure environment
#    Create .env and populate with your Firebase project credentials.
#    See INNERORBIT_KNOWLEDGE_BASE.md for the full variable list.
cp .env.example .env

# 4. Start the development server
npx expo start
```

### Platform Targets

| Platform | Command | Notes |
| :--- | :--- | :--- |
| Android | `npm run android` | Requires Android Studio or a connected device |
| iOS | `npm run ios` | Requires macOS + Xcode |
| Web | `npm run web` | Opens in browser as a PWA |
| Desktop | `npm run electron:start` | Windows / macOS Electron container |

---

## Testing

```bash
cd innerorbit-universal

# Full suite (168 tests)
npm test

# Targeted: cryptographic sealed sender
npm test lib/__tests__/encryption.sealed.test.ts

# Targeted: v5.5 identity migration invariants
npm test lib/__tests__/identity-migration.test.ts
```

All tests must pass before merging to `main`. Current status: **168/168 ✅**.

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [INNERORBIT_KNOWLEDGE_BASE.md](./INNERORBIT_KNOWLEDGE_BASE.md) | Definitive architectural and semantic reference |
| [SECURITY_TEST_STEPS.md](./SECURITY_TEST_STEPS.md) | Security verification and compliance procedures |
| [encryption_details.md](./encryption_details.md) | Protocol deep-dive: v1 through v7 |
| [TO-DO-LIST.md](./TO-DO-LIST.md) | Development roadmap and phase tracking |
| [BeReady.md](./BeReady.md) | Developer education syllabus |

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

*Developed and maintained by the InnerOrbit team.*

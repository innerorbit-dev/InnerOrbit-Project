# InnerOrbit — Quantum-Safe Stealth Messenger

[![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=flat-square&logo=react)](https://reactnative.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo-54.0.33-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v12.8.0-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com/)
[![Tests](https://img.shields.io/badge/Tests-168%2F168%20passing-brightgreen?style=flat-square&logo=jest)](./innerorbit-universal/lib/__tests__)
[![Security Level](https://img.shields.io/badge/Security-Level_7_PQXDH-6d28d9?style=flat-square)](./INNERORBIT_KNOWLEDGE_BASE.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

InnerOrbit is a privacy-first messaging app with **quantum-safe encryption**. It looks like a calculator (CalcX) on the outside — type a secret code to reveal the real app. Think of it as **Signal's security + WhatsApp's experience**, built for the post-quantum era.

---

## What Makes It Special

- **Hidden Entry** — The app looks like a calculator. A secret code opens the real messenger. Nobody can tell it's a chat app by looking at your phone.
- **Quantum-Safe Encryption** — Uses ML-KEM-768 (NIST standard) to protect messages against future quantum computers that could break today's encryption.
- **No Sender Stored on Server** — The server doesn't know who sent a message. Sender info is hidden inside the encrypted message itself and only revealed when the receiver decrypts it.
- **Keys Locked in Hardware** — Your encryption keys are stored in your device's security chip (Secure Enclave on iPhone, Keystore on Android, TPM on PC). Can't be extracted even with a backup.
- **Encrypted Media Vault** — Photos and videos go through 3 layers of encryption before upload. Supports 4K quality.
- **Hidden Online Status** — Your "online" status is sent as an encrypted heartbeat. The server can't link it to your identity.
- **Screenshot Blocked** — Screenshots and screen recording are blocked on all platforms (Android, iOS, Web, Desktop).
- **Memory Protection** — Passwords are wiped from memory the moment they're used. No traces left in RAM.
- **One App, All Platforms** — Same code runs on Android, iOS, Web (PWA), and Desktop (Electron).

---

## Security Levels

The app picks the strongest encryption both people support. It never falls below AES-GCM-SIV.

| Version | Name | What It Does | How It Works |
| --- | --- | --- | --- |
| **v7** | Vault | Encrypts 4K photos/videos with 3 layers | AEGIS-256 + AES-SIV + ML-KEM-768 |
| **v6** | PQXDH | Best security for new chats (default) | Quantum Double Ratchet + ML-KEM |
| **v5.5** | Quantum Elite | Fast quantum protection for older phones | ML-KEM-768 + ChaCha20-Poly1305 |
| **v5** | Quantum Safe | Stable quantum protection | ML-KEM-768 + AES-GCM |
| **v4** | Double Ratchet | Changes the key for every message | Signal Protocol (X25519) |
| **v3.5** | Hardened SIV | Safety net — can't be broken by nonce reuse | AES-256-GCM-SIV |

Old versions (v1–v3) can still be **read** but the app will **never write** them.

---

## How Identity is Stored

| What | How it's stored | Why |
| --- | --- | --- |
| User ID | Plain text | Needs to be searchable in the database |
| PIN | Encrypted with v5.5 | Private — only the owner can decrypt it |
| Email | Plain text | Firebase Auth needs it for login |

When you log in, the app automatically checks and fixes any old-format data (one-time, no extra cost).

---

## Tech Stack

### App

| What | Technology |
| --- | --- |
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router (file-based) |
| State Management | Zustand |
| Secure Storage | SecureStore (hardware) + AsyncStorage |

### Encryption

| What | Technology |
| --- | --- |
| Quantum Protection | `@noble/post-quantum` (ML-KEM-768) |
| Fast Encryption | `@noble/ciphers` (ChaCha20, AES-SIV) |
| Media Encryption | `libsodium-wrappers` (AEGIS-256 via WASM) |
| Native Speed | `react-native-quick-crypto` |
| Web Fallback | `SubtleCrypto` + `CryptoJS` (read-only) |

### Backend

| What | Technology |
| --- | --- |
| Database | Firebase Cloud Firestore |
| Login | Firebase Auth (Google + Email/Password) |
| File Storage | Firebase Storage (encrypted at rest) |
| Web Hosting | Firebase Hosting |

---

## Project Structure

```text
InnerOrbit-Mobile-Web-App/
├── innerorbit-universal/          # The main app (shared across all platforms)
│   ├── app/                       # Screens and routes
│   ├── components/                # UI pieces (Calculator, Chat, Settings)
│   ├── context/                   # Shared state (Auth, Theme, Security)
│   ├── hooks/                     # Custom hooks
│   ├── lib/                       # Core logic and encryption engine
│   │   ├── encryption.ts          # Main encryption engine (v1–v7)
│   │   ├── firestore-service.js   # Database + identity migration
│   │   ├── identity-security-service.ts  # Cloud identity encryption
│   │   ├── memory-hardening.ts    # Wipes passwords from RAM
│   │   ├── ratchet.ts             # Double Ratchet + quantum sessions
│   │   ├── legacy-decryption.ts   # Reads old v1–v3 messages
│   │   └── __tests__/             # 168 tests
│   ├── styles/                    # Themes (Dark / Decoy)
│   └── desktop/                   # Electron (Windows/Mac desktop)
├── download-portal/               # Website for downloading the app
├── oracle-server-backend/         # Future backend (planned)
├── graphify-out/                  # Knowledge graph (2,775 nodes)
├── INNERORBIT_KNOWLEDGE_BASE.md   # Full technical reference
├── SECURITY_TEST_STEPS.md         # How to test security features
├── encryption_details.md          # Deep dive into each encryption version
└── TO-DO-LIST.md                  # What's being worked on
```

---

## Getting Started

### What You Need

- Node.js v18+
- npm or yarn
- Expo Go app (for testing on your phone) or an emulator

### Setup

```bash
# 1. Clone the project
git clone https://github.com/your-username/InnerOrbit-Mobile-Web-App.git
cd InnerOrbit-Mobile-Web-App/innerorbit-universal

# 2. Install everything
npm install

# 3. Set up your Firebase credentials
#    Copy the example file and fill in your project details
#    (See INNERORBIT_KNOWLEDGE_BASE.md for the full list)
cp .env.example .env

# 4. Start the app
npx expo start
```

### Run on Each Platform

| Platform | Command | What you need |
| --- | --- | --- |
| Android | `npm run android` | Android Studio or a connected phone |
| iOS | `npm run ios` | macOS + Xcode |
| Web | `npm run web` | Just a browser |
| Desktop | `npm run electron:start` | Windows or Mac |

---

## Running Tests

```bash
cd innerorbit-universal

# Run all 168 tests
npm test

# Test just the sealed sender encryption
npm test lib/__tests__/encryption.sealed.test.ts

# Test the identity migration system
npm test lib/__tests__/identity-migration.test.ts
```

All tests must pass before merging. Current status: **168/168 ✅**

---

## Documentation

| Document | What's inside |
| --- | --- |
| [Knowledge Base](./INNERORBIT_KNOWLEDGE_BASE.md) | Full architecture and how everything connects |
| [Security Tests](./SECURITY_TEST_STEPS.md) | Step-by-step security testing guide |
| [Encryption Details](./encryption_details.md) | How each encryption version works (v1–v7) |
| [TO-DO List](./TO-DO-LIST.md) | Current and planned work |
| [Dev Prep](./BeReady.md) | Learning resources for new developers |

---

## License

[MIT License](./LICENSE)

---

*Built and maintained by the InnerOrbit team.*

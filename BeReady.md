# University of InnerOrbit: Ecosystem Syllabus

## Course Overview

This syllabus provides a structured curriculum for mastering the InnerOrbit ecosystem. It is designed to take a developer from basic React Native fundamentals to advanced stealth mode architecture and secure communications.

> **Last Updated:** May 2026 — Reflects security hardening, GUI improvements, portal separation, and clean repo history.

---

## Chapter 0: Core Foundation Subjects

### Subject 0.1: JavaScript (ES6+) Mastery

- **Topics**: Arrow functions, Template literals, Destructuring, Promises, and Module system (import/export).
- **Concepts**: Scope, Closures, Hoisting, and the Event Loop in Node.js vs. Browser.
- **Related Implementation Examples**:
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts) (Complex Async/Await and Promises)
  - [auth-service.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/auth-service.js) (Modular function exports)

### Subject 0.2: React & React Native Essentials

- **Topics**: Virtual DOM, Component Lifecycle, Props vs State, and Reconciliation.
- **Subtopics**: Fundamental Hooks (`useState`, `useEffect`, `useContext`, `useRef`).
- **Related Implementation Examples**:
  - [auth-context.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/context/auth-context.js) (Context & provider pattern)
  - [login.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/app/login.js) (State management & Hooks in action)

### Subject 0.3: CSS, Flexbox & Theming Architecture

- **Topics**: Flexbox (Align, Justify, Direction), Absolute vs Relative positioning, and Z-index management.
- **Subtopics**: Design Tokens, Theme-aware styles, and Responsive Scaling.
- **Related Implementation Examples**:
  - [auth.styles.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/styles/auth.styles.js) (Externalized style sheets)
  - [login.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/app/login.js) (Inline responsive styling & platform overrides)

---

## Chapter 1: Foundations of Mobile Architecture

### Subject 1.1: Modern JavaScript & Component Lifecycle

- **Topics**: ES6+ Syntax, Hooks Mastery (`useMemo`, `useCallback`), and Functional Programming.
- **Subtopics**: Closures for Theme management, Async/Await for Firebase/Storage.
- **Related Files**:
  - [utils.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/utils.ts)
  - [auth-context.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/context/auth-context.js) (Provider Logic)

### Subject 1.2: Global State & Context API

- **Topics**: Provider patterns, Context consumers, and Performance optimization.
- **Subtopics**: Avoiding re-render loops in high-frequency data streams.
- **Related Files**:
  - [auth-context.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/context/auth-context.js)

---

## Chapter 2: The Stealth Ecosystem

### Subject 2.1: Calculator Masking Architecture

- **Topics**: Mode Switching, Navigation Hijacking, and Conditional Rendering.
- **Subtopics**: Mathematical evaluation logic vs. Navigation sequences.
- **Related Files**:
  - [Calculator.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/components/Calculator.js)
  - [_layout.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/app/_layout.js) (Root Router)

### Subject 2.2: Leak Prevention & Security Masking

- **Topics**: Notification Suppression, App Preview masking, and Stealth updates.
- **Subtopics**: Background sync isolation in decoy mode.
- **Related Files**:
  - [notification-service.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/notification-service.js)
  - [background-tasks.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/background-tasks.js)

---

## Chapter 3: Security & Cryptography ✅ Updated May 2026

### Subject 3.1: Secure Credential Storage

- **Topics**: Platform Secure Storage (KeyStore/KeyChain), Sync vs Async caching.
- **What changed**: Migrated `deviceKey`, `deviceSalt`, `userPassphrase` from `AsyncStorage` to `expo-secure-store` (hardware-backed). Includes auto-migration for existing users and legacy `@`-prefixed key cleanup.
- **Related Files**:
  - [secure-storage-service.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/secure-storage-service.ts)
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts) (`getSecureItem` / `setSecureItem` helpers)

### Subject 3.2: The 5-Level Encryption Stack

The app uses a tiered encryption system — each message is encrypted at the **highest level both peers support**:

| Level | Version | Algorithm | Description |
| --- | --- | --- | --- |
| **v5** | Double Ratchet | PQXDH + ML-KEM-768 + AES-256-GCM | Per-message key rotation + Quantum-safe handshake |
| **v4** | Quantum Hybrid | ML-KEM-768 + AES-256-GCM | Post-Quantum encapsulation + symmetric encrypt |
| **v3** | Elite AES-GCM | AES-256-GCM + Argon2id | Authenticated encryption with memory-hard KDF |
| **v2** | AES-GCM | AES-256-GCM + PBKDF2 | Standard authenticated encryption |
| **legacy** | AES-CBC | CryptoJS AES-CBC | Backward-compatible fallback |

- **Related Files**:
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts)
  - [ratchet.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/ratchet.ts)
  - [crypto-wrapper.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/crypto-wrapper.ts)

### Subject 3.3: Post-Quantum Cryptography (ML-KEM-768 / Kyber768)

- **Topics**: Key Encapsulation Mechanisms (KEM), Lattice-based cryptography, Hybrid key derivation.
- **How it works**:
  - On first message, sender calls `ml_kem768.encapsulate(remotePqcPublicKey)` → gets `cipherText` + `sharedSecret`
  - Receiver calls `ml_kem768.decapsulate(cipherText, ownSecretKey)` → recovers same `sharedSecret`
  - `sharedSecret` is combined with classical ECDH output via SHA-256 → hybrid key
- **Why hybrid**: If quantum computers break Kyber, classical ECDH still protects; if ECDH is broken, Kyber still protects.
- **Related Files**:
  - [crypto-wrapper.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/crypto-wrapper.ts) (`ml_kem768` export)
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts) (`getPQCKeypair`, `encrypt` v4 path)

### Subject 3.4: Double Ratchet Protocol (v5)

- **Topics**: Signal Protocol, Forward Secrecy, Break-in Recovery (Post-Compromise Security).
- **Two ratchet types**:
  - **DH Ratchet** (asymmetric): Rotates keys each time communication direction changes. Uses X25519 `diffieHellman`.
  - **Symmetric Chain Ratchet**: Rotates keys for every single message in sequence using HMAC-SHA256 (`kdfCK`).
- **KDF chains**:
  - `kdfRK(rootKey, dhOut, pqcSecret?)` — advances the Root Key chain, outputs new Root Key + Chain Key
  - `kdfCK(chainKey)` — advances a sending/receiving chain, outputs next Chain Key + Message Key
- **Out-of-order handling**: Skipped message keys are stored in `skippedMessageKeys` (max 1000) to handle delivery gaps.
- **PQ Extension**: On each DH ratchet step, a new ML-KEM-768 ciphertext (`pqcCt`) is included in the header, keeping Quantum Resistance active throughout the conversation.
- **Related Files**:
  - [ratchet.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/ratchet.ts) (`initializeRatchet`, `ratchetEncrypt`, `ratchetDecrypt`, `dhRatchet`)

### Subject 3.5: Key Derivation Functions (KDF)

- **Topics**: PBKDF2, Argon2id, HKDF patterns, salt management.
- **Argon2id** (Level 3+): Memory-hard password hashing used for user passphrases. Resists GPU/ASIC brute-force.
- **PBKDF2** (Level 2): Iterations increased from `10,000` → `210,000` (OWASP 2024 recommended for SHA-256).
- **SHA-256 as HKDF**: `createHash('sha256').update(pqcSecret).update(classicalKey).digest()` — combines PQC and classical secrets into one hybrid key.
- **Device Keys**: 32-byte random `deviceKey` + 16-byte `deviceSalt` generated once, stored in Secure Enclave.
- **Related Files**:
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts) (`getDeviceKeys`, `setUserPassphrase`)

### Subject 3.6: Encryption Version Negotiation & Telemetry

- **Topics**: Capability exchange, version resolution, graceful degradation.
- **How it works**: Each peer advertises `EncryptionCapabilities` (`v5: bool`, `minReadable`, `maxWritable`). `resolveSendVersion()` picks the highest mutually supported version.
- **Telemetry**: `sendVersion`, `fallbackReasons`, and `decryptFailures` counters tracked in-memory via `getEncryptionTelemetrySnapshot()` for debugging.
- **Related Files**:
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts) (`resolveSendVersion`, `normalizeCapabilities`, `DEFAULT_ENCRYPTION_CAPABILITIES`)

### Subject 3.7: Multi-Strategy Decryption & Platform Fallbacks

- **Topics**: Cross-platform compatibility, Web Crypto API (`SubtleCrypto`), CryptoJS fallbacks.
- **Why needed**: Native AES-256-GCM (Node.js `crypto`) behaves differently than browser `SubtleCrypto` and CryptoJS polyfills. Messages encrypted on mobile must still decrypt on web and desktop.
- **Strategy cascade for v3/v4**:
  1. Native GCM with SHA-256 hashed key
  2. Native GCM with raw hex key (legacy)
  3. CryptoJS CTR mode (GCM counter recovery: suffix `02`, `01`, `00`)
  4. CryptoJS CBC mode (last resort legacy)
  5. `SubtleCrypto` (browser-native async, for web only)
- **Web fallback format**: Ciphertext prefixed with `web:` uses CryptoJS AES-CBC with random IV + HMAC-SHA256 integrity tag.
- **Related Files**:
  - [encryption.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/encryption.ts) (`decrypt`, `decryptAsync`)
  - [ratchet.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/ratchet.ts) (`decryptWithKey`)

### Subject 3.8: Firestore Security Rules ✅ Hardened

- **Topics**: Granular access control, Document ownership validation.
- **What changed**: Removed all `|| true` clauses. Conversations now require `request.auth.uid in resource.data.participantIds`. Connection requests scoped to sender/receiver only.
- **Related Files**:
  - [firestore.rules](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/firestore.rules)

### Subject 3.9: Credential Hygiene & Git History

- **Topics**: Removing secrets from version control, orphan branch technique.
- **What changed**: Hardcoded Firebase keys removed from `firebase-config.js`. `google-services.json` added to `.gitignore`. Entire git history replaced with a single clean commit via `git checkout --orphan`.
- **Related Files**:
  - [firebase-config.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/scripts/firebase-config.js)
  - [.gitignore](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/.gitignore)

---

## Chapter 4: Real-time Communication

### Subject 4.1: Real-time Database & Firestore

- **Topics**: NoSQL Schema design, High-frequency listeners, and Pagination.
- **Subtopics**: Optimistic UI updates for instant messaging feedback.
- **Related Files**:
  - [firebase.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/firebase.js)
  - [firestore-service.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/firestore-service.js)

---

## Chapter 5: Advanced UI/UX & Reliability

### Subject 5.1: Dynamic Design System

- **Topics**: Dark/Light mode tokens, Adaptive typography, Haptic feedback.
- **Subtopics**: Glassmorphism and micro-animations in an OLED Black theme.
- **Related Files**:
  - [split-auth-layout.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/components/split-auth-layout.js)
  - [logo-base64.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/logo-base64.js)

### Subject 5.2: Error Boundaries & Debugging

- **Topics**: Global Error Catching, RedBox suppression, Production logging.
- **Related Files**:
  - [suppress-redbox.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/suppress-redbox.js)
  - [logger.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/logger.js)

---

## Chapter 6: Ecosystem & Portals ✅ Updated May 2026

### Subject 6.1: Portal Architecture

- **Topics**: Separation of concerns between the main app and download portals.
- **What changed**: Two clearly separated portals:
  - `download-portal-react/` — Vite/React portal on **port 5173**
  - `download-portal/` — Legacy static Browsersync portal on **port 5679**
- **Related Directories**:
  - [download-portal-react/](file:///c:/InnerOrbit-Mobile-Web-App/download-portal-react/)
  - [download-portal/](file:///c:/InnerOrbit-Mobile-Web-App/download-portal/)

### Subject 6.2: Node.js Backend & Updates

- **Topics**: Administrative functions, APK distribution, updates.json management.
- **Related Directories**:
  - [oracle-server-backend/](file:///c:/InnerOrbit-Mobile-Web-App/oracle-server-backend/)
  - [update-manager.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/update-manager.js)

---

## Chapter 7: Tooling & Development Workflow ✅ Updated May 2026

### Subject 7.1: manager.py — Project CLI

- **Topics**: Python-based CLI managing all builds, deployments, and dev server launches.
- **What changed**:
  - Animated ANSI splash screen with typewriter effect on startup
  - Terminal-choice prompt (current terminal / new window / GUI)
  - Fixed blank terminal bug on GUI launch (`DETACHED_PROCESS` flag)
  - Added `compat`, `gui`, `portal` CLI args
  - Option 18 now correctly launches Vite React portal (was wrongly calling Expo)
- **Related File**:
  - [manager.py](file:///c:/InnerOrbit-Mobile-Web-App/manager.py)

### Subject 7.2: GUI Project Console

- **Topics**: Tkinter-based visual manager as an alternative to the CLI.
- **What changed**:
  - Custom `GradientProgressBar` (blue to purple Canvas gradient)
  - Hover effects on all sidebar buttons
  - Richer dark/light theme color palettes
  - Added missing sidebar sections: Development, full System options
  - Responsive sidebar width binding on resize
- **Related File**:
  - [gui_manager.py](file:///c:/InnerOrbit-Mobile-Web-App/tools/gui/gui_manager.py)

### Subject 7.3: Expo & React Native Infrastructure

- **Topics**: Managed vs Bare workflow, `app.config.js` dynamic configuration, OTA updates.
- **Related Files**:
  - [app.config.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/app.config.js)
  - [package.json](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/package.json)

### Subject 7.4: Electron Desktop Framework

- **Topics**: Main Process, Renderer Process, Preload scripts, IPC.
- **Related Files**:
  - [main.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/desktop/main.js)

---

## Chapter 8: Quality Assurance & Testing ✅ Updated May 2026

### Subject 8.1: Unit Testing with Jest

- **Topics**: Test suites, Expectations, Mocking libraries, and Code Coverage.
- **What changed**: Fixed open handle issue in `network-resilience.js` (timeout IDs now cleared). Added mocks for `expo-secure-store` and `react-native` Platform. All **63 tests pass** across 7 suites.
- **Related Implementation**:
  - [lib/\_\_tests\_\_/](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/__tests__/)
  - [\_\_tests\_\_/integration/](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/__tests__/integration/)

### Subject 8.2: Firebase Integration Testing

- **Topics**: Testing Security Rules, Cloud Function triggers.
- **Related Rules**:
  - [firestore.rules](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/firestore.rules)

---

## Practical Labs & Graduation Tasks

1. **Lab 1**: Create a new secret gesture in [Calculator.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/components/Calculator.js) to trigger Stealth mode login without a PIN.
2. **Lab 2**: Implement a "Panic" function in [auth-context.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/context/auth-context.js) that wipes [SecureStorage](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/secure-storage-service.ts) and triggers a hard reset.
3. **Lab 3**: Optimize [firestore-service.js](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/firestore-service.js) to load messages in groups of 20 with smooth auto-scroll.
4. **Lab 4** *(New)*: Add a background fetch notification that alerts the user when a new APK update is available.
5. **Lab 5** *(New)*: Verify the Double Ratchet in [ratchet.ts](file:///c:/InnerOrbit-Mobile-Web-App/innerorbit-universal/lib/ratchet.ts) achieves forward secrecy across 100 sequential message exchanges.

---

*Graduation Objective: Independent development and maintenance of a highly secure, privacy-first ecosystem.*

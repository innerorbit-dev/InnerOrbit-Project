# 🛡️ InnerOrbit Comprehensive Knowledge Base

This document serves as the definitive technical guide for the InnerOrbit messaging ecosystem. It is based on a structural and semantic analysis of the codebase (May 2026) and reconciles the "Doc-Code Gap."

---

## 1. Executive Overview

InnerOrbit is a multi-layered, privacy-first messaging platform designed for maximum resilience against both conventional and quantum-scale surveillance. It features a "Stealth UI" entry point and a cascading encryption engine.

- **Primary Entry**: CalcX (Calculator Stealth Interface)
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

- `/lib/media-vault-service.ts`: **[NEW]** High-performance 3-layer media pipeline.
- `/lib/aegis-wrapper.ts`: **[NEW]** WASM-accelerated AEGIS-256 primitives for 4K media.
- `/lib/encryption.ts`: The main cascading encryption engine.
- `/lib/legacy-decryption.ts`: Isolated shim for historical protocol support (v1-v3).
- `/lib/ratchet.ts`: Signal-based Double Ratchet logic with PQC extensions.
- `/lib/firebase.js`: Production infrastructure for real-time signaling and auth.
- `/lib/device-storage-service.ts`: Handles Secure Enclave (iOS) and Strongbox (Android) bindings.

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

## 6. Known Technical Debt & Discrepancies

> [!IMPORTANT]
> **Documentation Misalignment**
> Developers should ignore references to "Production Ready v6" in `.md` files. Always reference the `ENC_VERSION_*` constants in `encryption.ts` to see what is actually toggled on in the build.

- **Double Ratchet Sync**: There is currently a "drift" in the v4 implementation between web and mobile platforms.
- **SubtleCrypto Fallback**: Web browsers use SubtleCrypto for AES-GCM, but have a fallback to CryptoJS for legacy support.

---

## 🧬 Knowledge Graph Reference

The full structural graph of the application is maintained in `graphify.json`.

- **Total Nodes**: 1,422 (Updated for Phase 7)
- **Total Edges**: 3,545

# 🌌 InnerOrbit: Universal Stealth Secure Messenger

[![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?style=for-the-badge&logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54.0.33-000020?style=for-the-badge&logo=expo)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v12.8.0-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Security: Level 5](https://img.shields.io/badge/Security-Level_5_Double_Ratchet-blueviolet?style=for-the-badge)](./innerorbit-universal/docs/ENCRYPTION_GUIDE.md)

**CalcX** is a revolutionary secure messaging platform powered by the **InnerOrbit** core. Disguised as a fully functional calculator, it provides military-grade security with a zero-compromise stealth interface.

---

## ✨ Key Features

- **🔐 Level 5 Double Ratchet Encryption**: State-of-the-art end-to-end encryption providing Perfect Forward Secrecy (PFS) and Post-Compromise Security (PCS).
- **🛡️ Quantum Resistance**: Implementation of Hybrid X3DH with ML-KEM (Kyber) to secure data against future quantum computing threats.
- **📱 Stealth Disguise**: Launches as a functional calculator; enter your secret code to reveal the hidden secure communication hub.
- **🌐 Universal Platform**: Seamlessly synchronize conversations across Android, iOS, Web, and Desktop (Windows/macOS).
- **🔋 Real-time Presence**: Instant message delivery and reliable online/offline status tracking via Firebase Cloud Firestore.
- **📁 Secure Media Storage**: Encrypted attachments and profile synchronization with zero-knowledge privacy.

---

## 🛠️ Tech Stack

### Frontend & Core
- **Framework**: [React Native](https://reactnative.dev/) via [Expo](https://expo.dev/) (SDK 54)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (Server-side routing for web/native)
- **Storage**: [SecureStore](https://docs.expo.dev/versions/latest/sdk/secure-store/) & [AsyncStorage](https://react-native-async-storage.github.io/async-storage/)

### Security & Cryptography
- **Double Ratchet**: Custom implementation for asynchronous key rotation.
- **PQC Core**: `@noble/post-quantum` (ML-KEM/Kyber).
- **Native Crypto**: `react-native-quick-crypto` for hardware-accelerated performance.
- **Web Fallback**: `crypto-js` for browser compatibility.

### Backend & Infrastructure
- **Database**: [Firebase Cloud Firestore](https://firebase.google.com/products/firestore) (Real-time syncing)
- **Auth**: [Firebase Auth](https://firebase.google.com/products/auth) (Google One-Tap integration)
- **Hosting**: [Firebase Hosting](https://firebase.google.com/products/hosting)

---

## 📸 Screenshots

| Security Onboarding | Stealth Calculator | Secured Chat |
| :---: | :---: | :---: |
| ![Placeholder](https://placehold.co/200x400/000000/FFFFFF/png?text=Security+Onboarding) | ![Placeholder](https://placehold.co/200x400/000000/FFFFFF/png?text=Stealth+Calculator) | ![Placeholder](https://placehold.co/200x400/000000/FFFFFF/png?text=Secured+Chat) |

---

## 🚀 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/client) app installed on your physical device for testing.

### Steps
1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/InnerOrbit-Mobile-Web-App.git
   cd InnerOrbit-Mobile-Web-App/innerorbit-universal
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root of `innerorbit-universal/` and add your Firebase configuration.

4. **Launch Application**
   ```bash
   # Start Expo development server
   npx expo start
   ```

---

## 💻 Usage

| Platform | Command | Notes |
| :--- | :--- | :--- |
| **Android** | `npm run android` | Requires Android Studio / Emulator |
| **iOS** | `npm run ios` | Requires macOS & Xcode |
| **Web** | `npm run web` | Launches in your default browser |
| **Desktop** | `npm run electron:start` | Launches the Electron container |

## 🎓 Developer Education
For a deep dive into the project's architecture, security protocols, and core concepts, refer to our comprehensive **University Syllabus**:

👉 **[BeReady.md](./BeReady.md)** — *Your guide from foundations to independent mastery.*

---

## 🏗️ Project Architecture & Ecosystem

```text
InnerOrbit-Mobile-Web-App/
├── BeReady.md                 # 🎓 University Syllabus (Developer Guide)
├── README.md                  # 🌌 Project Overview
├── innerorbit-universal/      # 📱 Core Platform (RN + Expo + Electron)
│   ├── app/                   # 🛣️ Screen Routing (Expo Router)
│   ├── components/            # 🧩 UI Blocks (Calculator, Masking)
│   ├── context/               # 🧠 Global State (Auth, Security)
│   ├── desktop/               # 💻 Electron Main & Preload
│   ├── lib/                   # ⚙️ Logic (Cryptography, Firebase)
│   │   └── __tests__/         # 🧪 Unit Test Suite (Jest)
│   └── styles/                # 🎨 Theme & Adaptive CSS
├── oracle-server-backend/     # ☁️ Backend (Node.js + Python)
├── download-portal-react/     # 📥 Portal (Vite + React)
├── manager.py                 # 🛠️ Project Management CLI
└── archive/                   # 🧪 R&D (Future Flutter Stacks)
```

### Core Components
- **📱 Universal App**: Single codebase for Android, iOS, Web, and Desktop via Expo.
- **☁️ Oracle Backend**: Node.js API with Oracle Autonomous DB integration and signaling.
- **📥 Portals**: Firebase and React-based gateways for distribution and onboard.
- **🛠️ Manager CLI**: Unified Python tools for building, versioning, and environment management.

---

## 📚 Project Documentation Index

For detailed technical guides and feature deep-dives, see:

- **[Project Audit](./innerorbit-universal/docs/PROJECT_AUDIT.md)**: System specifications and dependency check.
- **[Files Overview](./innerorbit-universal/docs/Files-OverView.txt)**: Comprehensive file structure and architecture.
- **[Visual Design Guide](./innerorbit-universal/docs/VISUAL_DESIGN_GUIDE.txt)**: CSS tokens and branding theme.
- **[Security Settings](./innerorbit-universal/docs/SECURITY_SETTINGS_INTEGRATION.md)**: User security and notification integration.
- **[Deployment Guide](./oracle-server-backend/DEPLOYMENT_GUIDE.md)**: Oracle Cloud production setup.
- **[Migration Plan](./docs/guides/ORACLE_MIGRATION_PLAN.md)**: Transition from Firebase to Oracle.
- **[GDPR/CCPA](./innerorbit-universal/docs/DATA-EXPORT-INTEGRATION.md)**: Data export and deletion compliance.
- **[Daily Dev Guide](./docs/guides/DAILY_DEV_GUIDE.txt)**: Commands for day-to-day development.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Developed with ❤️ by <b>InnerOrbit</b>
</p>
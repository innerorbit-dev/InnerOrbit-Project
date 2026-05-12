/** Purpose: Centralized Firebase initialization (Modular/Compat) for Auth, Firestore, and Cloud Storage. */
import './firebase-polyfills';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';
import { isWeb, isAndroid, isIOS } from '../utils/platform';
import { getApps, initializeApp, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Logger } from './logger';

const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

const firebaseConfig = {
    apiKey: isWeb 
        ? (extra.firebaseApiKeyWeb || process.env.FIREBASE_API_KEY_WEB) 
        : (isIOS ? (extra.firebaseApiKeyIos || process.env.FIREBASE_API_KEY_IOS) : (extra.firebaseApiKeyAndroid || process.env.FIREBASE_API_KEY_ANDROID || extra.firebaseApiKey)),
    authDomain: extra.firebaseAuthDomain || (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env?.FIREBASE_AUTH_DOMAIN)),
    projectId: extra.firebaseProjectId || (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || process.env?.FIREBASE_PROJECT_ID)),
    storageBucket: extra.firebaseStorageBucket || (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env?.FIREBASE_STORAGE_BUCKET)),
    messagingSenderId: extra.firebaseMessagingSenderId || (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env?.FIREBASE_MESSAGING_SENDER_ID)),
    appId: isWeb 
        ? (extra.firebaseAppIdWeb || process.env.FIREBASE_APP_ID_WEB) 
        : (isIOS ? (extra.firebaseAppIdIos || process.env.FIREBASE_APP_ID_IOS) : (extra.firebaseAppIdAndroid || process.env.FIREBASE_APP_ID_ANDROID || extra.firebaseAppId)),
    measurementId: extra.firebaseMeasurementId || (typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env?.FIREBASE_MEASUREMENT_ID)),
};

// Validate config to prevent crash
if (!firebaseConfig.apiKey) {
    Logger.trace("FIREBASE", "firebase.js", "validation", "FAILED", "Missing API Key");
} else {
    Logger.trace("FIREBASE", "firebase.js", "validation", "SUCCESS");
}

// Initialize Firebase (Compat for some libs, Modular for others)
let app;
if (firebaseConfig.apiKey) {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        Logger.trace("FIREBASE", "firebase.js", "initializeApp", "SUCCESS");
        // Also initialize compat app if not present
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            Logger.trace("FIREBASE", "firebase.js", "initializeCompat", "SUCCESS");
        }
    } else {
        app = getApp();
        Logger.trace("FIREBASE", "firebase.js", "getApp", "SUCCESS", "Using existing instance");
    }
}

// Auth Persistence Setting
let auth = null;
if (app) {
    if (isWeb) {
        auth = getAuth(app);
    } else {
        try {
            // Directly initialize with persistence for Native
            auth = initializeAuth(app, {
                persistence: getReactNativePersistence(AsyncStorage)
            });
        } catch (e) {
            // If already initialized, fallback to getAuth
            auth = getAuth(app);
        }
    }
}

// Firestore Init
let db;
if (app) {
    const firestoreSettings = {
        experimentalForceLongPolling: true,
        experimentalAutoDetectLongPolling: true, // More robust detection for restricted networks
    };

    try {
        // Diagnostic Log for Config
        Logger.log(`[Firebase] Initializing Firestore. Project: ${firebaseConfig.projectId}`);
        if (!firebaseConfig.apiKey) {
            Logger.warn("[Firebase] ⚠️ API Key is missing! Check environment variables.");
        }

        // Attempt to get existing instance first (prevents error during Fast Refresh)
        db = getFirestore(app);
        Logger.log("[Firebase] Firestore retrieved existing instance.");
    } catch (e) {
        // If getting the instance fails (e.g. first run or config change), initialize it
        db = initializeFirestore(app, firestoreSettings);
        Logger.log("[Firebase] Firestore initialized with aggressive long-polling.");
    }
} else {
    db = null;
}

// Storage Init
const storage = app ? getStorage(app) : null;

export { firebase, auth, db, storage };

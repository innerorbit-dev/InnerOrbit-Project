/**
 * Shared Firebase Configuration for maintenance scripts.
 * 🛡️ SECURITY: All values are loaded from environment variables only.
 * Copy .env.example to .env and fill in your Firebase project credentials.
 * NEVER commit real API keys to version control.
 */
require('dotenv').config();

const required = (key) => {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}. See .env.example`);
    return val;
};

module.exports = {
    apiKey:            required('FIREBASE_API_KEY'),
    authDomain:        required('FIREBASE_AUTH_DOMAIN'),
    projectId:         required('FIREBASE_PROJECT_ID'),
    storageBucket:     required('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: required('FIREBASE_MESSAGING_SENDER_ID'),
    appId:             required('FIREBASE_APP_ID'),
    measurementId:     process.env.FIREBASE_MEASUREMENT_ID || '',
};

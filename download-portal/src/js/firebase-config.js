/**
 * InnerOrbit Firebase Configuration
 * Centralized configuration for the Download Portal.
 * Note: These are client-side public keys. Security is enforced via 
 * Firestore Security Rules, not by hiding these keys.
 */

window.INNERORBIT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyBZIRJuQ4Ltn_c8ciqykG5KUvHXSFzTy_w",
    authDomain: "innerorbit-portal.firebaseapp.com",
    projectId: "innerorbit-portal",
    storageBucket: "innerorbit-portal.firebasestorage.app",
    messagingSenderId: "616184841875",
    appId: "1:616184841875:web:133ebb0b367f983e2d6f66",
    measurementId: "G-FRBP7HBBGD"
};

// Initialize Firebase if not already done
(function() {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(window.INNERORBIT_FIREBASE_CONFIG);
        window.db = firebase.firestore();
        console.log("Firebase initialized from central config.");
    }
})();

/**
 * Last Updated: 2026-03-17
 * Purpose: Updates the Firestore 'app/version' metadata and generates a local 'update.json' for APK builds.
 * This ensures the application version in the cloud matches the local package state.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Try to use service account if available, else use default (CLI authenticated)
let app;
try {
    app = initializeApp();
} catch (e) {
    console.log("Using default firebase app");
}

const db = getFirestore();

const pkg = require('../package.json');

async function updateMetadata() {
    const version = pkg.version;
    const notes = "Premium Branding & Logo Update";

    console.log(`Updating Firestore app/version to ${version}...`);

    try {
        await db.collection("app").doc("version").set({
            version: version,
            notes: notes,
            lastUpdated: new Date().toISOString(),
            releaseNotes: "Stability & Traceability Patch",
            forceUpdate: false,
            // Keep downloadUrl as is or update if needed
        }, { merge: true });
        console.log("✅ Firestore updated.");
    } catch (e) {
        console.error("❌ Firestore update failed:", e.message);
    }

    // Generate update.json for APK checks
    const updateJson = {
        version: version,
        notes: notes,
        pub_date: new Date().toISOString(),
        url: "https://firebasestorage.googleapis.com/v0/b/innerorbit-bc8ce.firebasestorage.app/o/updates%2FCalcX.apk?alt=media"
    };

    const distPath = path.join(__dirname, '..', 'dist', 'update.json');
    try {
        fs.writeFileSync(distPath, JSON.stringify(updateJson, null, 2));
        console.log(`✅ update.json created at ${distPath}`);
    } catch (e) {
        console.error("❌ Failed to create update.json:", e.message);
    }
}

updateMetadata();

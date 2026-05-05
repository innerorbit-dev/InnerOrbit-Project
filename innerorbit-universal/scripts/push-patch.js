/**
 * Last Updated: 2026-03-17
 * Purpose: Manually pushes a version patch notification to Firestore without incrementing the version number.
 * Used for triggering app update checks on users' devices after small fixes.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = require("./firebase-config");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function pushPatch() {
    try {
        console.log("🚀 Pushing new patch to Firestore...");
        const docRef = doc(db, "app", "version");
        await setDoc(docRef, {
            lastUpdated: new Date().toISOString(),
            forceUpdate: false,
            version: "1.0.0", // Keep same version
            notes: "Quick patch fix for connection requests and update logic."
        }, { merge: true });

        console.log("✅ Patch pushed successfully! Users will see the update notification on next check.");
    } catch (error) {
        console.error("❌ Failed to push patch:", error.message);
    }
    process.exit();
}

pushPatch();

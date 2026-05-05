/**
 * Last Updated: 2026-03-17
 * Purpose: Populates the initial 'app/version' document in Firestore with default values (v1.0.0).
 * Primarily used during project initialization or disaster recovery.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = require("./firebase-config");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedVersion() {
    try {
        console.log("Attempting to seed 'app/version' document...");

        const data = {
            version: "1.0.0",
            releaseNotes: "Initial Release via Secure Portal",
            downloadUrl: "https://firebasestorage.googleapis.com/v0/b/innerorbit-bc8ce.firebasestorage.app/o/dist%2FCalcX%20Desktop%20Setup%201.0.0.exe?alt=media",
            forceUpdate: false,
            lastUpdated: new Date().toISOString()
        };

        await setDoc(doc(db, "app", "version"), data);
        console.log("✅ Successfully created 'app/version' in Firestore!");
        console.log("Data written:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("❌ Failed to write document:", error.message);
        if (error.message.includes("permission-denied")) {
            console.log("⚠️ Hint: The Firestore rules might be blocking writes. Ensure you are in Test Mode or update rules.");
        }
    }
    process.exit();
}

seedVersion();

/**
 * Last Updated: 2026-03-17
 * Purpose: Diagnostic script to retrieve and log the current 'app/version' document from Firestore.
 * Used to verify the live versioning state of the application.
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = require("./firebase-config");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkVersion() {
    try {
        console.log("Checking Firestore for project: " + firebaseConfig.projectId);
        const docRef = doc(db, "app", "version");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log("Firestore Version Data:", JSON.stringify(docSnap.data(), null, 2));
        } else {
            console.log("❌ No 'app/version' document found in Firestore.");
        }
    } catch (error) {
        console.error("Error getting document:", error.message);
    }
    process.exit();
}

checkVersion();

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (This requires a service account key for automation)
// For a simpler "Manual-ish" automation, we can just use the Firebase CLI to update Firestore.

/**
 * INSTRUCTIONS:
 * 1. Go to Firebase Console > Project Settings > Service Accounts.
 * 2. Click "Generate new private key".
 * 3. Save it as 'service-account.json' in this folder.
 */

if (!fs.existsSync('./service-account.json')) {
    console.error("Error: service-account.json not found!");
    process.exit(1);
}

const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "innerorbit-20736.firebasestorage.app"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function updateRelease(version, exePath, apkPath) {
    try {
        console.log(`Starting deployment for v${version}...`);

        // Upload Files to Storage
        const uploadFile = async (localPath, destName) => {
            console.log(`Uploading ${destName}...`);
            await bucket.upload(localPath, {
                destination: destName,
                public: true,
                metadata: { cacheControl: 'public, max-age=31536000' }
            });
            // Construct the public URL (Firebase Storage standard format)
            return `https://storage.googleapis.com/${bucket.name}/${destName}`;
        };

        const windowsUrl = await uploadFile(exePath, `releases/CalcX-v${version}.exe`);
        const androidUrl = await uploadFile(apkPath, `releases/CalcX-v${version}.apk`);

        // Update Firestore
        console.log("Updating Firestore metadata...");
        await db.collection('app_metadata').doc('latest').set({
            version: version,
            windows_url: windowsUrl,
            android_url: androidUrl,
            last_updated: new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            })
        });

        console.log("Success! Portal is now updated.");
    } catch (error) {
        console.error("Deployment failed:", error);
    }
}

// Usage: node update-metadata.js 1.0.1 path/to/app.exe path/to/app.apk
const [, , version, exe, apk] = process.argv;
if (!version || !exe || !apk) {
    console.log("Usage: node update-metadata.js <version> <exePath> <apkPath>");
} else {
    updateRelease(version, exe, apk);
}

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, deleteDoc, collection } = require('firebase/firestore');
const crypto = require('crypto');

// Firebase Configuration (Same as your project)
const firebaseConfig = { 
    apiKey: "AIzaSyBVx0nM88cwGAc84TZd4osHBFOYs1AnZG0", 
    authDomain: "innerorbit-bc8ce.firebaseapp.com", 
    projectId: "innerorbit-bc8ce", 
    storageBucket: "innerorbit-bc8ce.firebasestorage.app", 
    messagingSenderId: "585637111095", 
    appId: "1:585637111095:web:97baabc9aa04ff81dd26b2", 
    measurementId: "G-Y5VSJKN8J7" 
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setupPassword(password) {
    if (!password) {
        console.error('Please provide a password.');
        process.exit(1);
    }

    console.log(`Setting up portal password: "${password}"`);
    
    // Create SHA-256 hash
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    console.log(`Hash generated: ${hash}`);

    try {
        console.log('Connecting to Firestore...');
        
        // 1. CLEAR OLD PASSWORDS
        console.log('Scanning for old passwords...');
        const querySnapshot = await getDocs(collection(db, "portal_passwords"));
        
        if (!querySnapshot.empty) {
            console.log(`Found ${querySnapshot.size} existing password(s). Removing...`);
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                // Don't delete if it's already the same password (optional optimization, but safer to just clean up)
                if (doc.id === hash) {
                    console.log('   - This password is already active.');
                } else {
                    console.log(`   - Deleting old hash: ${doc.id.substring(0, 10)}...`);
                    deletePromises.push(deleteDoc(doc.ref));
                }
            });
            await Promise.all(deletePromises);
        }

        // 2. SET NEW PASSWORD
        const docRef = doc(db, "portal_passwords", hash);
        await setDoc(docRef, {
            active: true,
            created_at: new Date().toISOString(),
            label: "Main Portal Access"
        });
        
        console.log('\x1b[32m%s\x1b[0m', 'SUCCESS: Password updated!');
        console.log('You can now log in to the portal with: ' + password);
        process.exit(0);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'ERROR: Failed to update Firestore.');
        console.error(error.message);
        console.log('\nTip: Make sure your Firestore rules allow writes during setup.');
        process.exit(1);
    }
}

// Get password from command line or use default
const pass = process.argv[2] || "KSP12@#";
setupPassword(pass);

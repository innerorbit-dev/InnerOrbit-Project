const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, deleteDoc, collection } = require('firebase/firestore');
const crypto = require('crypto');
const readline = require('readline');
const { exec } = require('child_process');

// Firebase Configuration (Targeting innerorbit-portal)
const firebaseConfig = {
    apiKey: "AIzaSyBZIRJuQ4Ltn_c8ciqykG5KUvHXSFzTy_w",
    authDomain: "innerorbit-portal.firebaseapp.com",
    projectId: "innerorbit-portal",
    storageBucket: "innerorbit-portal.firebasestorage.app",
    messagingSenderId: "616184841875",
    appId: "1:616184841875:web:133ebb0b367f983e2d6f66",
    measurementId: "G-FRBP7HBBGD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}║   InnerOrbit Password Update Tool     ║${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);
console.log(`${colors.blue}Mode: Firestore Secure Update${colors.reset}\n`);

// Ask for new password
rl.question(`${colors.yellow}Enter your new password: ${colors.reset}`, async (newPassword) => {

    if (!newPassword || newPassword.trim() === '') {
        console.log(`${colors.red}❌ Error: Password cannot be empty!${colors.reset}`);
        rl.close();
        process.exit(1);
    }

    // Generate SHA-256 hash
    const hash = crypto.createHash('sha256').update(newPassword).digest('hex');

    console.log(`\n${colors.green}✓ Password hash generated!${colors.reset}`);
    console.log(`${colors.blue}Hash: ${colors.bright}${hash}${colors.reset}\n`);

    try {
        console.log('Connecting to Firestore...');

        // 1. CLEAR OLD PASSWORDS
        console.log('Scanning for old passwords...');
        const querySnapshot = await getDocs(collection(db, "portal_passwords"));

        if (!querySnapshot.empty) {
            console.log(`Found ${querySnapshot.size} existing password(s). Removing...`);
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
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

        console.log(`\n${colors.green}✓ Password updated in Firestore!${colors.reset}\n`);

        // Show next steps
        console.log(`${colors.bright}${colors.cyan}Next Steps:${colors.reset}`);
        console.log(`${colors.yellow}1.${colors.reset} Test your new password at:`);
        console.log(`   ${colors.bright}https://InnerOrbit-c938b.web.app${colors.reset}`);
        console.log(`\n${colors.green}✓ Password: ${colors.bright}${newPassword}${colors.reset}\n`);

        // Note: Deployment is not strictly necessary for Firestore data changes, 
        // but might be good if we want to sync other changes.
        rl.question(`${colors.yellow}Do you want to redeploy the site (optional)? (y/n): ${colors.reset}`, (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                console.log(`\n${colors.cyan}Deploying to Firebase...${colors.reset}\n`);

                exec('firebase deploy --only hosting', (error, stdout, stderr) => {
                    if (error) {
                        console.log(`${colors.red}❌ Deployment failed: ${error.message}${colors.reset}`);
                        rl.close();
                        process.exit(1);
                        return;
                    }

                    console.log(stdout);
                    console.log(`\n${colors.green}${colors.bright}✓ Deployment complete!${colors.reset}\n`);
                    rl.close();
                    process.exit(0);
                });
            } else {
                console.log(`\n${colors.yellow}Skipping deployment. Password is active immediately.${colors.reset}\n`);
                rl.close();
                process.exit(0);
            }
        });

    } catch (error) {
        console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
        rl.close();
        process.exit(1);
    }
});

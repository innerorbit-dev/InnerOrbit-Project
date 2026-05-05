/**
 * Last Updated: 2026-03-17
 * Purpose: Audits the Firestore 'users' collection to check for existing user profiles. 
 * This helps verify if Firestore write rules or logic are correctly creating/blocking profiles.
 */
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const firebaseConfig = require("./firebase-config");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
    console.log("Checking for users in project:", firebaseConfig.projectId);
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        if (querySnapshot.empty) {
            console.log("❌ No user profiles found in 'users' collection.");
            console.log("This confirms that while Auth accounts may exist, the Firestore profiles were blocked.");
        } else {
            console.log(`✅ Found ${querySnapshot.size} user profile(s).`);
            querySnapshot.forEach((doc) => {
                console.log(` - ID: ${doc.id}, Data:`, JSON.stringify(doc.data()));
            });
        }
    } catch (error) {
        console.error("Error checking users:", error.message);
    }
}

checkUsers();

// Last Updated: 2026-03-17
// Description: Development utility: verify-unread.js
// Project Role: Development and testing utility for unread highlights.
const { sendMessage, resetUnreadCount, getConversationBetweenUsers, createConversation } = require('../innerorbit-universal/lib/firestore-service');
const { auth, db } = require('../innerorbit-universal/lib/firebase');
const { doc, getDoc, deleteDoc } = require('firebase/firestore');

// Mock Auth
const mockUserA = { uid: 'test-user-a', email: 'a@test.com' };
const mockUserB = { uid: 'test-user-b', email: 'b@test.com' };

async function verifyUnreadLogic() {
  console.log("🚀 Starting Unread Count Verification...");
  
  try {
    // 1. Create a test conversation
    console.log("Creating test conversation...");
    const convId = await createConversation(mockUserA.uid, mockUserB.uid);
    console.log(`Conv ID: ${convId}`);

    // 2. User A sends message to User B
    console.log("User A sending message to User B...");
    await sendMessage(convId, mockUserA.uid, "Hello Test", null, 0, 'text', 0);

    // 3. Verify User B has unread count 1
    const convRef = doc(db, 'conversations', convId);
    let snap = await getDoc(convRef);
    let data = snap.data();
    const bCount = data[`unreadCount_${mockUserB.uid}`] || 0;
    
    if (bCount === 1) {
      console.log("✅ SUCCESS: User B unread count incremented correctly.");
    } else {
      console.error(`❌ FAILURE: User B unread count is ${bCount}, expected 1.`);
    }

    // 4. Reset User B unread count
    console.log("Resetting User B unread count...");
    await resetUnreadCount(convId, mockUserB.uid);

    // 5. Verify reset
    snap = await getDoc(convRef);
    data = snap.data();
    const bCountReset = data[`unreadCount_${mockUserB.uid}`];
    
    if (bCountReset === 0) {
      console.log("✅ SUCCESS: User B unread count reset successfully.");
    } else {
      console.error(`❌ FAILURE: User B unread count is ${bCountReset}, expected 0.`);
    }

    // Cleanup
    console.log("Cleaning up test conversation...");
    await deleteDoc(convRef);
    console.log("✅ Verification Complete.");

  } catch (error) {
    console.error("❌ ERROR during verification:", error);
  }
}

// Note: This script requires a running firebase environment or admin mock
// In this environment, we can't run it directly without node-firebase-mock 
// or valid project credentials. I'll provide it as a reference for the user.
console.log("Verification script ready. Run via 'node verify-unread.js' if environment allows.");

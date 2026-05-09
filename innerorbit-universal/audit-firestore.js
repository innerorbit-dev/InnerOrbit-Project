const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // I'll check if this exists

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function auditMessages() {
  console.log("--- 🕵️ Firestore Security Audit: Conversations & Messages ---");
  
  // 1. Find a conversation
  const convSnap = await db.collection('conversations').limit(1).get();
  if (convSnap.empty) {
    console.log("No conversations found.");
    return;
  }

  const convDoc = convSnap.docs[0];
  const conversationId = convDoc.id;
  console.log(`\n📂 Auditing Conversation: ${conversationId}`);
  console.log(`   Participants: ${JSON.stringify(convDoc.data().participantIds)}`);
  console.log(`   Last Message Sender: ${convDoc.data().lastMessageSenderId || '🚫 HIDDEN (SEALED)'}`);

  // 2. Audit messages in subcollection
  const snapshot = await db.collection('conversations').doc(conversationId).collection('messages').limit(5).get();
  if (snapshot.empty) {
    console.log("No messages found in this conversation.");
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\n   📄 Message ID: ${doc.id}`);
    console.log(`      Sender ID: ${data.senderId || '🚫 MISSING (SEALED)'}`);
    console.log(`      Encrypted Text: ${data.encryptedText ? data.encryptedText.substring(0, 40) + '...' : '❌ NO TEXT'}`);
    
    const isEnc = data.encryptedText && (
        data.encryptedText.startsWith('v1:') || 
        data.encryptedText.startsWith('v3:') || 
        data.encryptedText.startsWith('v5:') || 
        data.encryptedText.startsWith('v6:')
    );
    console.log(`      Is Encrypted?: ${isEnc ? '✅ YES' : '❌ NO'}`);
    
    // Check for sensitive leakage
    const keys = Object.keys(data);
    const leaked = keys.filter(k => !['encryptedText', 'timestamp', 'id', 'type', 'status', 'expiresAt', 'scheduledAt', 'senderId'].includes(k));
    if (leaked.length > 0) {
        console.log(`      ⚠️ Metadata Leakage in fields: ${leaked.join(', ')}`);
    } else {
        console.log(`      ✅ No metadata leakage detected.`);
    }
  });
}

auditMessages().catch(console.error);

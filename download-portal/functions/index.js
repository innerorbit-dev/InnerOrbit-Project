const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

// Store master password hash in environment variable (set via Firebase CLI)
// Run: firebase functions:config:set portal.password_hash="YOUR_HASH_HERE"
const MASTER_PASSWORD_HASH = functions.config().portal?.password_hash || '64d92ebb1118715932c061a0a84c4467c8484f977c1';

// Rate limiting configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 300; // 5 minutes in seconds

/**
 * Hash password using SHA-256
 */
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify portal access password
 * POST /verifyPortalAccess
 * Body: { password: string }
 */
exports.verifyPortalAccess = functions.https.onCall(async (data, context) => {
    const { password } = data;
    const clientIP = context.rawRequest.ip;

    if (!password) {
        throw new functions.https.HttpsError('invalid-argument', 'Password is required');
    }

    try {
        // Check rate limiting
        const attemptsRef = admin.firestore()
            .collection('portalAttempts')
            .doc(clientIP);

        const attemptsDoc = await attemptsRef.get();
        const attemptsData = attemptsDoc.data() || { count: 0, lockedUntil: null };

        // Check if locked out
        if (attemptsData.lockedUntil && attemptsData.lockedUntil.toDate() > new Date()) {
            const remainingSeconds = Math.ceil((attemptsData.lockedUntil.toDate() - new Date()) / 1000);
            throw new functions.https.HttpsError(
                'permission-denied',
                `Too many failed attempts. Try again in ${Math.ceil(remainingSeconds / 60)} minutes.`
            );
        }

        // Verify password
        const passwordHash = hashPassword(password);
        const isValid = passwordHash === MASTER_PASSWORD_HASH;

        if (isValid) {
            // Success - reset attempts and create session
            await attemptsRef.set({
                count: 0,
                lockedUntil: null,
                lastSuccess: admin.firestore.FieldValue.serverTimestamp()
            });

            // Create access token (valid for 1 hour)
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour

            await admin.firestore()
                .collection('portalSessions')
                .doc(sessionToken)
                .set({
                    ip: clientIP,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                    userAgent: context.rawRequest.headers['user-agent']
                });

            // Log successful access
            await admin.firestore()
                .collection('portalAccessLogs')
                .add({
                    ip: clientIP,
                    success: true,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    userAgent: context.rawRequest.headers['user-agent']
                });

            return {
                success: true,
                sessionToken: sessionToken,
                expiresAt: expiresAt.toISOString()
            };

        } else {
            // Failed attempt
            const newCount = (attemptsData.count || 0) + 1;
            const updateData = {
                count: newCount,
                lastAttempt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Lock out if too many attempts
            if (newCount >= MAX_ATTEMPTS) {
                updateData.lockedUntil = admin.firestore.Timestamp.fromDate(
                    new Date(Date.now() + LOCKOUT_DURATION * 1000)
                );
            }

            await attemptsRef.set(updateData, { merge: true });

            // Log failed attempt
            await admin.firestore()
                .collection('portalAccessLogs')
                .add({
                    ip: clientIP,
                    success: false,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    userAgent: context.rawRequest.headers['user-agent']
                });

            throw new functions.https.HttpsError(
                'permission-denied',
                `Incorrect password. ${MAX_ATTEMPTS - newCount} attempts remaining.`
            );
        }

    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('Verification error:', error);
        throw new functions.https.HttpsError('internal', 'Verification failed');
    }
});

/**
 * Verify session token
 * POST /verifySession
 * Body: { sessionToken: string }
 */
exports.verifySession = functions.https.onCall(async (data, context) => {
    const { sessionToken } = data;

    if (!sessionToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Session token is required');
    }

    try {
        const sessionDoc = await admin.firestore()
            .collection('portalSessions')
            .doc(sessionToken)
            .get();

        if (!sessionDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Invalid session');
        }

        const sessionData = sessionDoc.data();
        const now = new Date();

        if (sessionData.expiresAt.toDate() < now) {
            // Session expired
            await sessionDoc.ref.delete();
            throw new functions.https.HttpsError('permission-denied', 'Session expired');
        }

        return {
            valid: true,
            expiresAt: sessionData.expiresAt.toDate().toISOString()
        };

    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('Session verification error:', error);
        throw new functions.https.HttpsError('internal', 'Session verification failed');
    }
});

/**
 * Get access logs (admin only)
 * Requires admin authentication
 */
exports.getAccessLogs = functions.https.onCall(async (data, context) => {
    // Check if user is authenticated as admin
    if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { limit = 50, startAfter = null } = data;

    try {
        let query = admin.firestore()
            .collection('portalAccessLogs')
            .orderBy('timestamp', 'desc')
            .limit(limit);

        if (startAfter) {
            const startDoc = await admin.firestore()
                .collection('portalAccessLogs')
                .doc(startAfter)
                .get();
            query = query.startAfter(startDoc);
        }

        const snapshot = await query.get();
        const logs = [];

        snapshot.forEach(doc => {
            logs.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate().toISOString()
            });
        });

        return { logs };

    } catch (error) {
        console.error('Get logs error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to retrieve logs');
    }
});

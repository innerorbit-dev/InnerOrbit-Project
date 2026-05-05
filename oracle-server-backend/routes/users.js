const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../utils/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * Get user profile by UID
 * GET /api/users/profile/:uid
 */
router.get('/profile/:uid', authenticateToken, async (req, res) => {
    try {
        const { uid } = req.params;

        const result = await db.execute(
            `SELECT uid, email, user_id, pin, bio, photo_url, is_online, last_seen, created_at
             FROM users WHERE uid = :uid`,
            { uid }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = {
            uid: result.rows[0][0],
            email: result.rows[0][1],
            userId: result.rows[0][2],
            pin: result.rows[0][3],
            bio: result.rows[0][4],
            photoURL: result.rows[0][5],
            isOnline: result.rows[0][6] === 1,
            lastSeen: result.rows[0][7],
            createdAt: result.rows[0][8]
        };

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user profile'
        });
    }
});

/**
 * Update user profile
 * PUT /api/users/profile/:uid
 */
router.put('/profile/:uid', authenticateToken, async (req, res) => {
    try {
        const { uid } = req.params;
        const { bio, photoURL } = req.body;

        // Verify user is updating their own profile
        if (req.user.uid !== uid) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to update this profile'
            });
        }

        const updates = [];
        const binds = { uid };

        if (bio !== undefined) {
            updates.push('bio = :bio');
            binds.bio = bio;
        }

        if (photoURL !== undefined) {
            updates.push('photo_url = :photoURL');
            binds.photoURL = photoURL;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No updates provided'
            });
        }

        await db.execute(
            `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE uid = :uid`,
            binds
        );

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

/**
 * Search users by email or userId
 * POST /api/users/search
 */
router.post('/search', authenticateToken, async (req, res) => {
    try {
        const { query, searchType } = req.body;

        if (!query || !searchType) {
            return res.status(400).json({
                success: false,
                message: 'Query and searchType required'
            });
        }

        let sql, binds;

        if (searchType === 'email') {
            sql = `SELECT uid, email, user_id, bio, photo_url, is_online, last_seen
                   FROM users WHERE LOWER(email) = LOWER(:query)`;
            binds = { query };
        } else if (searchType === 'userId') {
            sql = `SELECT uid, email, user_id, bio, photo_url, is_online, last_seen
                   FROM users WHERE user_id = :query`;
            binds = { query: parseInt(query) };
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid searchType. Use "email" or "userId"'
            });
        }

        const result = await db.execute(sql, binds);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                users: []
            });
        }

        const users = result.rows.map(row => ({
            uid: row[0],
            email: row[1],
            userId: row[2],
            bio: row[3],
            photoURL: row[4],
            isOnline: row[5] === 1,
            lastSeen: row[6]
        }));

        res.json({
            success: true,
            users
        });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search users'
        });
    }
});

/**
 * Update user presence (online/offline status)
 * PUT /api/users/presence/:uid
 */
router.put('/presence/:uid', authenticateToken, async (req, res) => {
    try {
        const { uid } = req.params;
        const { isOnline } = req.body;

        // Verify user is updating their own presence
        if (req.user.uid !== uid) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to update this presence'
            });
        }

        await db.execute(
            `UPDATE users 
             SET is_online = :isOnline, last_seen = CURRENT_TIMESTAMP
             WHERE uid = :uid`,
            {
                uid,
                isOnline: isOnline ? 1 : 0
            }
        );

        res.json({
            success: true,
            message: 'Presence updated successfully'
        });
    } catch (error) {
        console.error('Error updating presence:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update presence'
        });
    }
});

/**
 * Get user presence
 * GET /api/users/presence/:uid
 */
router.get('/presence/:uid', authenticateToken, async (req, res) => {
    try {
        const { uid } = req.params;

        const result = await db.execute(
            `SELECT is_online, last_seen FROM users WHERE uid = :uid`,
            { uid }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            isOnline: result.rows[0][0] === 1,
            lastSeen: result.rows[0][1]
        });
    } catch (error) {
        console.error('Error fetching presence:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch presence'
        });
    }
});

/**
 * Delete user account
 * DELETE /api/users/:uid
 */
router.delete('/:uid', authenticateToken, async (req, res) => {
    try {
        const { uid } = req.params;

        // Verify user is deleting their own account
        if (req.user.uid !== uid) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to delete this account'
            });
        }

        // Delete user (CASCADE will handle related data)
        await db.execute(
            `DELETE FROM users WHERE uid = :uid`,
            { uid }
        );

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account'
        });
    }
});

/**
 * Save contact nickname
 * PUT /api/users/nickname
 */
router.put('/nickname', authenticateToken, async (req, res) => {
    try {
        const { contactUid, nickname } = req.body;
        const userId = req.user.uid;

        if (!contactUid || !nickname) {
            return res.status(400).json({
                success: false,
                message: 'contactUid and nickname required'
            });
        }

        await db.execute(
            `MERGE INTO contact_nicknames cn
             USING DUAL ON (cn.user_id = :userId AND cn.contact_uid = :contactUid)
             WHEN MATCHED THEN
                UPDATE SET nickname = :nickname, updated_at = CURRENT_TIMESTAMP
             WHEN NOT MATCHED THEN
                INSERT (user_id, contact_uid, nickname)
                VALUES (:userId, :contactUid, :nickname)`,
            { userId, contactUid, nickname }
        );

        res.json({
            success: true,
            message: 'Nickname saved successfully'
        });
    } catch (error) {
        console.error('Error saving nickname:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save nickname'
        });
    }
});

/**
 * Get all contact nicknames for a user
 * GET /api/users/nicknames
 */
router.get('/nicknames', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const result = await db.execute(
            `SELECT contact_uid, nickname FROM contact_nicknames WHERE user_id = :userId`,
            { userId }
        );

        const nicknames = {};
        result.rows.forEach(row => {
            nicknames[row[0]] = row[1];
        });

        res.json({
            success: true,
            nicknames
        });
    } catch (error) {
        console.error('Error fetching nicknames:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch nicknames'
        });
    }
});

module.exports = router;

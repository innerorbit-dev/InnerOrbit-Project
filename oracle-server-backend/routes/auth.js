const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('../utils/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * User Signup (Email + Password)
 * POST /api/auth/signup
 * Generates unique userId and PIN like Firebase implementation
 */
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        // Check if email already exists
        const existingUser = await db.execute(
            `SELECT uid FROM users WHERE LOWER(email) = LOWER(:email)`,
            { email }
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Generate unique userId (4 digits)
        let userId;
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const candidateId = Math.floor(1000 + Math.random() * 9000);

            const checkId = await db.execute(
                `SELECT user_id FROM users WHERE user_id = :userId`,
                { userId: candidateId }
            );

            if (checkId.rows.length === 0) {
                userId = candidateId;
                break;
            }
            attempts++;
        }

        if (!userId) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate unique user ID'
            });
        }

        // Generate unique PIN (6 digits)
        let pin;
        attempts = 0;

        while (attempts < maxAttempts) {
            const candidatePin = Math.floor(100000 + Math.random() * 900000);

            const checkPin = await db.execute(
                `SELECT pin FROM users WHERE pin = :pin`,
                { pin: candidatePin }
            );

            if (checkPin.rows.length === 0) {
                pin = candidatePin;
                break;
            }
            attempts++;
        }

        if (!pin) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate unique PIN'
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const uid = uuidv4();

        await db.execute(
            `INSERT INTO users (uid, email, user_id, pin, password_hash)
             VALUES (:uid, :email, :userId, :pin, :passwordHash)`,
            {
                uid,
                email,
                userId,
                pin,
                passwordHash: hashedPassword
            }
        );

        // Generate JWT token
        const token = generateToken({ uid, email, userId });

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: {
                uid,
                email,
                userId,
                pin
            },
            token
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create account'
        });
    }
});

/**
 * User Login (Email + Password OR UserId + PIN)
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password, userId, pin } = req.body;

        let user;

        // Email/Password login
        if (email && password) {
            const result = await db.execute(
                `SELECT uid, email, user_id, pin, password_hash, bio, photo_url
                 FROM users WHERE LOWER(email) = LOWER(:email)`,
                { email }
            );

            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const row = result.rows[0];
            const passwordHash = row[4];

            // Verify password
            const isValid = await verifyPassword(password, passwordHash);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            user = {
                uid: row[0],
                email: row[1],
                userId: row[2],
                pin: row[3],
                bio: row[5],
                photoURL: row[6]
            };
        }
        // UserId/PIN login
        else if (userId && pin) {
            const result = await db.execute(
                `SELECT uid, email, user_id, pin, bio, photo_url
                 FROM users WHERE user_id = :userId AND pin = :pin`,
                { userId: parseInt(userId), pin: parseInt(pin) }
            );

            if (result.rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const row = result.rows[0];
            user = {
                uid: row[0],
                email: row[1],
                userId: row[2],
                pin: row[3],
                bio: row[4],
                photoURL: row[5]
            };
        }
        else {
            return res.status(400).json({
                success: false,
                message: 'Provide either (email + password) or (userId + pin)'
            });
        }

        // Update presence to online
        await db.execute(
            `UPDATE users SET is_online = 1, last_seen = CURRENT_TIMESTAMP WHERE uid = :uid`,
            { uid: user.uid }
        );

        // Generate JWT token
        const token = generateToken({ uid: user.uid, email: user.email, userId: user.userId });

        res.json({
            success: true,
            message: 'Login successful',
            user,
            token
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

/**
 * Verify JWT Token
 * POST /api/auth/verify
 */
router.post('/verify', authenticateToken, async (req, res) => {
    try {
        // Token is valid (verified by middleware)
        const { uid } = req.user;

        // Get fresh user data
        const result = await db.execute(
            `SELECT uid, email, user_id, pin, bio, photo_url, is_online, last_seen
             FROM users WHERE uid = :uid`,
            { uid }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const row = result.rows[0];
        const user = {
            uid: row[0],
            email: row[1],
            userId: row[2],
            pin: row[3],
            bio: row[4],
            photoURL: row[5],
            isOnline: row[6] === 1,
            lastSeen: row[7]
        };

        res.json({
            success: true,
            valid: true,
            user
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({
            success: false,
            message: 'Token verification failed'
        });
    }
});

/**
 * Logout
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const { uid } = req.user;

        // Update presence to offline
        await db.execute(
            `UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE uid = :uid`,
            { uid }
        );

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

/**
 * Change Password
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const { uid } = req.user;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current and new password required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters'
            });
        }

        // Get current password hash
        const result = await db.execute(
            `SELECT password_hash FROM users WHERE uid = :uid`,
            { uid }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const currentHash = result.rows[0][0];

        // Verify current password
        const isValid = await verifyPassword(currentPassword, currentHash);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const newHash = await hashPassword(newPassword);

        // Update password
        await db.execute(
            `UPDATE users SET password_hash = :newHash WHERE uid = :uid`,
            { uid, newHash }
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

/**
 * Change PIN
 * POST /api/auth/change-pin
 */
router.post('/change-pin', authenticateToken, async (req, res) => {
    try {
        const { currentPin, newPin } = req.body;
        const { uid } = req.user;

        if (!currentPin || !newPin) {
            return res.status(400).json({
                success: false,
                message: 'Current and new PIN required'
            });
        }

        if (newPin.toString().length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'PIN must be 6 digits'
            });
        }

        // Verify current PIN
        const result = await db.execute(
            `SELECT pin FROM users WHERE uid = :uid AND pin = :currentPin`,
            { uid, currentPin: parseInt(currentPin) }
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Current PIN is incorrect'
            });
        }

        // Check if new PIN is already in use
        const pinCheck = await db.execute(
            `SELECT uid FROM users WHERE pin = :newPin AND uid != :uid`,
            { newPin: parseInt(newPin), uid }
        );

        if (pinCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'PIN already in use'
            });
        }

        // Update PIN
        await db.execute(
            `UPDATE users SET pin = :newPin WHERE uid = :uid`,
            { uid, newPin: parseInt(newPin) }
        );

        res.json({
            success: true,
            message: 'PIN changed successfully'
        });
    } catch (error) {
        console.error('Error changing PIN:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change PIN'
        });
    }
});

module.exports = router;

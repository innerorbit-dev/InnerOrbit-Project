const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// SHA-256 hash function (for portal password - matches frontend)
function sha256(message) {
    return crypto.createHash('sha256').update(message).digest('hex');
}

// Verify portal password (for download portal)
function verifyPortalPassword(password) {
    const passwordHash = sha256(password);
    const correctHash = process.env.PORTAL_PASSWORD_HASH;
    return passwordHash === correctHash;
}

// Hash password using bcrypt (for user accounts)
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

// Verify password using bcrypt (for user accounts)
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Generate JWT token for authenticated users
function generateToken(payload) {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }

    req.user = decoded;
    next();
}

module.exports = {
    sha256,
    verifyPortalPassword,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    authenticateToken
};

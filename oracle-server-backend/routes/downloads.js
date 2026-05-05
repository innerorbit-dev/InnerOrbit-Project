const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { verifyToken } = require('../utils/auth');
const db = require('../config/database');

// Middleware to verify token
const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    req.sessionId = decoded.sessionId;
    next();
};

// GET /api/downloads/list
router.get('/list', authenticate, async (req, res) => {
    try {
        const downloads = [
            {
                id: 'android',
                name: 'Android APK',
                platform: 'android',
                version: '1.0.0',
                size: '25 MB',
                icon: '📱',
                description: 'Download for Android devices (Android 6.0+)',
                url: 'https://your-storage.com/cipherplay.apk'
            },
            {
                id: 'windows',
                name: 'Windows App',
                platform: 'windows',
                version: '1.0.0',
                size: '45 MB',
                icon: '💻',
                description: 'Download for Windows computers (Windows 10/11)',
                url: 'https://your-storage.com/cipherplay.exe'
            }
        ];

        res.json({
            success: true,
            downloads
        });

    } catch (error) {
        console.error('List downloads error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// POST /api/downloads/track
router.post('/track', authenticate, async (req, res) => {
    try {
        const { platform, fileName } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;

        if (!platform) {
            return res.status(400).json({
                success: false,
                message: 'Platform is required'
            });
        }

        const pool = db.getPool();
        const connection = await pool.getConnection();

        try {
            await connection.execute(
                `INSERT INTO downloads (download_id, session_id, file_name, platform, downloaded_at, ip_address)
                 VALUES (:downloadId, :sessionId, :fileName, :platform, CURRENT_TIMESTAMP, :ip)`,
                {
                    downloadId: uuidv4(),
                    sessionId: req.sessionId,
                    fileName: fileName || `cipherplay-${platform}`,
                    platform,
                    ip: clientIP
                },
                { autoCommit: true }
            );

            res.json({
                success: true,
                message: 'Download tracked successfully'
            });
        } finally {
            await connection.close();
        }

    } catch (error) {
        console.error('Track download error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// GET /api/downloads/stats (Admin only - for future use)
router.get('/stats', authenticate, async (req, res) => {
    try {
        const pool = db.getPool();
        const connection = await pool.getConnection();

        try {
            const result = await connection.execute(
                `SELECT 
                    platform,
                    COUNT(*) as download_count,
                    MAX(downloaded_at) as last_download
                 FROM downloads
                 GROUP BY platform
                 ORDER BY download_count DESC`
            );

            const stats = result.rows.map(row => ({
                platform: row[0],
                downloadCount: row[1],
                lastDownload: row[2]
            }));

            res.json({
                success: true,
                stats
            });
        } finally {
            await connection.close();
        }

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;

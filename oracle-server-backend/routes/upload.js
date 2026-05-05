const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../utils/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images only
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images allowed.'));
        }
    }
});

/**
 * Upload profile picture
 * POST /api/upload/profile-picture
 */
router.post('/profile-picture', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user.uid;
        const fileId = uuidv4();
        const fileUrl = `/uploads/${req.file.filename}`;

        // Save to database
        await db.execute(
            `INSERT INTO file_uploads (id, user_id, file_type, file_url, file_size, mime_type, context_type)
             VALUES (:id, :userId, :fileType, :fileUrl, :fileSize, :mimeType, :contextType)`,
            {
                id: fileId,
                userId,
                fileType: 'profile_picture',
                fileUrl,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                contextType: 'profile'
            }
        );

        // Update user profile
        await db.execute(
            `UPDATE users SET photo_url = :photoUrl WHERE uid = :userId`,
            { photoUrl: fileUrl, userId }
        );

        res.json({
            success: true,
            message: 'Profile picture uploaded successfully',
            fileUrl,
            fileId
        });
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload profile picture'
        });
    }
});

/**
 * Upload chat image
 * POST /api/upload/chat-image
 */
router.post('/chat-image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const { conversationId } = req.body;
        if (!conversationId) {
            return res.status(400).json({
                success: false,
                message: 'conversationId required'
            });
        }

        const userId = req.user.uid;
        const fileId = uuidv4();
        const fileUrl = `/uploads/${req.file.filename}`;

        // Verify user is participant in conversation
        const convCheck = await db.execute(
            `SELECT participant_1, participant_2 FROM conversations WHERE id = :conversationId`,
            { conversationId }
        );

        if (convCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const [p1, p2] = convCheck.rows[0];
        if (userId !== p1 && userId !== p2) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Save to database
        await db.execute(
            `INSERT INTO file_uploads (id, user_id, file_type, file_url, file_size, mime_type, context_type, context_id)
             VALUES (:id, :userId, :fileType, :fileUrl, :fileSize, :mimeType, :contextType, :contextId)`,
            {
                id: fileId,
                userId,
                fileType: 'chat_image',
                fileUrl,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                contextType: 'conversation',
                contextId: conversationId
            }
        );

        res.json({
            success: true,
            message: 'Image uploaded successfully',
            fileUrl,
            fileId
        });
    } catch (error) {
        console.error('Error uploading chat image:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image'
        });
    }
});

/**
 * Delete uploaded file
 * DELETE /api/upload/:fileId
 */
router.delete('/:fileId', authenticateToken, async (req, res) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.uid;

        // Get file info
        const result = await db.execute(
            `SELECT user_id, file_url FROM file_uploads WHERE id = :fileId`,
            { fileId }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        const [fileUserId, fileUrl] = result.rows[0];

        // Verify ownership
        if (fileUserId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Delete from filesystem
        const filePath = path.join(__dirname, '..', fileUrl);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            console.error('Error deleting file from disk:', error);
        }

        // Delete from database
        await db.execute(
            `DELETE FROM file_uploads WHERE id = :fileId`,
            { fileId }
        );

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete file'
        });
    }
});

/**
 * Get user's uploaded files
 * GET /api/upload/my-files
 */
router.get('/my-files', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const result = await db.execute(
            `SELECT id, file_type, file_url, file_size, mime_type, context_type, uploaded_at
             FROM file_uploads
             WHERE user_id = :userId
             ORDER BY uploaded_at DESC`,
            { userId }
        );

        const files = result.rows.map(row => ({
            id: row[0],
            fileType: row[1],
            fileUrl: row[2],
            fileSize: row[3],
            mimeType: row[4],
            contextType: row[5],
            uploadedAt: row[6]
        }));

        res.json({
            success: true,
            files
        });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch files'
        });
    }
});

module.exports = router;

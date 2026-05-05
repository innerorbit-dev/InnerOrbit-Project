const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../utils/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all conversations for a user
 * GET /api/conversations/list/:userId
 */
router.get('/list/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user is requesting their own conversations
        if (req.user.uid !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const result = await db.execute(
            `SELECT c.id, c.participant_1, c.participant_2, c.last_message, 
                    c.last_message_time, c.last_message_id, c.last_message_sender_id,
                    c.last_message_status, c.created_at,
                    u1.email AS p1_email, u1.user_id AS p1_user_id, u1.photo_url AS p1_photo,
                    u2.email AS p2_email, u2.user_id AS p2_user_id, u2.photo_url AS p2_photo
             FROM conversations c
             JOIN users u1 ON c.participant_1 = u1.uid
             JOIN users u2 ON c.participant_2 = u2.uid
             WHERE c.participant_1 = :userId OR c.participant_2 = :userId
             ORDER BY c.last_message_time DESC NULLS LAST`,
            { userId }
        );

        const conversations = result.rows.map(row => ({
            id: row[0],
            participantIds: [row[1], row[2]],
            lastMessage: row[3],
            lastMessageTime: row[4],
            lastMessageId: row[5],
            lastMessageSenderId: row[6],
            lastMessageStatus: row[7],
            createdAt: row[8],
            participants: {
                [row[1]]: {
                    email: row[9],
                    userId: row[10],
                    photoURL: row[11]
                },
                [row[2]]: {
                    email: row[12],
                    userId: row[13],
                    photoURL: row[14]
                }
            }
        }));

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations'
        });
    }
});

/**
 * Create a new conversation
 * POST /api/conversations/create
 */
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { userId1, userId2 } = req.body;

        if (!userId1 || !userId2) {
            return res.status(400).json({
                success: false,
                message: 'Both userId1 and userId2 required'
            });
        }

        if (userId1 === userId2) {
            return res.status(400).json({
                success: false,
                message: 'Cannot create conversation with yourself'
            });
        }

        // Verify requester is one of the participants
        if (req.user.uid !== userId1 && req.user.uid !== userId2) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Check if conversation already exists
        const existingResult = await db.execute(
            `SELECT id FROM conversations
             WHERE (participant_1 = :userId1 AND participant_2 = :userId2)
                OR (participant_1 = :userId2 AND participant_2 = :userId1)`,
            { userId1, userId2 }
        );

        if (existingResult.rows.length > 0) {
            return res.json({
                success: true,
                conversationId: existingResult.rows[0][0],
                message: 'Conversation already exists'
            });
        }

        // Create new conversation
        const conversationId = uuidv4();

        await db.execute(
            `INSERT INTO conversations (id, participant_1, participant_2)
             VALUES (:id, :participant_1, :participant_2)`,
            {
                id: conversationId,
                participant_1: userId1,
                participant_2: userId2
            }
        );

        res.json({
            success: true,
            conversationId,
            message: 'Conversation created successfully'
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create conversation'
        });
    }
});

/**
 * Get conversation details
 * GET /api/conversations/:conversationId
 */
router.get('/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;

        const result = await db.execute(
            `SELECT c.id, c.participant_1, c.participant_2, c.last_message,
                    c.last_message_time, c.created_at,
                    u1.email AS p1_email, u1.user_id AS p1_user_id,
                    u2.email AS p2_email, u2.user_id AS p2_user_id
             FROM conversations c
             JOIN users u1 ON c.participant_1 = u1.uid
             JOIN users u2 ON c.participant_2 = u2.uid
             WHERE c.id = :conversationId`,
            { conversationId }
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const row = result.rows[0];

        // Verify user is a participant
        if (req.user.uid !== row[1] && req.user.uid !== row[2]) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const conversation = {
            id: row[0],
            participantIds: [row[1], row[2]],
            lastMessage: row[3],
            lastMessageTime: row[4],
            createdAt: row[5],
            participants: {
                [row[1]]: {
                    email: row[6],
                    userId: row[7]
                },
                [row[2]]: {
                    email: row[8],
                    userId: row[9]
                }
            }
        };

        res.json({
            success: true,
            conversation
        });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conversation'
        });
    }
});

/**
 * Delete a conversation
 * DELETE /api/conversations/:conversationId
 */
router.delete('/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Verify user is a participant
        const checkResult = await db.execute(
            `SELECT participant_1, participant_2 FROM conversations WHERE id = :conversationId`,
            { conversationId }
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const [p1, p2] = checkResult.rows[0];
        if (req.user.uid !== p1 && req.user.uid !== p2) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Delete conversation (CASCADE will delete messages)
        await db.execute(
            `DELETE FROM conversations WHERE id = :conversationId`,
            { conversationId }
        );

        res.json({
            success: true,
            message: 'Conversation deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete conversation'
        });
    }
});

/**
 * Get conversation between two specific users
 * POST /api/conversations/between
 */
router.post('/between', authenticateToken, async (req, res) => {
    try {
        const { userId1, userId2 } = req.body;

        if (!userId1 || !userId2) {
            return res.status(400).json({
                success: false,
                message: 'Both userId1 and userId2 required'
            });
        }

        // Verify requester is one of the participants
        if (req.user.uid !== userId1 && req.user.uid !== userId2) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const result = await db.execute(
            `SELECT id FROM conversations
             WHERE (participant_1 = :userId1 AND participant_2 = :userId2)
                OR (participant_1 = :userId2 AND participant_2 = :userId1)`,
            { userId1, userId2 }
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                conversation: null
            });
        }

        res.json({
            success: true,
            conversationId: result.rows[0][0]
        });
    } catch (error) {
        console.error('Error finding conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to find conversation'
        });
    }
});

module.exports = router;

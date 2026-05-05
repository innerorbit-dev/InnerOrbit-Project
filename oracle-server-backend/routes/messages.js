const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../utils/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all messages in a conversation
 * GET /api/messages/:conversationId
 */
router.get('/:conversationId', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.uid;

        // Verify user is a participant
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

        // Get messages (excluding hidden ones for this user)
        const result = await db.execute(
            `SELECT m.id, m.sender_id, m.encrypted_text, m.message_type, m.status,
                    m.reply_to_id, m.reply_to_text, m.reply_to_sender,
                    m.expires_at, m.is_deleted, m.is_edited, m.timestamp
             FROM messages m
             WHERE m.conversation_id = :conversationId
               AND NOT EXISTS (
                   SELECT 1 FROM hidden_messages h
                   WHERE h.message_id = m.id AND h.user_id = :userId
               )
             ORDER BY m.timestamp ASC`,
            { conversationId, userId }
        );

        // Get reactions for all messages
        const messageIds = result.rows.map(row => row[0]);
        let reactions = {};

        if (messageIds.length > 0) {
            const reactResult = await db.execute(
                `SELECT message_id, emoji, user_id
                 FROM message_reactions
                 WHERE message_id IN (${messageIds.map((_, i) => `:id${i}`).join(',')})`,
                messageIds.reduce((acc, id, i) => ({ ...acc, [`id${i}`]: id }), {})
            );

            reactResult.rows.forEach(row => {
                const [msgId, emoji, uid] = row;
                if (!reactions[msgId]) reactions[msgId] = {};
                if (!reactions[msgId][emoji]) reactions[msgId][emoji] = [];
                reactions[msgId][emoji].push(uid);
            });
        }

        const messages = result.rows.map(row => ({
            id: row[0],
            senderId: row[1],
            encryptedText: row[2],
            type: row[3],
            status: row[4],
            replyTo: row[5] ? {
                id: row[5],
                text: row[6],
                senderName: row[7]
            } : null,
            expiresAt: row[8],
            isDeleted: row[9] === 1,
            isEdited: row[10] === 1,
            timestamp: row[11],
            reactions: reactions[row[0]] || {}
        }));

        res.json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
});

/**
 * Send a new message
 * POST /api/messages/send
 */
router.post('/send', authenticateToken, async (req, res) => {
    try {
        const {
            conversationId,
            encryptedText,
            type = 'text',
            replyTo = null,
            expirySeconds = 0
        } = req.body;

        const senderId = req.user.uid;

        if (!conversationId || !encryptedText) {
            return res.status(400).json({
                success: false,
                message: 'conversationId and encryptedText required'
            });
        }

        // Verify user is a participant
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
        if (senderId !== p1 && senderId !== p2) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const messageId = uuidv4();
        const timestamp = new Date();

        // Calculate expiry if needed
        let expiresAt = null;
        if (expirySeconds > 0) {
            expiresAt = new Date(timestamp.getTime() + (expirySeconds * 1000));
        }

        // Insert message
        await db.execute(
            `INSERT INTO messages (
                id, conversation_id, sender_id, encrypted_text, message_type,
                reply_to_id, reply_to_text, reply_to_sender, expires_at, timestamp
             ) VALUES (
                :id, :conversationId, :senderId, :encryptedText, :type,
                :replyToId, :replyToText, :replyToSender, :expiresAt, :timestamp
             )`,
            {
                id: messageId,
                conversationId,
                senderId,
                encryptedText,
                type,
                replyToId: replyTo?.id || null,
                replyToText: replyTo?.text || null,
                replyToSender: replyTo?.senderName || null,
                expiresAt,
                timestamp
            }
        );

        // Update conversation last message
        await db.execute(
            `UPDATE conversations
             SET last_message = :lastMessage,
                 last_message_time = :timestamp,
                 last_message_id = :messageId,
                 last_message_sender_id = :senderId,
                 last_message_status = 'sent'
             WHERE id = :conversationId`,
            {
                lastMessage: type === 'image' ? '📷 Image' : encryptedText,
                timestamp,
                messageId,
                senderId,
                conversationId
            }
        );

        res.json({
            success: true,
            messageId,
            timestamp
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
});

/**
 * Update a message (Edit)
 * PUT /api/messages/:messageId
 */
router.put('/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { encryptedText } = req.body;
        const userId = req.user.uid;

        if (!encryptedText) {
            return res.status(400).json({
                success: false,
                message: 'encryptedText required'
            });
        }

        // Verify user is the sender
        const msgCheck = await db.execute(
            `SELECT sender_id FROM messages WHERE id = :messageId`,
            { messageId }
        );

        if (msgCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        if (msgCheck.rows[0][0] !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await db.execute(
            `UPDATE messages
             SET encrypted_text = :encryptedText, is_edited = 1
             WHERE id = :messageId`,
            { messageId, encryptedText }
        );

        res.json({
            success: true,
            message: 'Message updated successfully'
        });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update message'
        });
    }
});

/**
 * Delete message for everyone
 * DELETE /api/messages/:messageId
 */
router.delete('/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.uid;

        // Verify user is the sender
        const msgCheck = await db.execute(
            `SELECT sender_id FROM messages WHERE id = :messageId`,
            { messageId }
        );

        if (msgCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        if (msgCheck.rows[0][0] !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        await db.execute(
            `UPDATE messages
             SET is_deleted = 1, encrypted_text = ''
             WHERE id = :messageId`,
            { messageId }
        );

        res.json({
            success: true,
            message: 'Message deleted for everyone'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message'
        });
    }
});

/**
 * Delete message for me (hide)
 * POST /api/messages/:messageId/hide
 */
router.post('/:messageId/hide', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.uid;

        // Check if message exists
        const msgCheck = await db.execute(
            `SELECT id FROM messages WHERE id = :messageId`,
            { messageId }
        );

        if (msgCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Add to hidden messages
        await db.execute(
            `INSERT INTO hidden_messages (message_id, user_id)
             VALUES (:messageId, :userId)`,
            { messageId, userId },
            { autoCommit: false }
        );

        await db.commit();

        res.json({
            success: true,
            message: 'Message hidden successfully'
        });
    } catch (error) {
        // Ignore duplicate key errors
        if (error.errorNum === 1) {
            return res.json({
                success: true,
                message: 'Message already hidden'
            });
        }

        console.error('Error hiding message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to hide message'
        });
    }
});

/**
 * Toggle reaction on a message
 * POST /api/messages/:messageId/react
 */
router.post('/:messageId/react', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user.uid;

        if (!emoji) {
            return res.status(400).json({
                success: false,
                message: 'emoji required'
            });
        }

        // Check if reaction exists
        const existingReact = await db.execute(
            `SELECT 1 FROM message_reactions
             WHERE message_id = :messageId AND user_id = :userId AND emoji = :emoji`,
            { messageId, userId, emoji }
        );

        if (existingReact.rows.length > 0) {
            // Remove reaction
            await db.execute(
                `DELETE FROM message_reactions
                 WHERE message_id = :messageId AND user_id = :userId AND emoji = :emoji`,
                { messageId, userId, emoji }
            );

            res.json({
                success: true,
                action: 'removed',
                message: 'Reaction removed'
            });
        } else {
            // Add reaction
            await db.execute(
                `INSERT INTO message_reactions (message_id, user_id, emoji)
                 VALUES (:messageId, :userId, :emoji)`,
                { messageId, userId, emoji }
            );

            res.json({
                success: true,
                action: 'added',
                message: 'Reaction added'
            });
        }
    } catch (error) {
        console.error('Error toggling reaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle reaction'
        });
    }
});

/**
 * Mark message as read
 * PUT /api/messages/:messageId/read
 */
router.put('/:messageId/read', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;

        await db.execute(
            `UPDATE messages SET status = 'read' WHERE id = :messageId`,
            { messageId }
        );

        // Update conversation if this is the last message
        await db.execute(
            `UPDATE conversations
             SET last_message_status = 'read'
             WHERE last_message_id = :messageId`,
            { messageId }
        );

        res.json({
            success: true,
            message: 'Message marked as read'
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark message as read'
        });
    }
});

module.exports = router;

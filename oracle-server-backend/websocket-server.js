const WebSocket = require('ws');
const { verifyToken } = require('./utils/auth');

/**
 * WebSocket Server for Real-time Updates
 * Replaces Firebase onSnapshot listeners
 */

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map(); // userId -> WebSocket connection
        this.setupServer();
    }

    setupServer() {
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection');

            // Authenticate connection
            const token = this.extractToken(req);
            if (!token) {
                ws.close(1008, 'Authentication required');
                return;
            }

            const user = verifyToken(token);
            if (!user) {
                ws.close(1008, 'Invalid token');
                return;
            }

            // Store connection
            this.clients.set(user.uid, ws);
            console.log(`User ${user.uid} connected via WebSocket`);

            // Handle messages from client
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(user.uid, data);
                } catch (error) {
                    console.error('Invalid WebSocket message:', error);
                }
            });

            // Handle disconnect
            ws.on('close', () => {
                this.clients.delete(user.uid);
                console.log(`User ${user.uid} disconnected from WebSocket`);
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                userId: user.uid,
                timestamp: new Date().toISOString()
            }));
        });
    }

    extractToken(req) {
        const url = new URL(req.url, 'ws://localhost');
        return url.searchParams.get('token');
    }

    handleClientMessage(userId, data) {
        console.log(`Message from ${userId}:`, data);

        switch (data.type) {
            case 'subscribe_presence':
                // Client wants to subscribe to a user's presence
                this.subscribeToPresence(userId, data.targetUserId);
                break;
            case 'subscribe_conversation':
                // Client wants to subscribe to conversation updates
                this.subscribeToConversation(userId, data.conversationId);
                break;
            case 'ping':
                // Heartbeat
                this.sendToUser(userId, { type: 'pong', timestamp: Date.now() });
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    // Send message to specific user
    sendToUser(userId, data) {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // Broadcast to multiple users
    broadcastToUsers(userIds, data) {
        userIds.forEach(userId => {
            this.sendToUser(userId, data);
        });
    }

    // Notify about new message
    notifyNewMessage(conversationId, message, participantIds) {
        this.broadcastToUsers(participantIds, {
            type: 'new_message',
            conversationId,
            message,
            timestamp: new Date().toISOString()
        });
    }

    // Notify about message update
    notifyMessageUpdate(conversationId, messageId, updates, participantIds) {
        this.broadcastToUsers(participantIds, {
            type: 'message_updated',
            conversationId,
            messageId,
            updates,
            timestamp: new Date().toISOString()
        });
    }

    // Notify about message deletion
    notifyMessageDeleted(conversationId, messageId, participantIds) {
        this.broadcastToUsers(participantIds, {
            type: 'message_deleted',
            conversationId,
            messageId,
            timestamp: new Date().toISOString()
        });
    }

    // Notify about reaction
    notifyReaction(conversationId, messageId, emoji, userId, action, participantIds) {
        this.broadcastToUsers(participantIds, {
            type: 'reaction',
            conversationId,
            messageId,
            emoji,
            userId,
            action, // 'added' or 'removed'
            timestamp: new Date().toISOString()
        });
    }

    // Notify about presence change
    notifyPresenceChange(userId, isOnline) {
        // Broadcast to all connected users (or implement friend list logic)
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'presence_changed',
                    userId,
                    isOnline,
                    timestamp: new Date().toISOString()
                }));
            }
        });
    }

    // Notify about conversation update
    notifyConversationUpdate(conversationId, updates, participantIds) {
        this.broadcastToUsers(participantIds, {
            type: 'conversation_updated',
            conversationId,
            updates,
            timestamp: new Date().toISOString()
        });
    }

    // Subscribe to presence (placeholder - implement with DB polling if needed)
    subscribeToPresence(userId, targetUserId) {
        // In a full implementation, you'd set up DB polling or triggers
        // For now, just acknowledge
        this.sendToUser(userId, {
            type: 'subscribed',
            subscription: 'presence',
            targetUserId
        });
    }

    // Subscribe to conversation (placeholder)
    subscribeToConversation(userId, conversationId) {
        this.sendToUser(userId, {
            type: 'subscribed',
            subscription: 'conversation',
            conversationId
        });
    }

    // Get online users count
    getOnlineCount() {
        return this.clients.size;
    }

    // Get all connected user IDs
    getOnlineUsers() {
        return Array.from(this.clients.keys());
    }
}

module.exports = WebSocketServer;

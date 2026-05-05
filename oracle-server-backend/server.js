require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const db = require('./config/database');
const WebSocketServer = require('./websocket-server');

// Import routes
const authRoutes = require('./routes/auth');
const downloadRoutes = require('./routes/downloads');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server (needed for WebSocket)
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);
console.log('✅ WebSocket server initialized');

// Make WebSocket server available to routes
app.set('wsServer', wsServer);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || 900000),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        websocket: {
            connected: wsServer.getOnlineCount(),
            users: wsServer.getOnlineUsers()
        }
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'InnerOrbit Portal API',
        version: '1.0.0',
        status: 'Running',
        websocket: {
            url: `ws://localhost:${PORT}`,
            connected: wsServer.getOnlineCount()
        },
        endpoints: {
            auth: {
                signup: 'POST /api/auth/signup',
                login: 'POST /api/auth/login',
                verify: 'POST /api/auth/verify',
                logout: 'POST /api/auth/logout',
                changePassword: 'POST /api/auth/change-password',
                changePIN: 'POST /api/auth/change-pin'
            },
            users: {
                profile: 'GET /api/users/profile/:uid',
                updateProfile: 'PUT /api/users/profile/:uid',
                search: 'POST /api/users/search',
                presence: 'PUT /api/users/presence/:uid',
                delete: 'DELETE /api/users/:uid'
            },
            conversations: {
                list: 'GET /api/conversations/list/:userId',
                create: 'POST /api/conversations/create',
                get: 'GET /api/conversations/:id',
                delete: 'DELETE /api/conversations/:id'
            },
            messages: {
                list: 'GET /api/messages/:conversationId',
                send: 'POST /api/messages/send',
                update: 'PUT /api/messages/:messageId',
                delete: 'DELETE /api/messages/:messageId',
                react: 'POST /api/messages/:messageId/react'
            },
            uploads: {
                profilePicture: 'POST /api/upload/profile-picture',
                chatImage: 'POST /api/upload/chat-image',
                myFiles: 'GET /api/upload/my-files',
                deleteFile: 'DELETE /api/upload/:fileId'
            },
            downloads: {
                list: 'GET /api/downloads/list',
                track: 'POST /api/downloads/track',
                stats: 'GET /api/downloads/stats'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database connection
        await db.initialize();

        // Start HTTP server (includes WebSocket)
        server.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════╗');
            console.log('║   InnerOrbit Portal API Server         ║');
            console.log('╚════════════════════════════════════════╝');
            console.log('');
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`✅ Environment: ${process.env.NODE_ENV}`);
            console.log(`✅ Database: Connected`);
            console.log(`✅ WebSocket: Active`);
            console.log('');
            console.log(`🌐 API URL: http://localhost:${PORT}`);
            console.log(`📊 Health: http://localhost:${PORT}/health`);
            console.log(`🔌 WebSocket: ws://localhost:${PORT}?token=YOUR_JWT_TOKEN`);
            console.log('');
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    await db.close();
    process.exit(0);
});

// Start the server
startServer();


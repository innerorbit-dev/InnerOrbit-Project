require('dotenv').config();
const oracledb = require('oracledb');
const db = require('../config/database');

async function initializeDatabase() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   Database Initialization Script       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    try {
        await db.initialize();
        const pool = db.getPool();
        const connection = await pool.getConnection();

        console.log('Creating tables...\n');

        // Create sessions table
        try {
            await connection.execute(`
                CREATE TABLE sessions (
                    session_id VARCHAR2(36) PRIMARY KEY,
                    token_hash VARCHAR2(500) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    ip_address VARCHAR2(45),
                    user_agent VARCHAR2(500)
                )
            `);
            console.log('✅ Created table: sessions');
        } catch (err) {
            if (err.errorNum === 955) {
                console.log('⚠️  Table already exists: sessions');
            } else {
                throw err;
            }
        }

        // Create downloads table
        try {
            await connection.execute(`
                CREATE TABLE downloads (
                    download_id VARCHAR2(36) PRIMARY KEY,
                    session_id VARCHAR2(36),
                    file_name VARCHAR2(255) NOT NULL,
                    platform VARCHAR2(50),
                    downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ip_address VARCHAR2(45),
                    CONSTRAINT fk_session FOREIGN KEY (session_id) 
                        REFERENCES sessions(session_id) ON DELETE CASCADE
                )
            `);
            console.log('✅ Created table: downloads');
        } catch (err) {
            if (err.errorNum === 955) {
                console.log('⚠️  Table already exists: downloads');
            } else {
                throw err;
            }
        }

        // Create login_attempts table
        try {
            await connection.execute(`
                CREATE TABLE login_attempts (
                    attempt_id VARCHAR2(36) PRIMARY KEY,
                    ip_address VARCHAR2(45),
                    success NUMBER(1) DEFAULT 0,
                    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Created table: login_attempts');
        } catch (err) {
            if (err.errorNum === 955) {
                console.log('⚠️  Table already exists: login_attempts');
            } else {
                throw err;
            }
        }

        // Create indexes
        console.log('\nCreating indexes...\n');

        try {
            await connection.execute(`
                CREATE INDEX idx_sessions_expires ON sessions(expires_at)
            `);
            console.log('✅ Created index: idx_sessions_expires');
        } catch (err) {
            if (err.errorNum === 955) {
                console.log('⚠️  Index already exists: idx_sessions_expires');
            }
        }

        try {
            await connection.execute(`
                CREATE INDEX idx_downloads_platform ON downloads(platform)
            `);
            console.log('✅ Created index: idx_downloads_platform');
        } catch (err) {
            if (err.errorNum === 955) {
                console.log('⚠️  Index already exists: idx_downloads_platform');
            }
        }

        try {
            await connection.execute(`
                CREATE INDEX idx_login_attempts_ip ON login_attempts(ip_address)
            `);
            console.log('✅ Created index: idx_login_attempts_ip');
        } catch (err) {
            if (err.errorNum === 955) {
                console.log('⚠️  Index already exists: idx_login_attempts_ip');
            }
        }

        await connection.close();
        await db.close();

        console.log('\n╔════════════════════════════════════════╗');
        console.log('║   Database Initialization Complete!   ║');
        console.log('╚════════════════════════════════════════╝');
        console.log('');

    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        process.exit(1);
    }
}

initializeDatabase();

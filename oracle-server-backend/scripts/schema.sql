-- =====================================================
-- InnerOrbit Complete Database Schema for Oracle
-- =====================================================
-- This schema supports full app migration from Firebase
-- Includes: Users, Conversations, Messages, Reactions, etc.
-- =====================================================

-- ============ USERS TABLE ============
CREATE TABLE users (
    uid VARCHAR2(128) PRIMARY KEY,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password_hash VARCHAR2(255),
    user_id NUMBER(4) UNIQUE NOT NULL,
    pin NUMBER(6) NOT NULL,
    bio CLOB,
    photo_url VARCHAR2(500),
    is_online NUMBER(1) DEFAULT 0,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_online ON users(is_online);

-- ============ CONVERSATIONS TABLE ============
CREATE TABLE conversations (
    id VARCHAR2(128) PRIMARY KEY,
    participant_1 VARCHAR2(128) NOT NULL,
    participant_2 VARCHAR2(128) NOT NULL,
    last_message CLOB,
    last_message_time TIMESTAMP,
    last_message_id VARCHAR2(128),
    last_message_sender_id VARCHAR2(128),
    last_message_status VARCHAR2(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conv_p1 FOREIGN KEY (participant_1) REFERENCES users(uid) ON DELETE CASCADE,
    CONSTRAINT fk_conv_p2 FOREIGN KEY (participant_2) REFERENCES users(uid) ON DELETE CASCADE,
    CONSTRAINT chk_diff_participants CHECK (participant_1 != participant_2)
);

-- Indexes for conversation queries
CREATE INDEX idx_conv_p1 ON conversations(participant_1);
CREATE INDEX idx_conv_p2 ON conversations(participant_2);
CREATE INDEX idx_conv_last_msg_time ON conversations(last_message_time DESC);

-- ============ MESSAGES TABLE ============
CREATE TABLE messages (
    id VARCHAR2(128) PRIMARY KEY,
    conversation_id VARCHAR2(128) NOT NULL,
    sender_id VARCHAR2(128) NOT NULL,
    encrypted_text CLOB NOT NULL,
    message_type VARCHAR2(20) DEFAULT 'text',
    status VARCHAR2(20) DEFAULT 'sent',
    reply_to_id VARCHAR2(128),
    reply_to_text CLOB,
    reply_to_sender VARCHAR2(255),
    expires_at TIMESTAMP,
    is_deleted NUMBER(1) DEFAULT 0,
    is_edited NUMBER(1) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(uid) ON DELETE CASCADE,
    CONSTRAINT chk_msg_type CHECK (message_type IN ('text', 'image')),
    CONSTRAINT chk_msg_status CHECK (status IN ('sent', 'delivered', 'read'))
);

-- Indexes for message queries
CREATE INDEX idx_msg_conv ON messages(conversation_id);
CREATE INDEX idx_msg_sender ON messages(sender_id);
CREATE INDEX idx_msg_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_msg_expires ON messages(expires_at);

-- ============ MESSAGE REACTIONS TABLE ============
CREATE TABLE message_reactions (
    message_id VARCHAR2(128) NOT NULL,
    user_id VARCHAR2(128) NOT NULL,
    emoji VARCHAR2(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_reactions PRIMARY KEY (message_id, user_id, emoji),
    CONSTRAINT fk_react_msg FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_react_user FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- ============ HIDDEN MESSAGES TABLE ============
-- Tracks which messages are hidden for specific users (Delete for Me)
CREATE TABLE hidden_messages (
    message_id VARCHAR2(128) NOT NULL,
    user_id VARCHAR2(128) NOT NULL,
    hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_hidden PRIMARY KEY (message_id, user_id),
    CONSTRAINT fk_hidden_msg FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_hidden_user FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
);

-- ============ CONTACT NICKNAMES TABLE ============
CREATE TABLE contact_nicknames (
    user_id VARCHAR2(128) NOT NULL,
    contact_uid VARCHAR2(128) NOT NULL,
    nickname VARCHAR2(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_nicknames PRIMARY KEY (user_id, contact_uid),
    CONSTRAINT fk_nick_user FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
    CONSTRAINT fk_nick_contact FOREIGN KEY (contact_uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- ============ SESSIONS TABLE (Already exists, keeping for portal) ============
-- This table is used for portal authentication
-- CREATE TABLE sessions (
--     session_id VARCHAR2(128) PRIMARY KEY,
--     user_ip VARCHAR2(45),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     expires_at TIMESTAMP NOT NULL
-- );

-- ============ FILE UPLOADS TABLE ============
CREATE TABLE file_uploads (
    id VARCHAR2(128) PRIMARY KEY,
    user_id VARCHAR2(128) NOT NULL,
    file_type VARCHAR2(20) NOT NULL,
    file_url VARCHAR2(500) NOT NULL,
    file_size NUMBER,
    mime_type VARCHAR2(100),
    context_type VARCHAR2(50),
    context_id VARCHAR2(128),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_upload_user FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE,
    CONSTRAINT chk_file_type CHECK (file_type IN ('profile_picture', 'chat_image', 'other'))
);

CREATE INDEX idx_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_uploads_context ON file_uploads(context_type, context_id);

-- ============ TRIGGERS FOR AUTO-UPDATE ============

-- Trigger to update 'updated_at' on users table
CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Trigger to update 'updated_at' on contact_nicknames
CREATE OR REPLACE TRIGGER trg_nicknames_updated_at
BEFORE UPDATE ON contact_nicknames
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- ============ SEQUENCES FOR AUTO-INCREMENT ============

-- Sequence for generating unique user IDs (4 digits: 1000-9999)
CREATE SEQUENCE seq_user_id
    START WITH 1000
    INCREMENT BY 1
    MAXVALUE 9999
    NOCYCLE
    CACHE 20;

-- Sequence for generating unique PINs (6 digits: 100000-999999)
CREATE SEQUENCE seq_pin
    START WITH 100000
    INCREMENT BY 1
    MAXVALUE 999999
    CYCLE
    CACHE 50;

-- ============ VIEWS FOR COMMON QUERIES ============

-- View: Active conversations with participant details
CREATE OR REPLACE VIEW v_active_conversations AS
SELECT 
    c.id,
    c.participant_1,
    c.participant_2,
    c.last_message,
    c.last_message_time,
    c.last_message_status,
    u1.email AS p1_email,
    u1.user_id AS p1_user_id,
    u1.photo_url AS p1_photo,
    u2.email AS p2_email,
    u2.user_id AS p2_user_id,
    u2.photo_url AS p2_photo
FROM conversations c
JOIN users u1 ON c.participant_1 = u1.uid
JOIN users u2 ON c.participant_2 = u2.uid
WHERE c.last_message_time IS NOT NULL
ORDER BY c.last_message_time DESC;

-- View: Online users
CREATE OR REPLACE VIEW v_online_users AS
SELECT uid, email, user_id, photo_url, last_seen
FROM users
WHERE is_online = 1
ORDER BY last_seen DESC;

-- ============ CLEANUP PROCEDURES ============

-- Procedure to delete expired messages
CREATE OR REPLACE PROCEDURE cleanup_expired_messages AS
BEGIN
    DELETE FROM messages
    WHERE expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP;
    
    COMMIT;
END;
/

-- Procedure to cleanup old sessions (if using sessions table)
CREATE OR REPLACE PROCEDURE cleanup_expired_sessions AS
BEGIN
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    COMMIT;
END;
/

-- ============ SAMPLE DATA (FOR TESTING) ============

-- Insert test user (optional - remove in production)
-- INSERT INTO users (uid, email, user_id, pin, bio)
-- VALUES ('test-uid-001', 'test@innerorbit.com', 1001, 123456, 'Test user for development');

COMMIT;

-- ============ VERIFICATION QUERIES ============

-- Check table creation
SELECT table_name FROM user_tables ORDER BY table_name;

-- Check indexes
SELECT index_name, table_name FROM user_indexes WHERE table_name LIKE '%USERS%' OR table_name LIKE '%MESSAGES%';

-- Check constraints
SELECT constraint_name, constraint_type, table_name FROM user_constraints WHERE table_name IN ('USERS', 'CONVERSATIONS', 'MESSAGES');

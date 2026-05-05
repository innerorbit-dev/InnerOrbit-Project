#!/usr/bin/env node

/**
 * InnerOrbit Oracle Backend - API Testing Script
 * Tests all endpoints to verify backend is ready for app migration
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

let authToken = null;
let testUser = null;
let testConversation = null;
let testMessage = null;

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function request(method, endpoint, body = null, useAuth = false) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (useAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { status: 0, error: error.message };
    }
}

async function testHealthCheck() {
    log('\n📡 Testing Health Check...', 'blue');
    const { status, data } = await request('GET', '/health');

    if (status === 200 && data.status === 'OK') {
        log('✅ Health check passed', 'green');
        return true;
    } else {
        log('❌ Health check failed', 'red');
        return false;
    }
}

async function testSignup() {
    log('\n👤 Testing User Signup...', 'blue');
    const { status, data } = await request('POST', '/api/auth/signup', {
        email: `test${Date.now()}@innerorbit.com`,
        password: 'Test123456'
    });

    if (status === 201 && data.success) {
        testUser = data.user;
        authToken = data.token;
        log(`✅ Signup successful - UserId: ${testUser.userId}, PIN: ${testUser.pin}`, 'green');
        return true;
    } else {
        log(`❌ Signup failed: ${data.message}`, 'red');
        return false;
    }
}

async function testLogin() {
    log('\n🔐 Testing Login (UserId + PIN)...', 'blue');
    const { status, data } = await request('POST', '/api/auth/login', {
        userId: testUser.userId,
        pin: testUser.pin
    });

    if (status === 200 && data.success) {
        authToken = data.token;
        log('✅ Login successful', 'green');
        return true;
    } else {
        log(`❌ Login failed: ${data.message}`, 'red');
        return false;
    }
}

async function testTokenVerify() {
    log('\n🎫 Testing Token Verification...', 'blue');
    const { status, data } = await request('POST', '/api/auth/verify', null, true);

    if (status === 200 && data.success && data.valid) {
        log('✅ Token verification passed', 'green');
        return true;
    } else {
        log('❌ Token verification failed', 'red');
        return false;
    }
}

async function testProfileUpdate() {
    log('\n📝 Testing Profile Update...', 'blue');
    const { status, data } = await request('PUT', `/api/users/profile/${testUser.uid}`, {
        bio: 'Test bio for automated testing'
    }, true);

    if (status === 200 && data.success) {
        log('✅ Profile update successful', 'green');
        return true;
    } else {
        log(`❌ Profile update failed: ${data.message}`, 'red');
        return false;
    }
}

async function testUserSearch() {
    log('\n🔍 Testing User Search...', 'blue');
    const { status, data } = await request('POST', '/api/users/search', {
        query: testUser.email,
        searchType: 'email'
    }, true);

    if (status === 200 && data.success && data.users.length > 0) {
        log('✅ User search successful', 'green');
        return true;
    } else {
        log('❌ User search failed', 'red');
        return false;
    }
}

async function testPresenceUpdate() {
    log('\n👁️ Testing Presence Update...', 'blue');
    const { status, data } = await request('PUT', `/api/users/presence/${testUser.uid}`, {
        isOnline: true
    }, true);

    if (status === 200 && data.success) {
        log('✅ Presence update successful', 'green');
        return true;
    } else {
        log(`❌ Presence update failed: ${data.message}`, 'red');
        return false;
    }
}

async function testCreateConversation() {
    log('\n💬 Testing Conversation Creation...', 'blue');

    // Create second user for conversation
    const { data: user2Data } = await request('POST', '/api/auth/signup', {
        email: `test2${Date.now()}@innerorbit.com`,
        password: 'Test123456'
    });

    const { status, data } = await request('POST', '/api/conversations/create', {
        userId1: testUser.uid,
        userId2: user2Data.user.uid
    }, true);

    if (status === 200 && data.success) {
        testConversation = data.conversationId;
        log(`✅ Conversation created: ${testConversation}`, 'green');
        return true;
    } else {
        log(`❌ Conversation creation failed: ${data.message}`, 'red');
        return false;
    }
}

async function testSendMessage() {
    log('\n📨 Testing Send Message...', 'blue');
    const { status, data } = await request('POST', '/api/messages/send', {
        conversationId: testConversation,
        encryptedText: 'Test encrypted message',
        type: 'text'
    }, true);

    if (status === 200 && data.success) {
        testMessage = data.messageId;
        log(`✅ Message sent: ${testMessage}`, 'green');
        return true;
    } else {
        log(`❌ Send message failed: ${data.message}`, 'red');
        return false;
    }
}

async function testGetMessages() {
    log('\n📬 Testing Get Messages...', 'blue');
    const { status, data } = await request('GET', `/api/messages/${testConversation}`, null, true);

    if (status === 200 && data.success && data.messages.length > 0) {
        log(`✅ Retrieved ${data.messages.length} message(s)`, 'green');
        return true;
    } else {
        log('❌ Get messages failed', 'red');
        return false;
    }
}

async function testMessageReaction() {
    log('\n❤️ Testing Message Reaction...', 'blue');
    const { status, data } = await request('POST', `/api/messages/${testMessage}/react`, {
        emoji: '👍'
    }, true);

    if (status === 200 && data.success) {
        log('✅ Reaction added successfully', 'green');
        return true;
    } else {
        log(`❌ Reaction failed: ${data.message}`, 'red');
        return false;
    }
}

async function testLogout() {
    log('\n🚪 Testing Logout...', 'blue');
    const { status, data } = await request('POST', '/api/auth/logout', null, true);

    if (status === 200 && data.success) {
        log('✅ Logout successful', 'green');
        return true;
    } else {
        log(`❌ Logout failed: ${data.message}`, 'red');
        return false;
    }
}

async function runAllTests() {
    log('\n╔════════════════════════════════════════╗', 'yellow');
    log('║  InnerOrbit Backend API Test Suite   ║', 'yellow');
    log('╚════════════════════════════════════════╝', 'yellow');
    log(`\n🌐 Testing API at: ${BASE_URL}\n`, 'blue');

    const tests = [
        { name: 'Health Check', fn: testHealthCheck },
        { name: 'User Signup', fn: testSignup },
        { name: 'User Login', fn: testLogin },
        { name: 'Token Verification', fn: testTokenVerify },
        { name: 'Profile Update', fn: testProfileUpdate },
        { name: 'User Search', fn: testUserSearch },
        { name: 'Presence Update', fn: testPresenceUpdate },
        { name: 'Create Conversation', fn: testCreateConversation },
        { name: 'Send Message', fn: testSendMessage },
        { name: 'Get Messages', fn: testGetMessages },
        { name: 'Message Reaction', fn: testMessageReaction },
        { name: 'Logout', fn: testLogout }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            log(`❌ ${test.name} threw error: ${error.message}`, 'red');
            failed++;
        }
    }

    log('\n╔════════════════════════════════════════╗', 'yellow');
    log('║           Test Results                ║', 'yellow');
    log('╚════════════════════════════════════════╝', 'yellow');
    log(`\n✅ Passed: ${passed}`, 'green');
    log(`❌ Failed: ${failed}`, 'red');
    log(`📊 Total:  ${passed + failed}\n`, 'blue');

    if (failed === 0) {
        log('🎉 All tests passed! Backend is ready for migration.', 'green');
        process.exit(0);
    } else {
        log('⚠️  Some tests failed. Please check the backend configuration.', 'yellow');
        process.exit(1);
    }
}

// Run tests
runAllTests().catch(error => {
    log(`\n💥 Test suite crashed: ${error.message}`, 'red');
    process.exit(1);
});

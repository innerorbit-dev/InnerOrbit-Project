const oracledb = require('oracledb');
const path = require('path');

// Oracle Instant Client configuration
try {
    oracledb.initOracleClient();
} catch (err) {
    console.error('Oracle Client initialization failed:', err);
}

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionString: process.env.DB_CONNECTION_STRING,
    walletLocation: path.join(__dirname, '../wallet'),
    walletPassword: process.env.DB_PASSWORD
};

// Create connection pool
let pool;

async function initialize() {
    try {
        pool = await oracledb.createPool({
            user: dbConfig.user,
            password: dbConfig.password,
            connectionString: dbConfig.connectionString,
            poolMin: 2,
            poolMax: 10,
            poolIncrement: 1,
            poolTimeout: 60
        });
        console.log('✅ Oracle Database connection pool created');
    } catch (err) {
        console.error('❌ Failed to create connection pool:', err);
        throw err;
    }
}

async function close() {
    if (pool) {
        try {
            await pool.close(10);
            console.log('✅ Oracle Database connection pool closed');
        } catch (err) {
            console.error('❌ Error closing connection pool:', err);
        }
    }
}

function getPool() {
    return pool;
}

// Execute query helper
async function execute(sql, binds = {}, options = {}) {
    let connection;
    try {
        connection = await pool.getConnection();
        const result = await connection.execute(sql, binds, {
            outFormat: oracledb.OUT_FORMAT_ARRAY,
            autoCommit: options.autoCommit !== false, // Default true
            ...options
        });
        return result;
    } catch (err) {
        console.error('Database query error:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

// Commit transaction helper
async function commit() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.commit();
    } catch (err) {
        console.error('Commit error:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('Error closing connection:', err);
            }
        }
    }
}

module.exports = {
    initialize,
    close,
    getPool,
    execute,
    commit
};

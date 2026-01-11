/**
 * Database Module - SQLite with Capacitor
 * Offline-first storage for Flight Mode app
 * 
 * Uses Capacitor SQLite plugin when available (mobile)
 * Falls back to localStorage for browser development
 */

/* ------------------ CAPACITOR SQLITE SETUP ------------------ */
let db = null;
let isCapacitorAvailable = false;
let useFallback = true; // Start with fallback until we check for Capacitor

// Check if Capacitor is available
async function checkCapacitor() {
    try {
        // Check if running in Capacitor context
        if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
            // Try to dynamically import Capacitor SQLite
            // Note: This will only work if @capacitor-community/sqlite is installed
            // For browser/development, it will fail gracefully and use fallback
            try {
                const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
                isCapacitorAvailable = true;
                useFallback = false;
                return true;
            } catch (importError) {
                console.log('Capacitor SQLite plugin not installed, using fallback');
                return false;
            }
        }
    } catch (error) {
        console.log('Capacitor not available, using fallback:', error.message);
    }
    return false;
}

/* ------------------ DATABASE SCHEMA ------------------ */
const SCHEMA = {
    focus_sessions: `
        CREATE TABLE IF NOT EXISTS focus_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            objective TEXT,
            from_code TEXT,
            to_code TEXT,
            seat TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            synced_to_firebase INTEGER DEFAULT 0
        )
    `,
    users: `
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            displayName TEXT,
            email TEXT,
            photoURL TEXT,
            last_updated TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `,
    indexes: [
        `CREATE INDEX IF NOT EXISTS idx_user_id ON focus_sessions(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_start_time ON focus_sessions(start_time)`,
        `CREATE INDEX IF NOT EXISTS idx_status ON focus_sessions(status)`,
        `CREATE INDEX IF NOT EXISTS idx_synced ON focus_sessions(synced_to_firebase)`
    ]
};

/* ------------------ INITIALIZE DATABASE ------------------ */
export async function initDatabase() {
    try {
        // Check for Capacitor first
        const hasCapacitor = await checkCapacitor();

        if (hasCapacitor && !useFallback) {
            await initCapacitorSQLite();
        } else {
            await initFallback();
        }

        // Create tables
        await executeSQL(SCHEMA.focus_sessions);
        await executeSQL(SCHEMA.users);
        for (const indexSQL of SCHEMA.indexes) {
            await executeSQL(indexSQL);
        }

        console.log('Database initialized successfully');
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
        // Always fall back to localStorage if SQLite fails
        await initFallback();
        return false;
    }
}

/* ------------------ CAPACITOR SQLITE INITIALIZATION ------------------ */
async function initCapacitorSQLite() {
    try {
        const { CapacitorSQLite } = await import('@capacitor-community/sqlite');

        // Open or create database
        db = await CapacitorSQLite.createConnection({
            database: 'flightmode_db',
            encrypted: false,
            mode: 'no-encryption',
            readOnly: false
        });

        await db.open();
        console.log('Capacitor SQLite initialized');
    } catch (error) {
        console.error('Capacitor SQLite init error:', error);
        throw error;
    }
}

/* ------------------ FALLBACK: LOCALSTORAGE-BASED SQL EMULATION ------------------ */
const FALLBACK_STORAGE_KEY = 'flightmode_sqlite_fallback';
let fallbackData = {
    focus_sessions: [],
    users: []
};

async function initFallback() {
    try {
        // Load existing data from localStorage
        const stored = localStorage.getItem(FALLBACK_STORAGE_KEY);
        if (stored) {
            fallbackData = JSON.parse(stored);
        } else {
            fallbackData = { focus_sessions: [], users: [] };
            localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(fallbackData));
        }
        useFallback = true;
        console.log('Using localStorage fallback for database');
        return true;
    } catch (error) {
        console.error('Fallback initialization error:', error);
        fallbackData = { focus_sessions: [], users: [] };
        return false;
    }
}

function saveFallbackData() {
    try {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(fallbackData));
    } catch (error) {
        console.error('Failed to save fallback data:', error);
    }
}

/* ------------------ EXECUTE SQL ------------------ */
async function executeSQL(sql, params = []) {
    if (useFallback) {
        // For fallback, we only handle CREATE TABLE (ignore it) and real operations
        if (sql.includes('CREATE TABLE')) {
            return { changes: { changes: 0 } };
        }
        if (sql.includes('CREATE INDEX')) {
            return { changes: { changes: 0 } };
        }
        throw new Error('Fallback SQL execution not implemented for: ' + sql);
    } else {
        try {
            const result = await db.run(sql, params);
            return result;
        } catch (error) {
            console.error('SQL execution error:', error, sql);
            throw error;
        }
    }
}

/* ------------------ QUERY SQL ------------------ */
async function querySQL(sql, params = []) {
    if (useFallback) {
        // Handle SELECT queries in fallback
        if (sql.includes('SELECT')) {
            return queryFallback(sql, params);
        }
        throw new Error('Fallback query not implemented for: ' + sql);
    } else {
        try {
            const result = await db.query(sql, params);
            return result;
        } catch (error) {
            console.error('SQL query error:', error, sql);
            throw error;
        }
    }
}

function queryFallback(sql, params) {
    let results = fallbackData.focus_sessions || [];

    // Simple WHERE clause parsing for common queries
    if (sql.includes('WHERE')) {
        // WHERE user_id = ?
        if (sql.includes('user_id = ?')) {
            results = results.filter(row => row.user_id === params[0]);
        }

        // Handle AND conditions - apply all filters
        // WHERE status = 'completed' (string literal)
        if (sql.includes("status = 'completed'")) {
            results = results.filter(row => row.status === 'completed');
        }
        // WHERE status = 'abandoned' (string literal)
        if (sql.includes("status = 'abandoned'")) {
            results = results.filter(row => row.status === 'abandoned');
        }
        // WHERE status = 'in-progress' (string literal)
        if (sql.includes("status = 'in-progress'")) {
            results = results.filter(row => row.status === 'in-progress');
        }
        // WHERE status = ? (parameterized) - if used
        if (sql.match(/status = \?/)) {
            // Find position of status = ?
            const matches = [...sql.matchAll(/\?/g)];
            const statusIndex = sql.indexOf('status = ?');
            if (statusIndex !== -1) {
                const beforeStatus = sql.substring(0, statusIndex);
                const paramIndex = (beforeStatus.match(/\?/g) || []).length;
                if (params[paramIndex]) {
                    results = results.filter(row => row.status === params[paramIndex]);
                }
            }
        }

        // WHERE synced_to_firebase = 0 (number literal)
        if (sql.includes('synced_to_firebase = 0')) {
            results = results.filter(row => (row.synced_to_firebase || 0) === 0);
        }
        // WHERE synced_to_firebase = ? (parameterized)
        if (sql.match(/synced_to_firebase = \?/)) {
            const syncIndex = sql.indexOf('synced_to_firebase = ?');
            if (syncIndex !== -1) {
                const beforeSync = sql.substring(0, syncIndex);
                const paramIndex = (beforeSync.match(/\?/g) || []).length;
                if (params[paramIndex] !== undefined) {
                    results = results.filter(row => (row.synced_to_firebase || 0) === params[paramIndex]);
                }
            }
        }

        // WHERE id = ?
        if (sql.includes('id = ?')) {
            const idIndex = sql.indexOf('id = ?');
            if (idIndex !== -1) {
                const beforeId = sql.substring(0, idIndex);
                const paramIndex = (beforeId.match(/\?/g) || []).length;
                if (params[paramIndex] !== undefined) {
                    results = results.filter(row => row.id === params[paramIndex]);
                }
            }
        }
    }

    // ORDER BY (apply after WHERE filters)
    if (sql.includes('ORDER BY')) {
        if (sql.includes('ORDER BY start_time DESC')) {
            results.sort((a, b) => {
                try {
                    return new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime();
                } catch (e) {
                    return 0;
                }
            });
        } else if (sql.includes('ORDER BY start_time ASC')) {
            results.sort((a, b) => {
                try {
                    return new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime();
                } catch (e) {
                    return 0;
                }
            });
        }
    }

    // LIMIT (apply after ORDER BY)
    if (sql.includes('LIMIT')) {
        const limitMatch = sql.match(/LIMIT (\d+)/);
        if (limitMatch) {
            results = results.slice(0, parseInt(limitMatch[1]));
        }
    }

    return { values: results };
}

/* ------------------ INSERT FOCUS SESSION ------------------ */
export async function insertFocusSession(sessionData) {
    try {
        const {
            user_id,
            duration_minutes,
            objective = null,
            from_code = null,
            to_code = null,
            seat = null,
            start_time,
            end_time = null,
            status = 'completed',
            synced_to_firebase = 0
        } = sessionData;

        const sql = `
            INSERT INTO focus_sessions 
            (user_id, duration_minutes, objective, from_code, to_code, seat, start_time, end_time, status, synced_to_firebase)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            user_id,
            duration_minutes,
            objective,
            from_code,
            to_code,
            seat,
            start_time,
            end_time,
            status,
            synced_to_firebase
        ];

        if (useFallback) {
            // Generate ID
            const maxId = fallbackData.focus_sessions.length > 0
                ? Math.max(...fallbackData.focus_sessions.map(s => s.id || 0))
                : 0;

            const newSession = {
                id: maxId + 1,
                user_id,
                duration_minutes,
                objective,
                from_code,
                to_code,
                seat,
                start_time,
                end_time: end_time || null, // Keep null for in-progress sessions
                status,
                synced_to_firebase,
                created_at: new Date().toISOString()
            };

            fallbackData.focus_sessions.push(newSession);
            saveFallbackData();
            return { insertId: newSession.id, changes: 1 };
        } else {
            const result = await executeSQL(sql, params);
            return { insertId: result.changes?.lastId || result.insertId, changes: result.changes?.changes || 1 };
        }
    } catch (error) {
        console.error('Failed to insert focus session:', error);
        throw error;
    }
}

/* ------------------ GET FOCUS SESSION BY ID ------------------ */
export async function getFocusSessionById(sessionId) {
    try {
        const sql = `SELECT * FROM focus_sessions WHERE id = ? LIMIT 1`;
        const result = await querySQL(sql, [sessionId]);

        if (useFallback) {
            return result.values && result.values.length > 0 ? result.values[0] : null;
        } else {
            return result.values && result.values.length > 0 ? result.values[0] : null;
        }
    } catch (error) {
        console.error('Failed to get focus session:', error);
        return null;
    }
}

/* ------------------ GET FOCUS SESSIONS BY USER ------------------ */
export async function getFocusSessionsByUser(userId, options = {}) {
    try {
        const { status = null, limit = 100, orderBy = 'start_time DESC' } = options;

        let sql = `SELECT * FROM focus_sessions WHERE user_id = ?`;
        const params = [userId];

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY ${orderBy} LIMIT ?`;
        params.push(limit);

        const result = await querySQL(sql, params);
        return result.values || [];
    } catch (error) {
        console.error('Failed to get focus sessions:', error);
        return [];
    }
}

/* ------------------ UPDATE FOCUS SESSION ------------------ */
export async function updateFocusSession(sessionId, updates) {
    try {
        const allowedFields = ['end_time', 'status', 'synced_to_firebase'];
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length === 0) {
            return { changes: 0 };
        }

        values.push(sessionId);
        const sql = `UPDATE focus_sessions SET ${fields.join(', ')} WHERE id = ?`;

        if (useFallback) {
            const sessionIndex = fallbackData.focus_sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex !== -1) {
                Object.assign(fallbackData.focus_sessions[sessionIndex], updates);
                saveFallbackData();
                return { changes: 1 };
            }
            return { changes: 0 };
        } else {
            const result = await executeSQL(sql, values);
            return { changes: result.changes?.changes || 0 };
        }
    } catch (error) {
        console.error('Failed to update focus session:', error);
        return { changes: 0 };
    }
}

/* ------------------ GET STATISTICS ------------------ */
export async function getSessionStats(userId) {
    try {
        // Ensure userId is provided
        if (!userId) {
            return {
                todayMinutes: 0,
                totalFlights: 0,
                streak: 0
            };
        }

        const sessions = await getFocusSessionsByUser(userId, { status: 'completed', limit: 1000 });

        // Ensure sessions is an array
        if (!Array.isArray(sessions)) {
            return {
                todayMinutes: 0,
                totalFlights: 0,
                streak: 0
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter today's sessions
        const todaySessions = sessions.filter(s => {
            if (!s || !s.start_time) return false;
            try {
                const sessionDate = new Date(s.start_time);
                return sessionDate >= today;
            } catch (e) {
                return false;
            }
        });

        // Calculate today's minutes
        const todayMinutes = todaySessions.reduce((sum, s) => {
            return sum + (parseInt(s.duration_minutes) || 0);
        }, 0);

        // Total flights
        const totalFlights = sessions.length || 0;

        // Calculate streak (consecutive days with at least one completed session)
        let streak = 0;

        if (sessions.length > 0) {
            // Get unique session dates and sort descending
            const sessionDates = [...new Set(sessions
                .filter(s => s && s.start_time)
                .map(s => {
                    try {
                        return new Date(s.start_time).toDateString();
                    } catch (e) {
                        return null;
                    }
                })
                .filter(d => d !== null)
            )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

            if (sessionDates.length > 0) {
                let checkDate = new Date();
                checkDate.setHours(0, 0, 0, 0);

                for (let i = 0; i < sessionDates.length; i++) {
                    const sessionDate = new Date(sessionDates[i]);
                    sessionDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor((checkDate - sessionDate) / (1000 * 60 * 60 * 24));

                    if (i === 0 && diffDays <= 1) {
                        // Today or yesterday
                        streak++;
                        checkDate = sessionDate;
                    } else if (i > 0 && diffDays === i) {
                        // Consecutive day
                        streak++;
                        checkDate = sessionDate;
                    } else {
                        break;
                    }
                }
            }
        }

        return {
            todayMinutes: todayMinutes || 0,
            totalFlights: totalFlights || 0,
            streak: Math.max(0, streak > 0 ? streak - 1 : 0) // Adjust for today
        };
    } catch (error) {
        console.error('Failed to get session stats:', error);
        return {
            todayMinutes: 0,
            totalFlights: 0,
            streak: 0
        };
    }
}

/* ------------------ GET UNSYNCED SESSIONS ------------------ */
export async function getUnsyncedSessions(userId) {
    try {
        const sql = `SELECT * FROM focus_sessions WHERE user_id = ? AND synced_to_firebase = 0 AND status = 'completed'`;
        const result = await querySQL(sql, [userId]);
        return result.values || [];
    } catch (error) {
        console.error('Failed to get unsynced sessions:', error);
        return [];
    }
}

/* ------------------ MARK SESSION AS SYNCED ------------------ */
/* ------------------ MARK SESSION AS SYNCED ------------------ */
export async function markSessionAsSynced(sessionId) {
    try {
        return await updateFocusSession(sessionId, { synced_to_firebase: 1 });
    } catch (error) {
        console.error('Failed to mark session as synced:', error);
        return { changes: 0 };
    }
}

/* ------------------ USER MANAGEMENT ------------------ */
export async function saveUser(userData) {
    try {
        const { id, displayName, email, photoURL } = userData;

        if (useFallback) {
            const existingIndex = fallbackData.users.findIndex(u => u.id === id);
            const userObj = {
                id,
                displayName,
                email,
                photoURL,
                last_updated: new Date().toISOString()
            };

            if (existingIndex !== -1) {
                fallbackData.users[existingIndex] = userObj;
            } else {
                fallbackData.users.push(userObj);
            }
            saveFallbackData();
            return { changes: 1 };
        } else {
            // Upsert (Replace)
            const sql = `INSERT OR REPLACE INTO users (id, displayName, email, photoURL, last_updated) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`;
            return await executeSQL(sql, [id, displayName, email, photoURL]);
        }
    } catch (error) {
        console.error('Failed to save user:', error);
        throw error;
    }
}

export async function getUser(userId) {
    try {
        if (useFallback) {
            return fallbackData.users.find(u => u.id === userId) || null;
        } else {
            const sql = `SELECT * FROM users WHERE id = ?`;
            const result = await querySQL(sql, [userId]);
            return result.values && result.values.length > 0 ? result.values[0] : null;
        }
    } catch (error) {
        console.error('Failed to get user:', error);
        return null;
    }
}

/* ------------------ EXPORT ------------------ */
export default {
    initDatabase,
    insertFocusSession,
    getFocusSessionById,
    getFocusSessionsByUser,
    updateFocusSession,
    getSessionStats,
    getUnsyncedSessions,
    getUnsyncedSessions,
    markSessionAsSynced,
    saveUser,
    getUser
};
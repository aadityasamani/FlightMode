/**
 * Sync Module - Firebase Cloud Sync
 * Syncs SQLite (local) → Firebase (cloud) in the background
 * 
 * Rules:
 * - SQLite is the source of truth
 * - Firebase is only for backup and cross-device sync
 * - Never block app usage if sync fails
 * - Simple conflict resolution: last write wins (based on end_time)
 */

import { getUnsyncedSessions, markSessionAsSynced } from './database.js';

/* ------------------ FIREBASE IMPORTS ------------------ */
import {
    collection,
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { app, db, auth } from './firebase-init.js';

/* ------------------ SYNC STATUS ------------------ */
let isSyncing = false;
let lastSyncTime = null;

/* ------------------ CHECK IF ONLINE ------------------ */
function isOnline() {
    return navigator.onLine;
}

/* ------------------ SYNC SESSION TO FIREBASE ------------------ */
async function syncSessionToFirebase(session, userId) {
    try {
        if (!userId) {
            console.warn('No user ID for sync');
            return false;
        }

        // Prepare session data for Firebase
        const sessionData = {
            id: session.id,
            user_id: userId,
            duration_minutes: session.duration_minutes,
            objective: session.objective || null,
            from_code: session.from_code || null,
            to_code: session.to_code || null,
            seat: session.seat || null,
            start_time: session.start_time,
            end_time: session.end_time || null,
            status: session.status || 'completed',
            created_at: session.created_at || session.start_time,
            synced_at: serverTimestamp(),
            local_id: session.id // Keep local SQLite ID reference
        };

        // Use session ID as document ID for easy lookup
        const sessionRef = doc(db, 'focus_sessions', `${userId}_${session.id}`);

        // Check if session already exists in Firebase (for conflict resolution)
        const existingDoc = await getDoc(sessionRef);

        if (existingDoc.exists()) {
            const existingData = existingDoc.data();
            // Simple conflict resolution: last write wins (based on end_time)
            const existingEndTime = existingData.end_time ? new Date(existingData.end_time).getTime() : 0;
            const localEndTime = session.end_time ? new Date(session.end_time).getTime() : 0;

            // If local is newer or equal, update Firebase
            if (localEndTime >= existingEndTime) {
                await setDoc(sessionRef, sessionData, { merge: true });
                console.log(`Synced session ${session.id} to Firebase (updated existing)`);
                return true;
            } else {
                // Firebase has newer data - skip local update
                // In future, could download and update local, but for now: last write wins
                console.log(`Skipped sync for session ${session.id} - Firebase has newer version`);
                // Still mark as synced since it exists in Firebase
                return true;
            }
        } else {
            // New session - create in Firebase
            await setDoc(sessionRef, sessionData);
            console.log(`Synced session ${session.id} to Firebase (created new)`);
            return true;
        }
    } catch (error) {
        console.error(`Failed to sync session ${session.id} to Firebase:`, error);
        return false;
    }
}

/* ------------------ SYNC ALL UNSYNCED SESSIONS ------------------ */
export async function syncUnsyncedSessions(userId = null) {
    // Don't sync if already syncing
    if (isSyncing) {
        console.log('Sync already in progress, skipping');
        return { synced: 0, failed: 0, skipped: 0 };
    }

    // Check if online
    if (!isOnline()) {
        console.log('Device is offline, skipping sync');
        return { synced: 0, failed: 0, skipped: 1, reason: 'offline' };
    }

    // Get current user if not provided
    if (!userId) {
        const user = auth.currentUser;
        if (!user) {
            console.log('No authenticated user, skipping sync');
            return { synced: 0, failed: 0, skipped: 1, reason: 'no_auth' };
        }
        userId = user.uid;
    }

    isSyncing = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
        // Get all unsynced sessions from SQLite
        const unsyncedSessions = await getUnsyncedSessions(userId);

        if (unsyncedSessions.length === 0) {
            console.log('No unsynced sessions found');
            lastSyncTime = new Date();
            isSyncing = false;
            return { synced: 0, failed: 0, skipped: 0, reason: 'no_unsynced' };
        }

        console.log(`Found ${unsyncedSessions.length} unsynced session(s), starting sync...`);

        // Sync each session
        for (const session of unsyncedSessions) {
            try {
                const success = await syncSessionToFirebase(session, userId);
                if (success) {
                    // Mark as synced in SQLite
                    await markSessionAsSynced(session.id);
                    syncedCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                console.error(`Error syncing session ${session.id}:`, error);
                failedCount++;
                // Continue with next session even if one fails
            }
        }

        lastSyncTime = new Date();
        console.log(`Sync completed: ${syncedCount} synced, ${failedCount} failed`);

        return {
            synced: syncedCount,
            failed: failedCount,
            total: unsyncedSessions.length
        };
    } catch (error) {
        console.error('Sync operation failed:', error);
        return {
            synced: syncedCount,
            failed: failedCount + (unsyncedSessions?.length || 0) - syncedCount,
            error: error.message
        };
    } finally {
        isSyncing = false;
    }
}

/* ------------------ BACKGROUND SYNC (NON-BLOCKING) ------------------ */
export async function backgroundSync(userId = null) {
    // Run sync in background, don't wait for it
    // This ensures app never blocks if sync fails
    syncUnsyncedSessions(userId).catch(error => {
        console.error('Background sync failed:', error);
        // Silently fail - app continues working
    });
}

/* ------------------ PERIODIC SYNC ------------------ */
let syncInterval = null;

export function startPeriodicSync(intervalMinutes = 5, userId = null) {
    // Clear existing interval if any
    if (syncInterval) {
        clearInterval(syncInterval);
    }

    // Sync immediately
    backgroundSync(userId);

    // Then sync periodically
    syncInterval = setInterval(() => {
        backgroundSync(userId);
    }, intervalMinutes * 60 * 1000);

    console.log(`Periodic sync started (every ${intervalMinutes} minutes)`);
}

export function stopPeriodicSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
        console.log('Periodic sync stopped');
    }
}

/* ------------------ SYNC WHEN ONLINE ------------------ */
// Auto-sync when device comes online
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('Device came online, triggering sync...');
        backgroundSync();
    });

    // Sync when page becomes visible (user comes back to app)
    // Wait for DOM to be ready before adding listener
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && isOnline()) {
                    console.log('Page became visible, triggering sync...');
                    backgroundSync();
                }
            });
        });
    } else {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && isOnline()) {
                console.log('Page became visible, triggering sync...');
                backgroundSync();
            }
        });
    }
}

/* ------------------ GET SYNC STATUS ------------------ */
export function getSyncStatus() {
    return {
        isSyncing,
        lastSyncTime,
        isOnline: isOnline()
    };
}

/* ------------------ EXPORT ------------------ */
export default {
    syncUnsyncedSessions,
    backgroundSync,
    startPeriodicSync,
    stopPeriodicSync,
    getSyncStatus
};
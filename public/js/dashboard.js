import {
    onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { app, auth, db } from './firebase-init.js';
import { initDatabase, getSessionStats, saveUser } from "./database.js";
import { startPeriodicSync, backgroundSync } from "./sync.js";

/* ------------------ DATABASE INITIALIZATION ------------------ */
let dbInitialized = false;

async function initializeAppDatabase() {
    if (!dbInitialized) {
        try {
            await initDatabase();
            dbInitialized = true;
            console.log("Database initialized successfully");
        } catch (error) {
            console.error("Database initialization failed, continuing with fallback:", error);
            // App continues to work even if database init fails
        }
    }
}

// Initialize database immediately (doesn't need auth)
initializeAppDatabase();

/* ------------------ AUTH STATE ------------------ */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "auth.html";
        return;
    }

    // Ensure database is initialized
    await initializeAppDatabase();

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            name: user.displayName || "Anonymous",
            photoURL: user.photoURL || null,
            provider: user.providerData[0]?.providerId || "password",
            createdAt: serverTimestamp()
        });
    }

    // Prime local user cache for offline support
    await saveUser({
        id: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
    });

    // Load and display stats from SQLite
    await loadDashboardStats(user.uid);

    // Start periodic sync (every 5 minutes) - non-blocking
    // This syncs unsynced sessions to Firebase in the background
    startPeriodicSync(5, user.uid);

    // Also trigger immediate sync (non-blocking) when dashboard loads
    backgroundSync(user.uid).catch(error => {
        console.error('Initial sync failed (non-blocking):', error);
        // Sync failure doesn't affect app - will retry periodically
    });
});

/* ------------------ LOAD DASHBOARD STATS ------------------ */
async function loadDashboardStats(userId) {
    try {
        if (!userId) {
            console.warn('No user ID provided for stats');
            // Keep default 0 values
            return;
        }

        const stats = await getSessionStats(userId);

        // Ensure stats object exists with defaults
        const todayMinutes = stats?.todayMinutes || 0;
        const totalFlights = stats?.totalFlights || 0;
        const streak = stats?.streak || 0;

        // Update TODAY minutes
        const todayMinutesEl = document.getElementById('today-minutes');
        if (todayMinutesEl) {
            todayMinutesEl.innerHTML = `${todayMinutes}<span class="text-2xl font-normal text-gray-500 ml-1">min</span>`;
        }

        // Update FLIGHTS count
        const totalFlightsEl = document.getElementById('total-flights');
        if (totalFlightsEl) {
            totalFlightsEl.textContent = totalFlights.toString();
        }

        // Update STREAK days
        const streakDaysEl = document.getElementById('streak-days');
        if (streakDaysEl) {
            const days = Math.floor(streak);
            streakDaysEl.innerHTML = `${days}<span class="text-2xl font-normal text-gray-500 ml-1">days</span>`;
        }
    } catch (error) {
        console.error("Failed to load dashboard stats:", error);
        // Stats will show default values (0) if load fails - already set in HTML
    }
}

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    // Restore theme
    const savedTheme = localStorage.getItem('theme');
    const themeToApply = (!savedTheme || savedTheme === 'dark') ? 'light' : savedTheme;
    document.body.className = `theme-${themeToApply}`;

    const startFlight = document.getElementById("start-flight-btn");

    console.log("Dashboard JS loaded");
    console.log("Start flight button:", startFlight);

    /* ---------- START FLIGHT ---------- */
    startFlight?.addEventListener("click", () => {
        document.body.classList.add("fade-out");
        setTimeout(() => {
            window.location.href = "plan-flight.html";
        }, 300);
    });
});
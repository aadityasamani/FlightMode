// Get flight data (can parse before DOM is ready)
const flightData = JSON.parse(localStorage.getItem('currentFlight') || '{}');

// Import database functions
import { insertFocusSession, initDatabase, updateFocusSession } from './database.js';

// Import sync functions
import { backgroundSync } from './sync.js';

// Import Firebase auth to get user ID
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8WU_hxbnFLW83AwOKhTevuJM_jYFJZRs",
    authDomain: "flightmode-18b9d.firebaseapp.com",
    projectId: "flightmode-18b9d",
    storageBucket: "flightmode-18b9d.firebasestorage.app",
    messagingSenderId: "346833560778",
    appId: "1:346833560778:web:e552b0062c9ac18dcb0033"
};

// Initialize Firebase (safe to call multiple times - returns same instance)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Keep screen awake status helper
async function setKeepAwake(enable) {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.KeepAwake) {
            if (enable) {
                await window.Capacitor.Plugins.KeepAwake.keepAwake();
                console.log('KeepAwake enabled');
            } else {
                await window.Capacitor.Plugins.KeepAwake.allowSleep();
                console.log('KeepAwake disabled');
            }
        }
    } catch (e) {
        console.warn('KeepAwake error:', e);
    }
}

// Parse duration to get total seconds
function parseDuration(flightData) {
    // First try to use durationMinutes if available (more reliable)
    if (flightData.durationMinutes) {
        return flightData.durationMinutes * 60;
    }

    // Fallback to parsing duration string (e.g., "30m" or "1h 30m")
    if (flightData.duration) {
        const parts = flightData.duration.match(/(\d+)h\s*(\d+)m|(\d+)m/);
        if (parts) {
            if (parts[1] && parts[2]) {
                // Format: "1h 30m"
                return parseInt(parts[1]) * 3600 + parseInt(parts[2]) * 60;
            } else if (parts[3]) {
                // Format: "30m"
                return parseInt(parts[3]) * 60;
            }
        }
    }

    // Default: 30 minutes
    return 30 * 60;
}

const totalSeconds = parseDuration(flightData);
const totalSeconds = parseDuration(flightData);
const totalDistance = 1533; // km

let isPaused = flightData.status === 'paused';
let timerInterval = null;
let sessionDbId = flightData.dbId || null; // Store database ID for updates

let remainingSeconds;

// Restore state based on stored data
if (flightData.status === 'active' && flightData.targetEndTime) {
    // Active session: calculate remaining time from target
    const now = Date.now();
    remainingSeconds = Math.max(0, Math.ceil((flightData.targetEndTime - now) / 1000));
} else if (flightData.status === 'paused' && flightData.remainingSeconds) {
    // Paused session: restore saved remaining time
    remainingSeconds = flightData.remainingSeconds;
} else {
    // New or standard session
    remainingSeconds = totalSeconds;
}

/* ------------------ SAVE SESSION TO DATABASE ------------------ */
async function saveSessionToDatabase(completedFlight, endTime, durationMinutes, status = 'completed') {
    try {
        // Ensure database is initialized
        await initDatabase();

        // Get current user ID from Firebase auth
        const user = auth.currentUser;
        if (!user) {
            console.warn('No authenticated user, skipping database save');
            return;
        }

        const userId = user.uid;

        // Prepare session data for database
        const sessionData = {
            user_id: userId,
            duration_minutes: durationMinutes,
            objective: completedFlight.objective || null,
            from_code: completedFlight.fromCode || null,
            to_code: completedFlight.toCode || null,
            seat: completedFlight.seat || null,
            start_time: completedFlight.startTime || new Date().toISOString(),
            end_time: endTime || null,
            status: status,
            synced_to_firebase: 0
        };

        // If session already exists (paused session), update it
        if (sessionDbId) {
            await updateFocusSession(sessionDbId, {
                end_time: endTime || null,
                status: status
            });
            console.log('Session updated in database:', sessionDbId);
        } else {
            // Insert new session into SQLite
            const result = await insertFocusSession(sessionData);
            sessionDbId = result.insertId;
            console.log('Session saved to database with ID:', sessionDbId);
        }

        // Store the database ID in localStorage for landing page
        completedFlight.dbId = sessionDbId;
        localStorage.setItem('currentFlight', JSON.stringify(completedFlight));

    } catch (error) {
        console.error('Error saving session to database:', error);
        // Don't throw - app continues to work even if database save fails
    }
}

/* ------------------ UPDATE DISPLAY ------------------ */
function updateDisplay() {
    const hours = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    const secs = remainingSeconds % 60;

    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        timerDisplay.textContent =
            `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Update progress
    const progress = (totalSeconds - remainingSeconds) / totalSeconds;
    const progressPercent = document.getElementById('progress-percent');
    if (progressPercent) {
        progressPercent.textContent = Math.round(progress * 100) + '%';
    }

    // Update progress ring
    const progressCircle = document.getElementById('progressCircle');
    if (progressCircle) {
        const circumference = 2 * Math.PI * 130;
        const offset = circumference - (progress * circumference);
        progressCircle.style.strokeDashoffset = offset;
    }

    // Update distance
    const distanceCovered = document.getElementById('distance-covered');
    if (distanceCovered) {
        distanceCovered.textContent = Math.round(progress * totalDistance);
    }
}

/* ------------------ START TIMER ------------------ */
function startTimer() {
    // Keep screen awake during session
    setKeepAwake(true);

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // Initialize target time if starting/resuming active session
    if (!isPaused) {
        if (!flightData.targetEndTime || flightData.status !== 'active') {
            flightData.status = 'active';
            flightData.targetEndTime = Date.now() + (remainingSeconds * 1000);
            localStorage.setItem('currentFlight', JSON.stringify(flightData));
        }
    }

    timerInterval = setInterval(() => {
        if (!isPaused) {
            // Calculate remaining from target time for accuracy
            const now = Date.now();
            if (flightData.targetEndTime) {
                const secondsLeft = Math.ceil((flightData.targetEndTime - now) / 1000);

                if (secondsLeft <= 0) {
                    remainingSeconds = 0;
                    updateDisplay();
                    completeFlight();
                    return;
                }

                remainingSeconds = secondsLeft;
                updateDisplay();
            }
        }
    }, 200); // Check more frequently
}

/* ------------------ PAUSE/RESUME ------------------ */
/* ------------------ PAUSE/RESUME ------------------ */
function togglePause() {
    isPaused = !isPaused;

    if (isPaused) {
        // PAUSE: Calculate remaining, save it, clear target
        if (flightData.targetEndTime) {
            const now = Date.now();
            remainingSeconds = Math.max(0, Math.ceil((flightData.targetEndTime - now) / 1000));
        }

        flightData.status = 'paused';
        flightData.remainingSeconds = remainingSeconds;
        flightData.targetEndTime = null;
        localStorage.setItem('currentFlight', JSON.stringify(flightData));
    } else {
        // RESUME: Set new target based on remaining
        flightData.status = 'active';
        flightData.targetEndTime = Date.now() + (remainingSeconds * 1000);
        flightData.remainingSeconds = null;
        localStorage.setItem('currentFlight', JSON.stringify(flightData));
    }

    const pauseBtn = document.getElementById('pause-resume-btn');
    const pauseIcon = pauseBtn?.querySelector('svg');
    const pauseText = pauseBtn?.querySelector('span');

    if (isPaused) {
        // Update button to show resume
        pauseBtn?.classList.add('paused');
        if (pauseIcon) {
            pauseIcon.innerHTML = '<polygon points="11 5 11 19 19 12 11 5"></polygon>';
        }
        if (pauseText) {
            pauseText.textContent = 'Resume';
        }
    } else {
        // Update button to show pause
        pauseBtn?.classList.remove('paused');
        if (pauseIcon) {
            pauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        }
        if (pauseText) {
            pauseText.textContent = 'Pause';
        }
    }
}

/* ------------------ DISCARD FLIGHT ------------------ */
async function discardFlight() {
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            return;
        }

        // Calculate completed duration
        const completedMinutes = Math.floor((totalSeconds - remainingSeconds) / 60);

        // Save as abandoned in database
        if (sessionDbId || remainingSeconds < totalSeconds) {
            await saveSessionToDatabase(
                flightData,
                new Date().toISOString(),
                completedMinutes,
                'abandoned'
            );
        }

        // Clear flight data
        localStorage.removeItem('currentFlight');

        // Allow sleep
        setKeepAwake(false);

        // Stop timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        // Navigate to dashboard
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    } catch (error) {
        console.error('Error discarding flight:', error);
        // Still navigate even if database save fails
        localStorage.removeItem('currentFlight');
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    }
}

/* ------------------ COMPLETE FLIGHT ------------------ */
async function completeFlight() {
    // Allow sleep
    setKeepAwake(false);

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    const endTime = new Date().toISOString();
    const durationMinutes = flightData.durationMinutes || Math.floor(totalSeconds / 60);

    // Update display to show completion
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
        timerDisplay.textContent = '00:00:00';
    }

    const progressPercent = document.getElementById('progress-percent');
    if (progressPercent) {
        progressPercent.textContent = '100%';
    }

    const distanceCovered = document.getElementById('distance-covered');
    if (distanceCovered) {
        distanceCovered.textContent = totalDistance;
    }

    // Update progress ring to 100%
    const progressCircle = document.getElementById('progressCircle');
    if (progressCircle) {
        const circumference = 2 * Math.PI * 130;
        progressCircle.style.strokeDashoffset = 0;
    }

    const completedFlight = {
        ...flightData,
        endTime: endTime,
        status: 'completed',
        durationMinutes: durationMinutes
    };
    localStorage.setItem('currentFlight', JSON.stringify(completedFlight));

    // Save to SQLite database
    await saveSessionToDatabase(completedFlight, endTime, durationMinutes, 'completed').then(() => {
        // Trigger background sync to Firebase
        backgroundSync().catch(error => {
            console.error('Background sync failed (non-blocking):', error);
        });
    }).catch(error => {
        console.error('Failed to save session to database:', error);
    });

    // Navigate to landing page after short delay
    setTimeout(() => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'landing.html';
        }, 300);
    }, 1500);
}

/* ------------------ DOM SAFE ------------------ */
document.addEventListener('DOMContentLoaded', () => {
    // Update document title
    if (flightData.objective) {
        document.title = `Focus: ${flightData.objective} - Flight Mode`;
    }

    // Display objective
    const objectiveDisplay = document.getElementById('objective-display');
    if (objectiveDisplay) {
        objectiveDisplay.textContent = flightData.objective || 'Focus Session';
    }

    // Display route
    const routeDisplay = document.getElementById('route-display');
    if (routeDisplay) {
        if (flightData.fromCode && flightData.toCode) {
            routeDisplay.textContent = `${flightData.fromCode} → ${flightData.toCode}`;
        } else {
            routeDisplay.textContent = 'START → FOCUS';
        }
    }

    // Display session duration
    const sessionDuration = document.getElementById('session-duration');
    if (sessionDuration) {
        if (flightData.duration) {
            sessionDuration.textContent = flightData.duration;
        } else if (flightData.durationMinutes) {
            const hours = Math.floor(flightData.durationMinutes / 60);
            const minutes = flightData.durationMinutes % 60;
            if (hours > 0) {
                sessionDuration.textContent = `${hours}h ${minutes}m`;
            } else {
                sessionDuration.textContent = `${minutes}m`;
            }
        } else {
            sessionDuration.textContent = '30 min';
        }
    }

    // Display total distance
    const totalDistanceEl = document.getElementById('total-distance');
    if (totalDistanceEl) {
        totalDistanceEl.textContent = totalDistance;
    }

    // Progress circle setup
    const progressCircle = document.getElementById('progressCircle');
    if (progressCircle) {
        const circumference = 2 * Math.PI * 130;
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = circumference;
    }

    // Initialize display
    updateDisplay();

    // Prevent accidental exit (back button, browser back, etc.)
    window.addEventListener('beforeunload', (e) => {
        if (remainingSeconds > 0 && !isPaused) {
            e.preventDefault();
            e.returnValue = 'Your focus session is still in progress. Are you sure you want to leave?';
            return e.returnValue;
        }
    });

    // Prevent browser back button
    window.addEventListener('popstate', (e) => {
        if (remainingSeconds > 0) {
            if (!confirm('Your focus session is still in progress. Are you sure you want to exit?')) {
                window.history.pushState(null, null, window.location.href);
            } else {
                // User confirmed exit - discard flight
                discardFlight();
            }
        }
    });

    // Push state to enable back button detection
    window.history.pushState(null, null, window.location.href);

    // Back button
    const backBtn = document.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
        if (remainingSeconds > 0) {
            if (!confirm('Your focus session is still in progress. Are you sure you want to exit?')) {
                return;
            }
        }
        discardFlight();
    });

    // Pause/Resume button
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    pauseResumeBtn?.addEventListener('click', () => {
        togglePause();
    });

    // Discard button
    const discardBtn = document.getElementById('discard-btn');
    discardBtn?.addEventListener('click', () => {
        const modal = document.getElementById('discard-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    });

    // Discard modal buttons
    const cancelDiscardBtn = document.getElementById('cancel-discard-btn');
    cancelDiscardBtn?.addEventListener('click', () => {
        const modal = document.getElementById('discard-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    });

    const confirmDiscardBtn = document.getElementById('confirm-discard-btn');
    confirmDiscardBtn?.addEventListener('click', () => {
        const modal = document.getElementById('discard-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        discardFlight();
    });

    // Close modal on backdrop click
    const discardModal = document.getElementById('discard-modal');
    discardModal?.addEventListener('click', (e) => {
        if (e.target.id === 'discard-modal') {
            discardModal.classList.add('hidden');
        }
    });

    // Start timer
    startTimer();

    // Initialize session in database (as in-progress)
    (async () => {
        try {
            await initDatabase();
            const user = auth.currentUser;
            if (user) {
                const durationMinutes = flightData.durationMinutes || Math.floor(totalSeconds / 60);
                const result = await insertFocusSession({
                    user_id: user.uid,
                    duration_minutes: durationMinutes,
                    objective: flightData.objective || null,
                    from_code: flightData.fromCode || null,
                    to_code: flightData.toCode || null,
                    seat: flightData.seat || null,
                    start_time: flightData.startTime || new Date().toISOString(),
                    end_time: null,
                    status: 'in-progress',
                    synced_to_firebase: 0
                });
                sessionDbId = result.insertId;
                console.log('Session initialized in database:', sessionDbId);
            }
        } catch (error) {
            console.error('Failed to initialize session in database:', error);
            // Continue even if initialization fails
        }
    })();
});
// Import database functions
import { getFocusSessionsByUser, initDatabase } from './database.js';

// Import Firebase auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyC8WU_hxbnFLW83AwOKhTevuJM_jYFJZRs",
    authDomain: "flightmode-18b9d.firebaseapp.com",
    projectId: "flightmode-18b9d",
    storageBucket: "flightmode-18b9d.firebasestorage.app",
    messagingSenderId: "346833560778",
    appId: "1:346833560778:web:e552b0062c9ac18dcb0033"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function getColorClasses(index) {
    const colors = [
        { bg: 'rgba(96, 165, 250, 0.2)', text: '#60a5fa' }, // blue
        { bg: 'rgba(192, 132, 252, 0.2)', text: '#c084fc' }, // purple
        { bg: 'rgba(52, 211, 153, 0.2)', text: '#34d399' }   // emerald
    ];
    return colors[index % colors.length];
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch (e) {
        return 'Unknown date';
    }
}

function formatDuration(minutes) {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins > 0 ? mins + 'm' : ''}`.trim();
    }
    return `${mins}m`;
}

function renderFlights(flights) {
    const flightList = document.getElementById('flightList');
    if (!flightList) return;

    if (flights.length === 0) {
        flightList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✈️</div>
                <h3 class="empty-title">No flights yet</h3>
                <p class="empty-text">Start your first focus flight to see it here</p>
                <a href="dashboard.html" class="empty-cta">Start a Flight</a>
            </div>
        `;
        return;
    }

    flightList.innerHTML = '';

    flights.forEach((flight, index) => {
        const colors = getColorClasses(index);
        const flightDate = formatDate(flight.start_time);
        const flightDuration = formatDuration(flight.duration_minutes);
        const flightTitle = flight.objective || 'Focus Session';

        const flightCard = document.createElement('div');
        flightCard.className = 'flight-item';
        flightCard.innerHTML = `
          <div class="card p-4 cursor-pointer group">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center" style="background: ${colors.bg};">
                  <svg class="w-6 h-6 plane-icon" style="color: ${colors.text};" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                  </svg>
                </div>
                <div>
                  <h3 class="font-semibold">${flightTitle}</h3>
                  <div class="flex items-center gap-3 mt-1">
                    <span class="flex items-center gap-1 text-xs text-gray-500 font-medium uppercase tracking-wider">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      ${flightDuration}
                    </span>
                    <span class="flex items-center gap-1 text-xs text-gray-500 font-medium uppercase tracking-wider">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      ${flightDate}
                    </span>
                    ${flight.status === 'abandoned' ? '<span class="text-xs text-red-500 font-medium">Abandoned</span>' : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        flightList.appendChild(flightCard);
    });
}

function filterFlights(searchTerm, allFlights) {
    if (!searchTerm || searchTerm.trim() === '') {
        renderFlights(allFlights);
        return;
    }

    const filtered = allFlights.filter(flight => {
        const objective = (flight.objective || '').toLowerCase();
        const fromCode = (flight.from_code || '').toLowerCase();
        const toCode = (flight.to_code || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        
        return objective.includes(search) || 
               fromCode.includes(search) || 
               toCode.includes(search);
    });
    
    renderFlights(filtered);
}

// Restore theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = `theme-${savedTheme}`;

let allFlights = [];

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    // Back button
    const backBtn = document.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => {
        filterFlights(e.target.value, allFlights);
    });

    // Load flights from database
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        try {
            // Initialize database
            await initDatabase();

            // Get all flights for user (excluding in-progress)
            // We'll get completed and abandoned sessions separately, then combine
            const completedFlights = await getFocusSessionsByUser(user.uid, {
                status: 'completed',
                limit: 100,
                orderBy: 'start_time DESC'
            });

            const abandonedFlights = await getFocusSessionsByUser(user.uid, {
                status: 'abandoned',
                limit: 100,
                orderBy: 'start_time DESC'
            });

            // Combine and sort by start_time
            allFlights = [...(completedFlights || []), ...(abandonedFlights || [])]
                .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
                .slice(0, 100); // Limit to 100 most recent

            renderFlights(allFlights);
        } catch (error) {
            console.error('Failed to load flights:', error);
            renderFlights([]);
        }
    });
});
// Restore theme
const savedTheme = localStorage.getItem('theme');
const themeToApply = (!savedTheme || savedTheme === 'dark') ? 'light' : savedTheme;
document.body.className = `theme-${themeToApply}`;

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    const flightData = JSON.parse(localStorage.getItem('currentFlight') || '{}');
    const newFlightBtn = document.getElementById('new-flight-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');

    // Display flight summary
    if (flightData.duration) {
        document.getElementById('flight-duration').textContent = flightData.duration;
    } else if (flightData.durationMinutes) {
        const hours = Math.floor(flightData.durationMinutes / 60);
        const minutes = flightData.durationMinutes % 60;
        if (hours > 0) {
            document.getElementById('flight-duration').textContent = `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim();
        } else {
            document.getElementById('flight-duration').textContent = `${minutes}m`;
        }
    } else {
        document.getElementById('flight-duration').textContent = 'N/A';
    }

    if (flightData.objective) {
        document.getElementById('flight-objective').textContent = flightData.objective;
    } else {
        document.getElementById('flight-objective').textContent = 'Focus Session';
    }

    // Format completion time
    if (flightData.endTime) {
        const endDate = new Date(flightData.endTime);
        const timeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('flight-time').textContent = timeStr;
    } else {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('flight-time').textContent = timeStr;
    }

    /* ---------- NEW FLIGHT BUTTON ---------- */
    newFlightBtn?.addEventListener('click', () => {
        // Clear current flight data
        localStorage.removeItem('currentFlight');

        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'plan-flight.html';
        }, 300);
    });

    /* ---------- DASHBOARD BUTTON ---------- */
    dashboardBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    });
});
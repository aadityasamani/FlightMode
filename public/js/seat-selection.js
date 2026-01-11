let selectedSeat = null;

// Restore theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = `theme-${savedTheme}`;

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    // Load and display flight plan
    const flightPlan = JSON.parse(localStorage.getItem('flightPlan') || '{}');
    const routeDisplay = document.getElementById('routeDisplay');
    
    if (flightPlan.fromCode && flightPlan.toCode && routeDisplay) {
        routeDisplay.innerHTML = `
            <div class="text-sm font-semibold text-blue-600">
              ${flightPlan.fromCode} → ${flightPlan.toCode} • ${flightPlan.duration}
            </div>
        `;
    }

    // Generate seats
    generateSeats();

    // Setup proceed button
    const takeOffBtn = document.getElementById('takeOffBtn');
    takeOffBtn?.addEventListener('click', proceedToBoarding);
});

/* ---------- GENERATE SEATS ---------- */
function generateSeats() {
    const seatGrid = document.getElementById('seatGrid');
    if (!seatGrid) return;

    const rows = 20;
    const columns = ['A', 'B', 'C', 'D', 'E', 'F'];

    for (let row = 1; row <= rows; row++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'flex items-center justify-center gap-2';

        // Row number
        const rowNumber = document.createElement('div');
        rowNumber.className = 'row-number';
        rowNumber.textContent = row;
        rowDiv.appendChild(rowNumber);

        // Seats A, B, C
        for (let i = 0; i < 3; i++) {
            const seat = createSeat(row + columns[i]);
            rowDiv.appendChild(seat);
        }

        // Aisle
        const aisle = document.createElement('div');
        aisle.className = 'aisle';
        rowDiv.appendChild(aisle);

        // Seats D, E, F
        for (let i = 3; i < 6; i++) {
            const seat = createSeat(row + columns[i]);
            rowDiv.appendChild(seat);
        }

        seatGrid.appendChild(rowDiv);
    }
}

/* ---------- CREATE SEAT ELEMENT ---------- */
function createSeat(seatId) {
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.textContent = seatId;
    seat.addEventListener('click', () => selectSeat(seatId));
    return seat;
}

/* ---------- SELECT SEAT ---------- */
function selectSeat(seatId) {
    // Remove previous selection
    const allSeats = document.querySelectorAll('.seat');
    allSeats.forEach(seat => seat.classList.remove('selected'));

    // Select new seat
    allSeats.forEach(seat => {
        if (seat.textContent === seatId) {
            seat.classList.add('selected');
            selectedSeat = seatId;
        }
    });

    // Enable button
    const takeOffBtn = document.getElementById('takeOffBtn');
    if (takeOffBtn) {
        takeOffBtn.disabled = false;
    }
}

/* ---------- PROCEED TO BOARDING ---------- */
function proceedToBoarding() {
    if (!selectedSeat) {
        alert('Please select a seat');
        return;
    }

    // Get flight plan from localStorage
    const flightPlan = JSON.parse(localStorage.getItem('flightPlan') || '{}');

    // Update flight data with seat selection
    const flightData = {
        ...flightPlan,
        seat: selectedSeat,
        startTime: new Date().toISOString()
    };

    // Store complete flight data (use currentFlight for in-flight.js compatibility)
    localStorage.setItem('currentFlight', JSON.stringify(flightData));
    // Also keep flightPlan for backward compatibility if needed
    localStorage.setItem('flightPlan', JSON.stringify(flightData));

    // Navigate to boarding pass
    document.body.classList.add('fade-out');
    setTimeout(() => {
        window.location.href = 'boarding-pass.html';
    }, 300);
}
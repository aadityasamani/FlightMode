// Restore theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = `theme-${savedTheme}`;

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    // Load flight data
    const flightData = JSON.parse(localStorage.getItem('currentFlight') || '{}');

    // Populate boarding pass
    const fromCodeEl = document.getElementById('fromCode');
    const toCodeEl = document.getElementById('toCode');
    const seatNumberEl = document.getElementById('seatNumber');
    const durationDisplayEl = document.getElementById('durationDisplay');
    const objectiveTextEl = document.getElementById('objectiveText');

    if (flightData.fromCode && fromCodeEl) {
        fromCodeEl.textContent = flightData.fromCode;
    }

    if (flightData.toCode && toCodeEl) {
        toCodeEl.textContent = flightData.toCode;
    }

    if (flightData.seat && seatNumberEl) {
        seatNumberEl.textContent = flightData.seat;
    }

    if (flightData.duration && durationDisplayEl) {
        durationDisplayEl.textContent = flightData.duration;
    }

    if (flightData.objective && objectiveTextEl) {
        objectiveTextEl.textContent = flightData.objective;
    }

    /* ---------- FLIP CARD FUNCTIONALITY ---------- */
    const boardingPass = document.getElementById('boardingPass');
    const continueBtn = document.querySelector('.continue-btn');

    boardingPass?.addEventListener('click', () => {
        if (boardingPass) {
            boardingPass.classList.toggle('flipped');
        }
    });

    /* ---------- CONTINUE TO FLIGHT ---------- */
    continueBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'in-flight.html';
        }, 300);
    });
});
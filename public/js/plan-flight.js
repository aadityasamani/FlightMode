// Restore theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = `theme-${savedTheme}`;

let fromCity = null;
let toCity = null;
let selectedDuration = null;

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById('back-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const takeOffBtn = document.getElementById('takeOffBtn');
    const objectiveInput = document.getElementById('objectiveInput');
    const fromTrigger = document.getElementById('from-trigger');
    const toTrigger = document.getElementById('to-trigger');
    const fromMenu = document.getElementById('from-menu');
    const toMenu = document.getElementById('to-menu');

    /* ---------- BACK BUTTON ---------- */
    backBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    });

    /* ---------- CANCEL BUTTON ---------- */
    cancelBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    });

    /* ---------- TOGGLE SELECT MENU ---------- */
    fromTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        toMenu.classList.remove('open');
        fromMenu.classList.toggle('open');
    });

    toTrigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        fromMenu.classList.remove('open');
        toMenu.classList.toggle('open');
    });

    /* ---------- SELECT CITY ---------- */
    fromMenu?.querySelectorAll('.select-item').forEach(item => {
        item.addEventListener('click', () => {
            const code = item.dataset.code;
            const name = item.dataset.name;
            const displayText = `${code} — ${name}`;

            fromCity = { code, name, display: displayText };
            document.getElementById('fromValue').textContent = displayText;
            document.getElementById('fromValue').classList.remove('muted');
            fromMenu.classList.remove('open');

            calculateDuration();
            updateTakeOffButton();
        });
    });

    toMenu?.querySelectorAll('.select-item').forEach(item => {
        item.addEventListener('click', () => {
            const code = item.dataset.code;
            const name = item.dataset.name;
            const displayText = `${code} — ${name}`;

            toCity = { code, name, display: displayText };
            document.getElementById('toValue').textContent = displayText;
            document.getElementById('toValue').classList.remove('muted');
            toMenu.classList.remove('open');

            calculateDuration();
            updateTakeOffButton();
        });
    });

    /* ---------- CLOSE MENUS WHEN CLICKING OUTSIDE ---------- */
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.select-trigger') && !e.target.closest('.select-menu')) {
            fromMenu.classList.remove('open');
            toMenu.classList.remove('open');
        }
    });

    /* ---------- CALCULATE DURATION ---------- */
    function calculateDuration() {
        if (!fromCity || !toCity) return;

        // Simulate flight duration calculation (1-3 hours)
        const baseMinutes = 60 + Math.floor(Math.random() * 120);
        const hours = Math.floor(baseMinutes / 60);
        const mins = baseMinutes % 60;

        selectedDuration = {
            display: `${hours}h ${mins}m`,
            minutes: baseMinutes
        };
        document.getElementById('duration').textContent = selectedDuration.display;
    }

    /* ---------- UPDATE TAKEOFF BUTTON ---------- */
    function updateTakeOffButton() {
        const objective = objectiveInput.value.trim();

        if (fromCity && toCity && objective) {
            takeOffBtn.disabled = false;
        } else {
            takeOffBtn.disabled = true;
        }
    }

    objectiveInput?.addEventListener('input', updateTakeOffButton);

    /* ---------- TAKEOFF BUTTON ---------- */
    takeOffBtn?.addEventListener('click', () => {
        const objective = objectiveInput.value.trim();

        if (!fromCity || !toCity) {
            alert('Please select both origin and destination');
            return;
        }

        if (!objective) {
            alert('Please enter a flight objective');
            return;
        }

        if (!selectedDuration) {
            // Calculate duration if not already calculated
            calculateDuration();
        }

        // Store flight plan (use flightPlan for seat-selection.js compatibility)
        const flightPlan = {
            from: fromCity.display,
            to: toCity.display,
            fromCode: fromCity.code,
            toCode: toCity.code,
            duration: selectedDuration.display,
            durationMinutes: selectedDuration.minutes,
            objective: objective,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('flightPlan', JSON.stringify(flightPlan));

        // Navigate to seat selection
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'seat-selection.html';
        }, 300);
    });
});
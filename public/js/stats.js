// Import database functions
import { getSessionStats, getFocusSessionsByUser, initDatabase } from './database.js';

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

// Restore theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.className = `theme-${savedTheme}`;

let avgDurationChart = null;
let weeklyChart = null;
let peakTimeChart = null;

/* ------------------ CALCULATE STATS FROM DATABASE ------------------ */
async function loadStatsFromDatabase(userId) {
    try {
        await initDatabase();

        // Get all completed sessions
        const sessions = await getFocusSessionsByUser(userId, {
            status: 'completed',
            limit: 1000,
            orderBy: 'start_time DESC'
        });

        // Calculate average duration
        const avgDuration = sessions.length > 0
            ? sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sessions.length
            : 0;

        // Find longest session
        const longestSession = sessions.length > 0
            ? sessions.reduce((longest, s) => (s.duration_minutes || 0) > (longest.duration_minutes || 0) ? s : longest, sessions[0])
            : null;

        // Calculate weekly focus time (last 7 days)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weeklySessions = sessions.filter(s => {
            const sessionDate = new Date(s.start_time);
            return sessionDate >= weekAgo;
        });

        // Group by day of week
        const weeklyData = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
        weeklySessions.forEach(s => {
            const sessionDate = new Date(s.start_time);
            const dayOfWeek = (sessionDate.getDay() + 6) % 7; // Monday = 0, Sunday = 6
            weeklyData[dayOfWeek] += (s.duration_minutes || 0) / 60; // Convert to hours
        });

        // Calculate peak time (hour of day with most sessions)
        const hourlyCounts = new Array(24).fill(0);
        sessions.forEach(s => {
            try {
                const sessionDate = new Date(s.start_time);
                const hour = sessionDate.getHours();
                hourlyCounts[hour]++;
            } catch (e) {
                // Skip invalid dates
            }
        });

        // Find peak hours (6 AM to 9 PM)
        const peakHours = [6, 9, 12, 15, 18, 21]; // 6 AM, 9 AM, 12 PM, 3 PM, 6 PM, 9 PM
        const peakData = peakHours.map(hour => {
            return Math.min(100, (hourlyCounts[hour] || 0) * 10); // Scale to percentage (max 100%)
        });

        return {
            avgDuration: Math.round(avgDuration),
            longestSession: longestSession ? longestSession.duration_minutes : 0,
            weeklyData: weeklyData,
            peakData: peakData
        };
    } catch (error) {
        console.error('Failed to load stats from database:', error);
        return {
            avgDuration: 0,
            longestSession: 0,
            weeklyData: [0, 0, 0, 0, 0, 0, 0],
            peakData: [0, 0, 0, 0, 0, 0]
        };
    }
}

/* ------------------ UPDATE CHARTS ------------------ */
let centerTextValue = '0m';

function updateCharts(stats) {
    // Update Average Duration Chart
    if (avgDurationChart) {
        const totalMinutes = stats.avgDuration || 0;
        const remaining = Math.max(0, 60 - totalMinutes); // Assume 60 min target
        avgDurationChart.data.datasets[0].data = [totalMinutes, remaining];
        centerTextValue = totalMinutes > 0 ? `${totalMinutes}m` : '0m';
        avgDurationChart.update();
    }

    // Update Weekly Chart
    if (weeklyChart) {
        weeklyChart.data.datasets[0].data = stats.weeklyData;
        weeklyChart.update();
    }

    // Update Peak Time Chart
    if (peakTimeChart) {
        peakTimeChart.data.datasets[0].data = stats.peakData;
        peakTimeChart.update();
    }

    // Update Longest Session display
    const longestEl = document.getElementById('longest-session');
    if (longestEl) {
        if (stats.longestSession > 0) {
            const hours = Math.floor(stats.longestSession / 60);
            const mins = stats.longestSession % 60;
            if (hours > 0) {
                longestEl.textContent = `${hours}h ${mins > 0 ? mins + 'm' : ''}`.trim();
            } else {
                longestEl.textContent = `${mins}m`;
            }
        } else {
            longestEl.textContent = '0m';
        }
    }

    // Show/Hide Insights
    const insightsSection = document.getElementById('insights-section');
    if (insightsSection) {
        if (stats.avgDuration > 0 || stats.longestSession > 0) {
            insightsSection.style.display = 'block';
        } else {
            insightsSection.style.display = 'none';
        }
    }
}

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    });

    // Chart configuration
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Initialize charts with default data (will be updated from database)
    const avgDurationCtx = document.getElementById('avgDurationChart');
    if (avgDurationCtx) {
        avgDurationChart = new Chart(avgDurationCtx, {
            type: 'doughnut',
            data: {
                labels: ['Focus Time', 'Remaining'],
                datasets: [{
                    data: [0, 60],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(229, 231, 235, 0.3)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw: function (chart) {
                    const width = chart.width;
                    const height = chart.height;
                    const ctx = chart.ctx;
                    ctx.restore();
                    const fontSize = (height / 80).toFixed(2);
                    ctx.font = `bold ${fontSize}em sans-serif`;
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = "#3b82f6";
                    const text = centerTextValue || "0m";
                    const textX = Math.round((width - ctx.measureText(text).width) / 2);
                    const textY = height / 2;
                    ctx.fillText(text, textX, textY);
                    ctx.save();
                }
            }]
        });
    }

    const weeklyCtx = document.getElementById('weeklyChart');
    if (weeklyCtx) {
        weeklyChart = new Chart(weeklyCtx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Hours',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(234, 179, 8, 0.8)',
                    borderRadius: 8,
                    barThickness: 24
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 4,
                        ticks: {
                            callback: function (value) {
                                return value + 'h';
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.parsed.y + ' hours';
                            }
                        }
                    }
                }
            }
        });
    }

    const peakTimeCtx = document.getElementById('peakTimeChart');
    if (peakTimeCtx) {
        peakTimeChart = new Chart(peakTimeCtx, {
            type: 'line',
            data: {
                labels: ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'],
                datasets: [{
                    label: 'Focus Level',
                    data: [0, 0, 0, 0, 0, 0],
                    fill: true,
                    backgroundColor: 'rgba(251, 113, 133, 0.2)',
                    borderColor: 'rgba(251, 113, 133, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: 'rgba(251, 113, 133, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return 'Focus: ' + context.parsed.y + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // Load stats from database
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        try {
            const stats = await loadStatsFromDatabase(user.uid);
            updateCharts(stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
            // Charts will show default (0) values
        }
    });
});
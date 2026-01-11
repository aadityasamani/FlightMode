document.addEventListener('DOMContentLoaded', () => {
    // Duration of splash screen in ms
    // Matches the progress bar animation (2s + 0.8s delay approx)
    const SPLASH_DURATION = 3000;

    // Preload dashboard resources if possible here

    setTimeout(() => {
        // Redirect to dashboard
        // The dashboard page handles auth checking via auth-guard.js
        window.location.href = 'pages/dashboard.html';
    }, SPLASH_DURATION);
});

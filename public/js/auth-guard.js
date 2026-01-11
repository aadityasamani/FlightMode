import { auth } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

/* ------------------ AUTH GUARD ------------------ */
// Check if user is logged in
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Redirect to auth page if not logged in
        // Store current path to redirect back after login (optional future enhancement)
        console.log("User not logged in, redirecting to auth.html");
        window.location.href = "auth.html";
    } else {
        // User is logged in, allow access
        console.log("User logged in:", user.email);
        // Dispatch event in case other scripts need to know auth is ready
        window.dispatchEvent(new CustomEvent('auth-ready', { detail: user }));
    }
});

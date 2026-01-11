import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/* ------------------ FIREBASE CONFIG ------------------ */
const firebaseConfig = {
    apiKey: "AIzaSyC8WU_hxbnFLW83AwOKhTevuJM_jYFJZRs",
    authDomain: "flightmode-18b9d.firebaseapp.com",
    projectId: "flightmode-18b9d",
    storageBucket: "flightmode-18b9d.firebasestorage.app",
    messagingSenderId: "346833560778",
    appId: "1:346833560778:web:e552b0062c9ac18dcb0033"
};

/* ------------------ INITIALIZE ------------------ */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

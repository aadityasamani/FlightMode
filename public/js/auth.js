/* ------------------ FIREBASE IMPORTS ------------------ */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { app, auth } from './firebase-init.js';

const provider = new GoogleAuthProvider();

/* ------------------ DOM SAFE ZONE ------------------ */
document.addEventListener("DOMContentLoaded", () => {

  /* ---------- ELEMENTS ---------- */
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  const loginTab = document.getElementById("login-tab");
  const signupTab = document.getElementById("signup-tab");

  const loginBtn = document.getElementById("login-btn");
  const signupBtn = document.getElementById("signup-btn");
  const googleBtn = document.getElementById("google-btn");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const signupEmail = document.getElementById("signup-email");
  const signupPassword = document.getElementById("signup-password");

  /* ---------- TAB SWITCH ---------- */
  loginTab?.addEventListener("click", () => switchTab("login"));
  signupTab?.addEventListener("click", () => switchTab("signup"));



  /* ---------- PASSWORD TOGGLE ---------- */
  document.querySelectorAll(".toggle-password").forEach(btn => {
    btn.addEventListener("click", () => {
      togglePasswordVisibility(btn.dataset.target, btn);
    });
  });

  /* ---------- LOGIN ---------- */
  loginBtn?.addEventListener("click", async () => {
    const email = emailInput?.value;
    const password = passwordInput?.value;

    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  });

  /* ---------- SIGNUP ---------- */
  signupBtn?.addEventListener("click", async () => {
    const email = signupEmail?.value;
    const password = signupPassword?.value;

    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert(err.message);
    }
  });

  /* ---------- GOOGLE AUTH ---------- */
  googleBtn?.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert(err.message);
    }
  });

});

/* ------------------ AUTH STATE ------------------ */
onAuthStateChanged(auth, user => {
  if (user) {
    window.location.href = "dashboard.html";
  }
});

/* ------------------ UI FUNCTIONS ------------------ */

function switchTab(tab) {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  const loginTab = document.getElementById("login-tab");
  const signupTab = document.getElementById("signup-tab");

  if (tab === "login") {
    // Forms
    signupForm.classList.remove("active-form");
    setTimeout(() => loginForm.classList.add("active-form"), 50);

    // Tabs (THIS was missing)
    loginTab.classList.add("active");
    signupTab.classList.remove("active");
  } else {
    // Forms
    loginForm.classList.remove("active-form");
    setTimeout(() => signupForm.classList.add("active-form"), 50);

    // Tabs (THIS was missing)
    signupTab.classList.add("active");
    loginTab.classList.remove("active");
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const eye = btn.querySelector(".eye-icon");
  const eyeOff = btn.querySelector(".eye-off-icon");

  const show = input.type === "password";
  input.type = show ? "text" : "password";
  eye.style.display = show ? "none" : "block";
  eyeOff.style.display = show ? "block" : "none";
}

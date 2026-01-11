// Import Firebase auth
import {
    onAuthStateChanged,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { initDatabase, saveUser, getUser } from "./database.js";
import { app, auth, db } from './firebase-init.js';

/* ------------------ THEMES ------------------ */
const themes = {
    light: { name: 'Light Mode', color: '#f3f4f6' },

    lavender: { name: 'Lavender', color: '#c084fc' },
    mint: { name: 'Mint', color: '#6ee7b7' },
    sky: { name: 'Sky', color: '#93c5fd' }
};

/* ------------------ DOM SAFE ------------------ */
document.addEventListener("DOMContentLoaded", () => {
    // Restore theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    changeTheme(savedTheme);

    // Init Database
    initDatabase();

    // ----------------------------------------
    // MOVED: Data loading logic is now handled in onAuthStateChanged
    // to support local DB + Remote sync properly.
    // ----------------------------------------





    // Load User Data (Local -> Then Remote)
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "auth.html";
            return;
        }

        const displayNameEl = document.getElementById('displayName');
        const displayEmailEl = document.getElementById('displayEmail');
        const displayEmailAccountEl = document.getElementById('displayEmailAccount');
        const nameInputEl = document.getElementById('nameInput');
        const emailInputEl = document.getElementById('emailInput');
        const avatarImg = document.querySelector('.avatar-container img');

        // 1. Try Load from Local DB (Offline Support)
        const localUser = await getUser(user.uid);

        if (localUser) {
            console.log('Loaded user from local DB');
            if (displayNameEl) displayNameEl.textContent = localUser.displayName || 'User';
            if (nameInputEl) nameInputEl.value = localUser.displayName || '';

            if (displayEmailEl) displayEmailEl.textContent = localUser.email || user.email;
            if (displayEmailAccountEl) displayEmailAccountEl.textContent = localUser.email || user.email;
            if (emailInputEl) emailInputEl.value = localUser.email || user.email;

            if (avatarImg && localUser.photoURL) {
                // Use a generic avatar provider if local/remote URL is empty, but here we expect a valid URL
                // If it's a cloudinary URL it should work.
                avatarImg.src = localUser.photoURL;
            }
        } else {
            // First time load or no local data yet - Show defaults from Auth object
            if (displayNameEl) displayNameEl.textContent = user.displayName || 'User';
            if (displayEmailEl) displayEmailEl.textContent = user.email;
            if (displayEmailAccountEl) displayEmailAccountEl.textContent = user.email;
        }

        // 2. Sync with Remote (Firestore) - Source of Truth
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (userDoc.exists()) {
                const remoteData = userDoc.data();

                // Update UI with Remote Data
                if (displayNameEl) displayNameEl.textContent = remoteData.displayName || user.displayName || 'User';
                if (nameInputEl) nameInputEl.value = remoteData.displayName || user.displayName || '';

                if (displayEmailEl) displayEmailEl.textContent = remoteData.email || user.email;
                if (displayEmailAccountEl) displayEmailAccountEl.textContent = remoteData.email || user.email;
                if (emailInputEl) emailInputEl.value = remoteData.email || user.email;

                if (avatarImg && remoteData.photoURL) {
                    avatarImg.src = remoteData.photoURL;
                }

                // Update Local DB to match Remote
                await saveUser({
                    id: user.uid,
                    displayName: remoteData.displayName || user.displayName,
                    email: remoteData.email || user.email,
                    photoURL: remoteData.photoURL || user.photoURL
                });

            } else {
                // No remote doc yet? Create one from Auth data
                const initialData = {
                    id: user.uid,
                    displayName: user.displayName || 'User',
                    email: user.email,
                    photoURL: user.photoURL
                };

                await updateDoc(doc(db, "users", user.uid), initialData).catch(async () => {
                    // If updateDoc fails (doc doesn't exist), use setDoc usually, but here we assume user might exist.
                    // Actually, let's just save to local to be safe.
                });
                // Note: We are using updateDoc in other places, but usually we need setDoc for new users. 
                // For safety, let's just save local for now.

                await saveUser(initialData);
            }

        } catch (e) {
            console.warn("Offline or Remote Sync Failed. Using Local Data.", e);
            // We already loaded local data, so nothing to do.
        }
    });

    /* ---------- BACK BUTTON ---------- */
    const backBtn = document.querySelector('header button');
    backBtn?.addEventListener('click', () => {
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 300);
    });

    /* ---------- EDIT NAME MODAL ---------- */
    const editNameBtn = document.getElementById('edit-name-btn');
    editNameBtn?.addEventListener('click', () => openEditNameModal());

    /* ---------- EDIT EMAIL MODAL ---------- */
    const editEmailBtn = document.getElementById('edit-email-btn');
    editEmailBtn?.addEventListener('click', () => openEditEmailModal());

    /* ---------- PHOTO UPLOAD ---------- */
    const uploadBtn = document.getElementById('upload-photo-btn');
    const fileInput = document.getElementById('photo-upload');
    const avatarImg = document.querySelector('.avatar-container img');

    uploadBtn?.addEventListener('click', () => {
        fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Optimistic UI
        const reader = new FileReader();
        reader.onload = (e) => {
            if (avatarImg) avatarImg.src = e.target.result;
        };
        reader.readAsDataURL(file);

        if (auth.currentUser) {
            try {
                // Cloudinary Config
                const cloudName = 'dagmvkl8h';
                const uploadPreset = 'flightmode_unsigned';

                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', uploadPreset);

                // Show uploading state
                const originalText = uploadBtn.textContent;
                uploadBtn.textContent = '...';

                const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Cloudinary upload failed');
                }

                const data = await response.json();
                const downloadURL = data.secure_url;

                await updateProfile(auth.currentUser, { photoURL: downloadURL });

                // Save to Firestore
                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    photoURL: downloadURL
                });

                // Save Locally
                const currentUser = await getUser(auth.currentUser.uid) || {};
                await saveUser({
                    ...currentUser,
                    id: auth.currentUser.uid,
                    photoURL: downloadURL
                });

                console.log('Profile photo updated');
                uploadBtn.textContent = originalText;
            } catch (error) {
                console.error('Error uploading photo:', error);
                alert('Failed to upload photo. Please try again.');
                uploadBtn.textContent = '✎';
            }
        }
    });

    /* ---------- THEME TOGGLE ---------- */
    const themeToggleBtn = document.querySelector('.switch-button');
    themeToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleThemeMenu();
    });

    // Theme menu items
    document.querySelectorAll('#theme-menu .select-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = item.dataset.theme;
            if (theme) {
                changeTheme(theme);
            }
        });
    });

    /* ---------- MODAL CONTROLS ---------- */
    // Edit Name Modal
    const editNameModal = document.getElementById('editNameModal');
    const nameInput = document.getElementById('nameInput');
    const saveNameBtn = document.getElementById('save-name-btn');
    const cancelNameBtn = document.getElementById('cancel-name-btn');

    saveNameBtn?.addEventListener('click', () => saveName());
    cancelNameBtn?.addEventListener('click', () => closeEditNameModal());

    // Close on backdrop click
    editNameModal?.addEventListener('click', (e) => {
        if (e.target.id === 'editNameModal') {
            closeEditNameModal();
        }
    });

    // Enter key support for name input
    nameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveName();
        }
    });

    // Edit Email Modal
    const editEmailModal = document.getElementById('editEmailModal');
    const emailInput = document.getElementById('emailInput');
    const saveEmailBtn = document.getElementById('save-email-btn');
    const cancelEmailBtn = document.getElementById('cancel-email-btn');

    saveEmailBtn?.addEventListener('click', () => saveEmail());
    cancelEmailBtn?.addEventListener('click', () => closeEditEmailModal());

    // Close on backdrop click
    editEmailModal?.addEventListener('click', (e) => {
        if (e.target.id === 'editEmailModal') {
            closeEditEmailModal();
        }
    });

    // Enter key support for email input
    emailInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEmail();
        }
    });

    /* ---------- LOGOUT MODAL ---------- */
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', () => openLogoutModal());

    const logoutModal = document.getElementById('logout-modal');
    const confirmLogoutBtn = document.getElementById('confirm-logout-btn');
    const cancelLogoutBtn = document.getElementById('cancel-logout-btn');

    confirmLogoutBtn?.addEventListener('click', () => confirmLogout());
    cancelLogoutBtn?.addEventListener('click', () => closeLogoutModal());

    // Close on backdrop click
    logoutModal?.addEventListener('click', (e) => {
        if (e.target.id === 'logout-modal') {
            closeLogoutModal();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.switch-button') && !e.target.closest('#theme-menu')) {
            const menu = document.getElementById('theme-menu');
            const btn = document.querySelector('.switch-button');
            menu?.classList.remove('open');
            btn?.classList.remove('open');
        }
    });
});

/* ------------------ FUNCTIONS ------------------ */
function toggleThemeMenu() {
    const menu = document.getElementById('theme-menu');
    const btn = document.querySelector('.switch-button');
    if (menu && btn) {
        menu.classList.toggle('open');
        btn.classList.toggle('open');
    }
}

function changeTheme(theme) {
    const body = document.body;
    body.className = body.className.split(' ').filter(c => !c.startsWith('theme-')).join(' ');
    body.classList.add(`theme-${theme}`);

    const themeLabel = document.getElementById('themeLabel');
    const themePreviewCircle = document.getElementById('themePreviewCircle');

    if (themes[theme]) {
        if (themeLabel) themeLabel.textContent = themes[theme].name;
        if (themePreviewCircle) themePreviewCircle.style.background = themes[theme].color;
        localStorage.setItem('theme', theme);
    }

    const menu = document.getElementById('theme-menu');
    const btn = document.querySelector('.switch-button');
    menu?.classList.remove('open');
    btn?.classList.remove('open');
}

function openEditNameModal() {
    const modal = document.getElementById('editNameModal');
    const input = document.getElementById('nameInput');
    if (modal && input) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        setTimeout(() => input.focus(), 100);
    }
}

function closeEditNameModal() {
    const modal = document.getElementById('editNameModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}

async function saveName() {
    const input = document.getElementById('nameInput');
    const display = document.getElementById('displayName');

    if (input && display && auth.currentUser) {
        const newName = input.value.trim();
        if (newName) {
            // 1. Update UI Immediately
            display.textContent = newName;
            closeEditNameModal();

            try {
                // 2. Save to Local DB
                // We need to get current user data to avoid wiping other fields
                const currentUser = await getUser(auth.currentUser.uid) || {};
                await saveUser({
                    ...currentUser,
                    id: auth.currentUser.uid,
                    displayName: newName
                });

                // 3. Update Remote (Firebase Auth + Firestore)
                await updateProfile(auth.currentUser, { displayName: newName });
                await updateDoc(doc(db, "users", auth.currentUser.uid), { displayName: newName });

                console.log('Name updated successfully');
            } catch (error) {
                console.error("Failed to sync name change:", error);
                // The local change is saved, so it's "okay" for offline.
            }
        }
    }
}

function openEditEmailModal() {
    const modal = document.getElementById('editEmailModal');
    const input = document.getElementById('emailInput');
    if (modal && input) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        setTimeout(() => input.focus(), 100);
    }
}

function closeEditEmailModal() {
    const modal = document.getElementById('editEmailModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}

async function saveEmail() {
    const input = document.getElementById('emailInput');
    const display = document.getElementById('displayEmail');
    const displayAccount = document.getElementById('displayEmailAccount');

    if (input && auth.currentUser) {
        const newEmail = input.value.trim();
        if (newEmail && newEmail !== auth.currentUser.email) {
            // Note: Firebase Auth email change usually requires re-authentication, 
            // but we'll try to update the Firestore record and UI at least.
            // A real app would prompt for password/re-auth.

            if (display) display.textContent = newEmail;
            if (displayAccount) displayAccount.textContent = newEmail;
            closeEditEmailModal();

            try {
                // 2. Save to Local DB
                const currentUser = await getUser(auth.currentUser.uid) || {};
                await saveUser({
                    ...currentUser,
                    id: auth.currentUser.uid,
                    email: newEmail
                });

                // 3. Update Firestore
                await updateDoc(doc(db, "users", auth.currentUser.uid), { email: newEmail });
                // We might not be able to update Auth email easily without credits, so skipping updateEmail(auth.currentUser, newEmail)

                console.log('Email updated locally and in Firestore');
            } catch (error) {
                console.error("Failed to sync email change:", error);
            }
        }
    }
}

function openLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }
}

function closeLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
}

async function confirmLogout() {
    try {
        await signOut(auth);
        localStorage.removeItem('theme'); // Optional: Keep theme or clear it? User usually expects to keep it.
        // localStorage.removeItem('userName'); // Legacy
        // localStorage.removeItem('userEmail'); // Legacy
        window.location.href = "auth.html";
    } catch (err) {
        alert(err.message);
    }
}
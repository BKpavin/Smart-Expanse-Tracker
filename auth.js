import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in, redirect to dashboard
        window.location.replace('index.html');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Theme setup based on local storage settings
    const settings = JSON.parse(localStorage.getItem('settings')) || { darkMode: true };
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const themeToggle = document.getElementById('theme-toggle');

    function applyTheme() {
        if (settings.darkMode) {
            body.classList.add('dark-mode');
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            body.classList.remove('dark-mode');
            if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    applyTheme();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            settings.darkMode = !settings.darkMode;
            localStorage.setItem('settings', JSON.stringify(settings));
            applyTheme();
        });
    }

    // Toggle between Login and Signup
    const loginContainer = document.getElementById('login-container');
    const signupContainer = document.getElementById('signup-container');
    const goToSignup = document.getElementById('go-to-signup');
    const goToLogin = document.getElementById('go-to-login');

    if (goToSignup && goToLogin) {
        goToSignup.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.classList.remove('active');
            signupContainer.classList.add('active');
        });

        goToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            signupContainer.classList.remove('active');
            loginContainer.classList.add('active');
        });
    }

    // Forgot password toggle
    const forgotPasswordLink = document.querySelector('.forgot-link');
    const forgotPasswordContainer = document.getElementById('forgot-password-container');
    const backToLoginLink = document.getElementById('back-to-login');

    if (forgotPasswordLink && forgotPasswordContainer && backToLoginLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.classList.remove('active');
            forgotPasswordContainer.style.display = 'block';
            
            // For animation
            setTimeout(() => {
                forgotPasswordContainer.classList.add('active');
            }, 10);
        });

        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordContainer.classList.remove('active');
            setTimeout(() => {
                forgotPasswordContainer.style.display = 'none';
                loginContainer.classList.add('active');
            }, 300);
        });
    }

    // Password visibility toggle
    const togglePasswords = document.querySelectorAll('.toggle-password');
    togglePasswords.forEach(icon => {
        icon.addEventListener('click', () => {
            const input = icon.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            }
        });
    });

    // Form Submissions
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            console.log("Attempting login with email: '" + email + "'");
            
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.disabled = true;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // onAuthStateChanged will handle the redirect
            } catch (error) {
                alert("Login failed: " + error.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;
            
            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }
            
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.disabled = true;

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, {
                    displayName: name
                });
                // onAuthStateChanged will handle the redirect
            } catch (error) {
                alert("Signup failed: " + error.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('forgot-email').value;
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.disabled = true;

            try {
                await sendPasswordResetEmail(auth, email);
                alert("Password reset email sent! Check your inbox.");
                btn.innerHTML = originalText;
                btn.disabled = false;
                document.getElementById('back-to-login').click(); // Auto go back
            } catch (error) {
                alert("Error sending reset email: " + error.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Google Sign-In
    const googleProvider = new GoogleAuthProvider();
    
    async function handleGoogleSignIn(e) {
        e.preventDefault();
        try {
            await signInWithPopup(auth, googleProvider);
            // onAuthStateChanged will handle the redirect
        } catch (error) {
            alert("Google Sign-in failed: " + error.message);
        }
    }

    const googleLoginBtn = document.getElementById('google-login-btn');
    const googleSignupBtn = document.getElementById('google-signup-btn');

    if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleSignIn);
    if (googleSignupBtn) googleSignupBtn.addEventListener('click', handleGoogleSignIn);
});

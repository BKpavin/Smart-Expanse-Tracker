import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBX13OEp8zAtsur_jXIRWkbn4oOeBvfVQI",
  authDomain: "smart-expense-tracker-5e75a.firebaseapp.com",
  projectId: "smart-expense-tracker-5e75a",
  storageBucket: "smart-expense-tracker-5e75a.firebasestorage.app",
  messagingSenderId: "632883531825",
  appId: "1:632883531825:web:9241eee6c387a6519bc510",
  measurementId: "G-WM62FLCV85"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

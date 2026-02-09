// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCb1ZmpRaFGsu9BF-LEykuXdgbP3LubrYQ",
    authDomain: "app-financeiro-2-bd953.firebaseapp.com",
    projectId: "app-financeiro-2-bd953",
    storageBucket: "app-financeiro-2-bd953.firebasestorage.app",
    messagingSenderId: "476140047692",
    appId: "1:476140047692:web:d7740912af2e025066d3e9",
    measurementId: "G-SNKFJE1JFS"
};

// Initialize Firebase (prevent re-initialization in dev mode)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore Database
export const db = getFirestore(app);

export default app;

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCb61YDcPFdtefpFTsnuQS3kA66IHNG128",
  authDomain: "algocore-80652.firebaseapp.com",
  databaseURL: "https://algocore-80652-default-rtdb.firebaseio.com",
  projectId: "algocore-80652",
  storageBucket: "algocore-80652.firebasestorage.app",
  messagingSenderId: "563824995926",
  appId: "1:563824995926:web:56e94c313d4bad8ea9d5f7",
  measurementId: "G-MF59KXSF49"
};

// Initialize Firebase app (only if it hasn't been initialized yet)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const auth = getAuth(app);  // Use the initialized app for auth
const googleProvider = new GoogleAuthProvider();

const database = getDatabase(app);  // Use the initialized app for database

export {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  database,
};

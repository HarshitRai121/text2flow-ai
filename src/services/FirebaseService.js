// src/services/FirebaseService.js
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

let app;
let auth;
let db;
let currentUserId = null; // To store the current user's ID

// Initialize Firebase app and services
export const initFirebase = async () => {
  // Use Canvas-provided config if available, otherwise fallback to .env for local
//   const firebaseConfig = typeof __firebase_config !== 'undefined'
//     ? JSON.parse(__firebase_config)
//     : JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG); // Access from .env

  const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };

  if (!app) { // Initialize only once
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Listen for auth state changes and update currentUserId
    onAuthStateChanged(auth, (user) => {
      currentUserId = user ? user.uid : null;
      console.log("Firebase Auth State Changed. User ID:", currentUserId);
    });

    // Handle initial auth token from Canvas or anonymous sign-in
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      try {
        await signInWithCustomToken(auth, __initial_auth_token);
        console.log("Signed in with custom token.");
      } catch (error) {
        console.error("Error signing in with custom token, falling back to anonymous:", error);
        await signInAnonymously(auth);
      }
    } else {
      // If no custom token (e.g., local dev without specific token), sign in anonymously
      await signInAnonymously(auth);
      console.log("Signed in anonymously.");
    }
  }
};

// Getters for Firebase instances and current user ID
export const getCurrentUserId = () => currentUserId;
export const getAuthInstance = () => auth;
export const getFirestoreInstance = () => db;

// Authentication functions
export const loginUser = async (email, password) => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log("User logged in successfully!");
  } catch (error) {
    console.error("Login Error:", error);
    throw error; // Re-throw to be caught by UI
  }
};

export const signupUser = async (email, password) => {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    console.log("User signed up successfully!");
  } catch (error) {
    console.error("Signup Error:", error);
    throw error; // Re-throw to be caught by UI
  }
};

export const signInAnonymouslyUser = async () => {
  try {
    await signInAnonymously(auth);
    console.log("Signed in anonymously.");
  } catch (error) {
    console.error("Anonymous Sign-in Error:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log("User logged out.");
  } catch (error) {
    console.error("Logout Error:", error);
    throw error;
  }
};

// Firestore functions for saving/loading diagrams
export const saveDiagram = async (diagramData) => {
  if (!currentUserId) {
    throw new Error("User not authenticated to save diagram.");
  }
  // __app_id is provided by the Canvas environment at runtime.
  // For local development, we use a default 'default-app-id'.
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const diagramRef = doc(db, `artifacts/${appId}/users/${currentUserId}/diagrams/my_diagram_id`);
  try {
    // Firestore has limitations on deeply nested arrays or complex objects.
    // Stringify the diagramData to ensure it's stored as a single string.
    await setDoc(diagramRef, { data: JSON.stringify(diagramData), lastUpdated: new Date().toISOString() });
    console.log("Diagram saved successfully for user:", currentUserId);
  } catch (error) {
    console.error("Error saving diagram:", error);
    throw error;
  }
};

export const loadDiagram = async () => {
  if (!currentUserId) {
    throw new Error("User not authenticated to load diagram.");
  }
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const diagramRef = doc(db, `artifacts/${appId}/users/${currentUserId}/diagrams/my_diagram_id`);
  try {
    const docSnap = await getDoc(diagramRef);
    if (docSnap.exists()) {
      console.log("Diagram loaded successfully for user:", currentUserId);
      // Parse the stringified data back into an object
      return JSON.parse(docSnap.data().data);
    } else {
      console.log("No diagram found for user:", currentUserId);
      return []; // Return empty array if no diagram exists
    }
  } catch (error) {
    console.error("Error loading diagram:", error);
    throw error;
  }
};

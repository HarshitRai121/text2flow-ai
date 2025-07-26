// src/services/FirebaseService.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let app = null;
let auth = null;
let db = null;
let currentUserId = null; // Store the current user ID

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

export const initFirebase = async () => {
    if (app) {
        console.log("Firebase already initialized.");
        return;
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Set up auth state change listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                console.log("Firebase Auth State Changed. User ID:", currentUserId);
            } else {
                currentUserId = null;
                console.log("Firebase Auth State Changed. No user signed in.");
            }
        });

        // Sign in using custom token or anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
            console.log("Signed in with custom token.");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }

    } catch (error) {
        console.error("Error initializing Firebase:", error);
        throw new Error(`Firebase initialization failed: ${error.message}`);
    }
};

export const getAuthInstance = () => {
    if (!auth) {
        console.error("Auth not initialized. Call initFirebase first.");
        throw new Error("Auth not initialized.");
    }
    return auth;
};

export const getFirestoreInstance = () => {
    if (!db) {
        console.error("Firestore not initialized. Call initFirebase first.");
        throw new Error("Firestore not initialized.");
    }
    return db;
};

export const loginUser = async (email, password) => {
    try {
        // Firebase Auth functions handle user state internally
        // No need to explicitly set user here, onAuthStateChanged will handle it
        await auth.signInWithEmailAndPassword(email, password);
        console.log("User logged in successfully.");
    } catch (error) {
        console.error("Login error:", error);
        throw new Error(error.message);
    }
};

export const signupUser = async (email, password) => {
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        console.log("User signed up successfully.");
    } catch (error) {
        console.error("Signup error:", error);
        throw new Error(error.message);
    }
};

export const signInAnonymouslyUser = async () => {
    try {
        await signInAnonymously(auth);
        console.log("Signed in anonymously.");
    } catch (error) {
        console.error("Anonymous sign-in error:", error);
        throw new Error(error.message);
    }
};

export const logoutUser = async () => {
    try {
        await signOut(auth);
        console.log("User logged out successfully.");
    } catch (error) {
        console.error("Logout error:", error);
        throw new Error(error.message);
    }
};

// --- Firestore Operations ---

// Helper to get the document reference for the current user's diagram
const getDiagramDocRef = () => {
    if (!currentUserId) {
        throw new Error("User not authenticated. Cannot save/load diagram.");
    }
    // Store in /artifacts/{appId}/users/{userId}/diagrams/myDiagram
    return doc(db, `artifacts/${appId}/users/${currentUserId}/diagrams/myDiagram`);
};

export const saveDiagram = async (diagramElements) => {
    if (!db || !currentUserId) {
        await initFirebase(); // Ensure Firebase is initialized and user is authenticated
        if (!currentUserId) {
            throw new Error("Firebase not ready or user not authenticated for saving.");
        }
    }

    try {
        const diagramData = {
            elements: JSON.stringify(diagramElements), // Stringify to handle complex objects/arrays within elements
            lastSaved: new Date().toISOString(),
            userId: currentUserId,
        };
        await setDoc(getDiagramDocRef(), diagramData);
        console.log("Diagram saved successfully for user:", currentUserId);
    } catch (error) {
        console.error("Error saving diagram:", error);
        throw new Error(`Failed to save diagram: ${error.message}`);
    }
};

export const loadDiagram = async () => {
    if (!db || !currentUserId) {
        await initFirebase(); // Ensure Firebase is initialized and user is authenticated
        if (!currentUserId) {
            throw new Error("Firebase not ready or user not authenticated for loading.");
        }
    }

    try {
        const docSnap = await getDoc(getDiagramDocRef());
        if (docSnap.exists()) {
            const data = docSnap.data();
            const loadedElements = JSON.parse(data.elements); // Parse the stringified elements
            console.log("Diagram loaded successfully for user:", currentUserId);
            return loadedElements;
        } else {
            console.log("No diagram found for user:", currentUserId);
            return []; // Return empty array if no diagram exists
        }
    } catch (error) {
        console.error("Error loading diagram:", error);
        throw new Error(`Failed to load diagram: ${error.message}`);
    }
};

// src/services/FirebaseService.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
// Corrected imports for modular v9+ auth functions
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let app = null;
let auth = null;
let db = null;
let currentUserId = null; // Store the current user ID
let isFirebaseInitialized = false; // Track initialization state

// Safely access Canvas global variables, falling back to defaults for local/Vercel
const _appId = typeof window !== 'undefined' && typeof window.__app_id !== 'undefined' ? window.__app_id : 'default-app-id';
const _firebaseConfig = typeof window !== 'undefined' && typeof window.__firebase_config !== 'undefined' ? JSON.parse(window.__firebase_config) : {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};
const _initialAuthToken = typeof window !== 'undefined' && typeof window.__initial_auth_token !== 'undefined' ? window.__initial_auth_token : null;


export const initFirebase = async () => {
  if (isFirebaseInitialized && app) {
    console.log("Firebase already initialized.");
    return;
  }

  try {
    app = initializeApp(_firebaseConfig);
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

    // Sign in using custom token or anonymously on initial load
    if (_initialAuthToken) {
      try {
        await signInWithCustomToken(auth, _initialAuthToken);
        console.log("Signed in with custom token.");
      } catch (error) {
        console.error("Error signing in with custom token, falling back to anonymous:", error);
        await signInAnonymously(auth);
        console.log("Signed in anonymously after custom token failure.");
      }
    } else {
      await signInAnonymously(auth);
      console.log("Signed in anonymously.");
    }

    isFirebaseInitialized = true; // Mark as initialized
    console.log("Firebase initialized successfully.");

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
    await signInWithEmailAndPassword(auth, email, password);
    console.log("User logged in successfully.");
  } catch (error) {
    console.error("Login error:", error);
    throw new Error(error.message);
  }
};

export const signupUser = async (email, password) => {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
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

// Helper to get the collection reference for the current user's diagrams
const getDiagramsCollectionRef = () => {
  if (!currentUserId) {
    throw new Error("User not authenticated. Cannot access diagrams.");
  }
  // Store diagrams in /artifacts/{appId}/users/{userId}/diagrams/
  return collection(db, `artifacts/${_appId}/users/${currentUserId}/diagrams`);
};

/**
 * Saves a diagram with a specific name for the current user.
 * @param {string} diagramName The name of the diagram to save.
 * @param {Array} diagramElements The array of diagram elements to save.
 */
export const saveDiagram = async (diagramName, diagramElements) => {
  if (!db || !currentUserId) {
    // Attempt initialization if not ready, but don't re-init if already in progress
    if (!isFirebaseInitialized) {
      await initFirebase();
    }
    // After init, re-check currentUserId
    if (!currentUserId) {
      throw new Error("Firebase not ready or user not authenticated for saving.");
    }
  }
  if (!diagramName || diagramName.trim() === '') {
    throw new Error("Diagram name cannot be empty.");
  }

  try {
    const diagramDocRef = doc(getDiagramsCollectionRef(), diagramName);
    const diagramData = {
      elements: JSON.stringify(diagramElements), // Stringify to handle complex objects/arrays
      lastSaved: new Date().toISOString(),
      userId: currentUserId,
      name: diagramName, // Store the name within the document
    };
    await setDoc(diagramDocRef, diagramData);
    console.log(`Diagram "${diagramName}" saved successfully for user:`, currentUserId);
  } catch (error) {
    console.error(`Error saving diagram "${diagramName}":`, error);
    throw new Error(`Failed to save diagram "${diagramName}": ${error.message}`);
  }
};

/**
 * Loads a specific diagram for the current user.
 * @param {string} diagramName The name of the diagram to load.
 * @returns {Array} The array of diagram elements, or an empty array if not found.
 */
export const loadDiagram = async (diagramName) => {
  if (!db || !currentUserId) {
    if (!isFirebaseInitialized) {
      await initFirebase();
    }
    if (!currentUserId) {
      throw new Error("Firebase not ready or user not authenticated for loading.");
    }
  }
  if (!diagramName || diagramName.trim() === '') {
    throw new Error("Diagram name cannot be empty for loading.");
  }

  try {
    const diagramDocRef = doc(getDiagramsCollectionRef(), diagramName);
    const docSnap = await getDoc(diagramDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const loadedElements = JSON.parse(data.elements);
      console.log(`Diagram "${diagramName}" loaded successfully for user:`, currentUserId);
      return loadedElements;
    } else {
      console.log(`No diagram "${diagramName}" found for user:`, currentUserId);
      return [];
    }
  } catch (error) {
    console.error(`Error loading diagram "${diagramName}":`, error);
    throw new Error(`Failed to load diagram "${diagramName}": ${error.message}`);
  }
};

/**
 * Lists all saved diagrams for the current user.
 * @returns {Array<{name: string, lastSaved: string}>} An array of diagram metadata.
 */
export const listDiagrams = async () => {
  if (!db || !currentUserId) {
    if (!isFirebaseInitialized) {
      await initFirebase();
    }
    if (!currentUserId) {
      throw new Error("Firebase not ready or user not authenticated for listing diagrams.");
    }
  }

  try {
    const querySnapshot = await getDocs(getDiagramsCollectionRef());
    const diagrams = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      diagrams.push({
        name: data.name,
        lastSaved: data.lastSaved,
      });
    });
    // Sort by lastSaved date, most recent first
    diagrams.sort((a, b) => new Date(b.lastSaved).getTime() - new Date(a.lastSaved).getTime());
    console.log("Listed diagrams for user:", currentUserId, diagrams);
    return diagrams;
  } catch (error) {
    console.error("Error listing diagrams:", error);
    throw new Error(`Failed to list diagrams: ${error.message}`);
  }
};

/**
 * Deletes a specific diagram for the current user.
 * @param {string} diagramName The name of the diagram to delete.
 */
export const deleteDiagram = async (diagramName) => {
  if (!db || !currentUserId) {
    if (!isFirebaseInitialized) {
      await initFirebase();
    }
    if (!currentUserId) {
      throw new Error("Firebase not ready or user not authenticated for deleting.");
    }
  }
  if (!diagramName || diagramName.trim() === '') {
    throw new Error("Diagram name cannot be empty for deletion.");
  }

  try {
    const diagramDocRef = doc(getDiagramsCollectionRef(), diagramName);
    await deleteDoc(diagramDocRef);
    console.log(`Diagram "${diagramName}" deleted successfully for user:`, currentUserId);
  } catch (error) {
    console.error(`Error deleting diagram "${diagramName}":`, error);
    throw new Error(`Failed to delete diagram "${diagramName}": ${error.message}`);
  }
};

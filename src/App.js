// src/App.js
import React, { useState, useEffect, createContext, useContext } from 'react';

// Import FirebaseService functions
// FIX: Ensure all necessary FirebaseService functions are imported
import { initFirebase, getAuthInstance, loginUser, signupUser, signInAnonymouslyUser, logoutUser, saveDiagram, loadDiagram } from './services/FirebaseService';
// Import GeminiAIService
import { geminiService } from './services/GeminiAIService';

// Import page components
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DiagramApp from './pages/DiagramApp';

// Import reusable components
import LoadingSpinner from './components/LoadingSpinner';

// --- Context for Firebase/Auth (Optional but good practice) ---
// This context will provide auth status and functions to any child component
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// --- Main App Component ---
const App = () => {
  // State to manage which page is currently displayed
  const [currentPage, setCurrentPage] = useState('loading'); // Initial state: 'loading'
  const [user, setUser] = useState(null); // Firebase User object
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Initialize Firebase and set up auth listener
  useEffect(() => {
    const setupFirebase = async () => {
      try {
        await initFirebase(); // Initialize Firebase app, auth, firestore
        const auth = getAuthInstance();

        // Listen for auth state changes
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
          setUser(currentUser);
          setIsFirebaseLoading(false);
          // Decide initial page based on auth state
          if (currentUser) {
            // If user is logged in, go directly to diagram app
            setCurrentPage('diagram');
          } else {
            // If no user, show landing page
            setCurrentPage('landing');
          }
        });
        return () => unsubscribe(); // Cleanup listener on unmount
      } catch (error) {
        console.error("Failed to initialize Firebase:", error);
        setAuthError("Failed to connect to our services. Please try again later.");
        setIsFirebaseLoading(false);
        setCurrentPage('landing'); // Even on error, show landing
      }
    };
    setupFirebase();
  }, []); // Run once on component mount

  // Authentication handlers passed down to AuthPage
  const handleLogin = async (email, password) => {
    setAuthError('');
    try {
      await loginUser(email, password);
      // Auth state change listener will automatically update `user` and `currentPage`
    } catch (error) {
      setAuthError(error.message || 'Login failed.');
      console.error("Login error:", error);
    }
  };

  const handleSignup = async (email, password) => {
    setAuthError('');
    try {
      await signupUser(email, password);
      // Auth state change listener will automatically update `user` and `currentPage`
    } catch (error) {
      setAuthError(error.message || 'Signup failed.');
      console.error("Signup error:", error);
    }
  };

  const handleTryAnonymously = async () => {
    setAuthError('');
    try {
      await signInAnonymouslyUser();
      // Auth state change listener will automatically update `user` and `currentPage`
    } catch (error) {
      setAuthError(error.message || 'Failed to sign in anonymously.');
      console.error("Anonymous sign-in error:", error);
    }
  };

  const handleLogout = async () => {
    setAuthError('');
    try {
      await logoutUser();
      // Auth state change listener will automatically update `user` to null
      setCurrentPage('landing'); // Explicitly go back to landing after logout
    } catch (error) {
      setAuthError(error.message || 'Logout failed.');
      console.error("Logout error:", error);
    }
  };

  // Render different pages based on `currentPage` state
  const renderPage = () => {
    if (isFirebaseLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
          <LoadingSpinner className="h-12 w-12 text-blue-600" />
          <p className="ml-3 mt-4 text-lg text-gray-700">Loading services...</p>
        </div>
      );
    }

    switch (currentPage) {
      case 'landing':
        return <LandingPage onStartClick={() => setCurrentPage('auth')} />;
      case 'auth':
        return (
          <AuthPage
            onLogin={handleLogin}
            onSignup={handleSignup}
            onTryAnonymously={handleTryAnonymously}
            error={authError}
            onBackToLanding={() => setCurrentPage('landing')}
          />
        );
      case 'diagram':
        // Pass necessary props to the main diagramming app
        return (
          <DiagramApp
            user={user}
            onLogout={handleLogout}
            geminiService={geminiService}
            // FIX: Pass saveDiagram and loadDiagram functions from FirebaseService
            firebaseService={{ saveDiagram, loadDiagram }} 
          />
        );
      default:
        return <LandingPage onStartClick={() => setCurrentPage('auth')} />;
    }
  };

  return (
    // AuthContext.Provider makes auth status and functions available to all children
    <AuthContext.Provider value={{ user, isFirebaseLoading, authError, handleLogin, handleSignup, handleTryAnonymously, handleLogout }}>
      <div className="font-inter antialiased">
        {renderPage()}
      </div>
    </AuthContext.Provider>
  );
};

export default App;
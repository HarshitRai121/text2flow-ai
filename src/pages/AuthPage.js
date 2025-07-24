// src/pages/AuthPage.js
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react'; // For the back arrow icon

const AuthPage = ({ onLogin, onSignup, onTryAnonymously, error, onBackToLanding }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoginMode) {
      onLogin(email, password);
    } else {
      onSignup(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <button onClick={onBackToLanding} className="text-gray-500 hover:text-gray-700 mb-4 flex items-center">
          <ArrowLeft size={20} className="mr-2" />
          Back
        </button>
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          {isLoginMode ? 'Welcome Back!' : 'Join Text2Flow'}
        </h2>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              id="email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="your@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              id="password"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition-colors duration-200"
          >
            {isLoginMode ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600">
          {isLoginMode ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setIsLoginMode(!isLoginMode)}
            className="text-blue-600 hover:underline font-semibold"
          >
            {isLoginMode ? 'Sign Up' : 'Login'}
          </button>
        </p>
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>
        <button
          onClick={onTryAnonymously}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg shadow-md transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Try Without Login</span>
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
// src/pages/LandingPage.js
import React from 'react';

const LandingPage = ({ onStartClick }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center p-6 text-white text-center">
      <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 animate-fade-in-up">
        Text2Flow <span className="text-blue-200">AI</span>
      </h1>
      <p className="text-xl sm:text-2xl max-w-2xl mb-10 opacity-0 animate-fade-in-up animation-delay-300">
        Transform your ideas into stunning diagrams and flowcharts with the power of AI.
        Simply describe, generate, and visually refine.
      </p>
      <button
        onClick={onStartClick}
        className="bg-white text-purple-700 hover:bg-gray-100 px-8 py-4 rounded-full text-lg font-bold shadow-lg transition-all duration-300 transform hover:scale-105 opacity-0 animate-fade-in-up animation-delay-600"
      >
        Get Started
      </button>
      {/* Add more sections for features, testimonials, screenshots later */}
      <style jsx>{`
        .animate-fade-in-up {
          animation: fadeInUp 1s ease-out forwards;
        }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-600 { animation-delay: 0.6s; }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
// src/pages/DiagramApp.js
import React, { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner'; // Import the spinner

const DiagramApp = ({ user, onLogout, geminiService, firebaseService }) => {
  // This component will eventually contain all the logic from the previous demo's App.js
  // (canvas, AI prompt, element drawing, selection, movement, save/load)

  // Example state and function calls (simplified for this placeholder)
  const [diagramElements, setDiagramElements] = useState([]); // Will be used by canvas
  const [aiPrompt, setAiPrompt] = useState("Generate a simple flowchart.");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [appMessage, setAppMessage] = useState(''); // For app-specific messages

  // Placeholder for AI generation
  const handleGenerateDiagram = async () => {
    setAppMessage('');
    setIsLoadingAI(true);
    try {
      // Call the actual Gemini AIService here (using the mock for now)
      const newElements = await geminiService.generateDiagramFromPrompt(aiPrompt);
      setDiagramElements(newElements); // Update state to trigger canvas re-render later
      setAppMessage('Diagram generated successfully! (Mock)');
    } catch (error) {
      setAppMessage(`Error: ${error.message}`);
      console.error("AI Generation Error:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // Placeholder for Save
  const handleSaveDiagram = async () => {
    setAppMessage('');
    try {
      // Call FirebaseService to save
      await firebaseService.saveDiagram(diagramElements);
      setAppMessage('Diagram saved successfully! (Mock)');
    } catch (error) {
      setAppMessage(`Error saving: ${error.message}`);
      console.error("Save error:", error);
    }
  };

  // Placeholder for Load
  const handleLoadDiagram = async () => {
    setAppMessage('');
    try {
      // Call FirebaseService to load
      const loadedData = await firebaseService.loadDiagram();
      setDiagramElements(loadedData); // Update state to trigger canvas re-render later
      setAppMessage('Diagram loaded successfully! (Mock)');
    } catch (error) {
      setAppMessage(`Error loading: ${error.message}`);
      console.error("Load error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-6">
      <header className="w-full max-w-4xl flex justify-between items-center bg-white rounded-xl shadow-lg p-4 mb-6">
        <h1 className="text-3xl font-bold text-blue-600">Text2Flow AI</h1>
        <div className="flex items-center space-x-4">
          {user && user.isAnonymous ? (
            <span className="text-gray-600 text-sm">Guest User: {user.uid.substring(0, 8)}...</span>
          ) : (
            <span className="text-gray-600 text-sm">Logged in as: {user ? user.email : 'N/A'}</span>
          )}
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 mb-8">
        <label htmlFor="ai-prompt" className="block text-lg font-semibold text-gray-800 mb-2">
          Describe your diagram:
        </label>
        <textarea
          id="ai-prompt"
          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-y min-h-[100px] text-gray-700"
          placeholder="e.g., 'A flowchart with a start oval, a process rectangle, a decision diamond, and two end ovals. Connect them logically.'"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows="4"
        ></textarea>
        <div className="flex space-x-4 mt-4">
          <button
            onClick={handleGenerateDiagram}
            className={`flex-1 px-6 py-3 rounded-lg text-white font-semibold shadow-md transition-all duration-300
              ${isLoadingAI ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
            disabled={isLoadingAI}
          >
            {isLoadingAI ? (
              <span className="flex items-center justify-center">
                <LoadingSpinner className="-ml-1 mr-3 h-5 w-5 text-white" />
                Generating...
              </span>
            ) : (
              'Generate Diagram with AI'
            )}
          </button>
          <button
            onClick={handleSaveDiagram}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Save Diagram
          </button>
          <button
            onClick={handleLoadDiagram}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
          >
            Load Diagram
          </button>
        </div>
        {appMessage && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
            {appMessage}
          </div>
        )}
      </div>

      {/* Canvas Area - Placeholder for the actual canvas from previous demo */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg flex items-center justify-center overflow-hidden relative" style={{ minHeight: '500px' }}>
        <p className="text-gray-500 text-center p-4">
          The interactive canvas for drawing and editing diagrams will appear here in the next phase.
          <br/><br/>
          (For now, the AI will generate mock data, and Save/Load will interact with Firebase. Check your console for messages.)
        </p>
        <p className="absolute bottom-4 text-gray-400 text-sm">
          User ID: {user ? user.uid : 'Not available'}
        </p>
      </div>
    </div>
  );
};

export default DiagramApp;
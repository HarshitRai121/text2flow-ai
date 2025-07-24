// src/pages/DiagramApp.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Canvas from '../components/Canvas'; // Import the new Canvas component
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/constants'; // Import canvas dimensions

const DiagramApp = ({ user, onLogout, geminiService, firebaseService }) => {
  const [diagramElements, setDiagramElements] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("Generate a simple flowchart with a start, a process, a decision, and two end points.");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [appMessage, setAppMessage] = useState(''); // For app-specific messages
  const [selectedElementId, setSelectedElementId] = useState(null); // State for selected element

  // --- Handlers for Canvas Interactions ---
  const handleElementSelect = useCallback((id) => {
    setSelectedElementId(id);
  }, []);

  const handleElementMove = useCallback((id, newProps) => {
    setDiagramElements(prevElements =>
      prevElements.map(el =>
        el.id === id ? { ...el, ...newProps } : el
      )
    );
  }, []);

  // --- AI Generation Handler ---
  const handleGenerateDiagram = async () => {
    if (!aiPrompt.trim()) {
      setAppMessage("Please enter a description for the diagram.");
      return;
    }
    setAppMessage('');
    setIsLoadingAI(true);
    setDiagramElements([]); // Clear previous diagram
    setSelectedElementId(null); // Deselect any element

    try {
      const newElements = await geminiService.generateDiagramFromPrompt(aiPrompt);
      setDiagramElements(newElements);
      setAppMessage('Diagram generated successfully! (Mock)');
    } catch (error) {
      setAppMessage(`Error: ${error.message}`);
      console.error("AI Generation Error:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // --- Save/Load Handlers ---
  const handleSaveDiagram = async () => {
    setAppMessage('');
    try {
      await firebaseService.saveDiagram(diagramElements);
      setAppMessage('Diagram saved successfully!');
    } catch (error) {
      setAppMessage(`Error saving: ${error.message}`);
      console.error("Save error:", error);
    }
  };

  const handleLoadDiagram = async () => {
    setAppMessage('');
    try {
      const loadedData = await firebaseService.loadDiagram();
      setDiagramElements(loadedData);
      setAppMessage('Diagram loaded successfully!');
      setSelectedElementId(null); // Clear selection after loading new diagram
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

      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-6">
        {/* Toolbar (currently minimal) */}
        <div className="lg:w-1/4 bg-white rounded-xl shadow-lg p-4 flex flex-col items-start space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Tools</h2>
          <button
            className="w-full px-4 py-2 rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center space-x-2"
            disabled // Placeholder for future tools
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pointer-select"><path d="M2.8 14.8V2.8L15.2 15.2H3.2c-1.1 0-2 .9-2 2v1c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-1c0-.4-.3-.8-.8-1.2l-1.2-1.2h9.2L21.2 21.2v-1c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v1c0 .4.3.8.8 1.2l1.2 1.2H8.8L2.8 14.8Z"/></svg>
            <span>Select (Active)</span>
          </button>
          {/* More tool buttons here later */}
        </div>

        {/* Canvas Area */}
        <div className="lg:w-3/4 bg-white rounded-xl shadow-lg flex items-center justify-center overflow-hidden relative">
          {isLoadingAI && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10 rounded-xl">
              <div className="flex flex-col items-center text-blue-600">
                <LoadingSpinner className="h-12 w-12 mb-3" />
                <p className="text-lg font-semibold">Generating your diagram...</p>
              </div>
            </div>
          )}
          <Canvas
            diagramElements={diagramElements}
            selectedElementId={selectedElementId}
            onElementSelect={handleElementSelect}
            onElementMove={handleElementMove}
          />
        </div>
      </div>

      {/* Properties Panel (Minimal for Demo) */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg p-6 mt-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Properties Panel</h2>
        {selectedElementId ? (
          <div className="text-gray-700">
            <p>Selected Element ID: <span className="font-mono text-sm bg-gray-100 p-1 rounded">{selectedElementId}</span></p>
            {/* In a real app, you'd show editable properties here */}
            <p className="mt-2">Drag the selected element to move it!</p>
          </div>
        ) : (
          <p className="text-gray-500">Select an element on the canvas to see its properties.</p>
        )}
      </div>

      <p className="mt-4 text-gray-500 text-sm">
        Current User ID: {user ? user.uid : 'Not available'} (for Firebase storage)
      </p>
    </div>
  );
};

export default DiagramApp;

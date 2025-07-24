// src/pages/DiagramApp.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Canvas from '../components/Canvas';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_ELEMENT_STYLE } from '../utils/constants';
import { pushState, undo, redo, canUndo, canRedo, clearHistory } from '../utils/historyManager'; // Import history manager
import { Settings, Undo, Redo, Save, FolderOpen } from 'lucide-react'; // Icons for properties, undo/redo, save/load

const DiagramApp = ({ user, onLogout, geminiService, firebaseService }) => {
  const [diagramElements, setDiagramElements] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("Generate a simple flowchart with a start, a process, a decision, and two end points.");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [appMessage, setAppMessage] = useState('');
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedElementProps, setSelectedElementProps] = useState(null); // For properties panel
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);

  // --- History Management ---
  const isInitialRender = useRef(true); // To prevent pushing empty state on first render

  useEffect(() => {
    // Push initial state to history after first render, or whenever diagramElements changes
    if (isInitialRender.current) {
      pushState(diagramElements);
      isInitialRender.current = false;
    } else {
      // Only push state if it's a user-initiated change, not just a re-render
      // We'll refine this later to only push on "completed" actions (mouseUp, blur)
      // For now, it pushes on every change, which can be noisy but functional.
      // A better approach for undo/redo is to push state *after* a series of changes (e.g., on mouseUp).
      // For this demo, we'll push state when diagramElements changes, which is simple.
      // A more refined undo/redo would involve a separate effect for "committing" changes.
    }
  }, [diagramElements]); // Dependency on diagramElements

  // Update selected element properties for the panel whenever selection changes or elements change
  useEffect(() => {
    if (selectedElementId) {
      const element = diagramElements.find(el => el.id === selectedElementId);
      setSelectedElementProps(element || null);
      setShowPropertiesPanel(true); // Show panel if something is selected
    } else {
      setSelectedElementProps(null);
      setShowPropertiesPanel(false); // Hide panel if nothing is selected
    }
  }, [selectedElementId, diagramElements]);


  // --- Handlers for Canvas Interactions ---
  const handleElementSelect = useCallback((id) => {
    setSelectedElementId(id);
  }, []);

  // This handler is called for both movement and resizing
  const handleElementChange = useCallback((id, newProps) => {
    setDiagramElements(prevElements => {
      const updatedElements = prevElements.map(el =>
        el.id === id ? { ...el, ...newProps } : el
      );
      // Only push state to history if it's a significant change (e.g., after mouseUp)
      // For now, we'll let the useEffect above handle it, which is simpler for the demo.
      // In a production app, you'd likely debounce or trigger history push on mouseUp.
      return updatedElements;
    });
  }, []);

  const handleDoubleClickElement = useCallback((id) => {
    // This callback is currently unused in Canvas.js, as text editing is handled internally.
    // It's here as a placeholder if you want to externalize text editing logic.
    console.log("Double-clicked element:", id);
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
    clearHistory(); // Clear history for new diagram

    try {
      const newElements = await geminiService.generateDiagramFromPrompt(aiPrompt);
      setDiagramElements(newElements);
      pushState(newElements); // Push the generated state to history
      setAppMessage('Diagram generated successfully!');
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
      pushState(loadedData); // Push loaded state to history
      setAppMessage('Diagram loaded successfully!');
      setSelectedElementId(null); // Clear selection after loading new diagram
    } catch (error) {
      setAppMessage(`Error loading: ${error.message}`);
      console.error("Load error:", error);
    }
  };

  // --- Undo/Redo Handlers ---
  const handleUndo = () => {
    const prevState = undo();
    if (prevState !== null) {
      setDiagramElements(prevState);
      setSelectedElementId(null); // Clear selection on undo/redo for simplicity
      setAppMessage('Undo successful.');
    } else {
      setAppMessage('Nothing to undo.');
    }
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState !== null) {
      setDiagramElements(nextState);
      setSelectedElementId(null); // Clear selection on undo/redo for simplicity
      setAppMessage('Redo successful.');
    } else {
      setAppMessage('Nothing to redo.');
    }
  };

  // --- Properties Panel Handlers ---
  const handlePropertyChange = (key, value) => {
    setDiagramElements(prevElements => {
      const updatedElements = prevElements.map(el => {
        if (el.id === selectedElementId) {
          // Special handling for text vs. label
          if (el.type === 'text' && key === 'label') { // If it's a text element, update 'text'
            return { ...el, text: value };
          } else if (el.type !== 'text' && key === 'text') { // If it's a shape, update 'label'
             return { ...el, label: value };
          }
          return { ...el, [key]: value };
        }
        return el;
      });
      pushState(updatedElements); // Push state after property change
      return updatedElements;
    });
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
        <div className="flex flex-wrap gap-4 mt-4">
          <button
            onClick={handleGenerateDiagram}
            className={`flex-1 min-w-[180px] px-6 py-3 rounded-lg text-white font-semibold shadow-md transition-all duration-300
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
            className="flex-1 min-w-[120px] bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center space-x-2"
          >
            <Save size={20} />
            <span>Save</span>
          </button>
          <button
            onClick={handleLoadDiagram}
            className="flex-1 min-w-[120px] bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 flex items-center justify-center space-x-2"
          >
            <FolderOpen size={20} />
            <span>Load</span>
          </button>
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            className={`flex-1 min-w-[100px] px-6 py-3 rounded-lg text-gray-800 font-semibold shadow-md transition-all duration-300 flex items-center justify-center space-x-2
              ${!canUndo() ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'}`}
          >
            <Undo size={20} />
            <span>Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            className={`flex-1 min-w-[100px] px-6 py-3 rounded-lg text-gray-800 font-semibold shadow-md transition-all duration-300 flex items-center justify-center space-x-2
              ${!canRedo() ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'}`}
          >
            <Redo size={20} />
            <span>Redo</span>
          </button>
        </div>
        {appMessage && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
            {appMessage}
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-6">
        {/* Properties Panel */}
        <div className={`lg:w-1/4 bg-white rounded-xl shadow-lg p-4 flex flex-col items-start space-y-3 transition-all duration-300 ${showPropertiesPanel ? 'block' : 'hidden lg:block'}`}>
          <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center space-x-2">
            <Settings size={24} />
            <span>Properties</span>
          </h2>
          {selectedElementProps ? (
            <div className="w-full space-y-3">
              <p className="text-gray-700 text-sm">ID: <span className="font-mono text-xs bg-gray-100 p-1 rounded break-all">{selectedElementProps.id}</span></p>
              <p className="text-gray-700 text-sm">Type: <span className="font-semibold">{selectedElementProps.type}</span></p>

              {/* Text/Label property */}
              {(selectedElementProps.type === 'text' || selectedElementProps.label !== undefined) && (
                <div>
                  <label htmlFor="element-text" className="block text-sm font-medium text-gray-700 mb-1">
                    {selectedElementProps.type === 'text' ? 'Text Content' : 'Label'}
                  </label>
                  <input
                    type="text"
                    id="element-text"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                    value={selectedElementProps.type === 'text' ? selectedElementProps.text : selectedElementProps.label || ''}
                    onChange={(e) => handlePropertyChange(selectedElementProps.type === 'text' ? 'text' : 'label', e.target.value)}
                  />
                </div>
              )}

              {/* Stroke Color */}
              {selectedElementProps.strokeColor !== undefined && (
                <div>
                  <label htmlFor="stroke-color" className="block text-sm font-medium text-gray-700 mb-1">Stroke Color</label>
                  <input
                    type="color"
                    id="stroke-color"
                    className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
                    value={selectedElementProps.strokeColor}
                    onChange={(e) => handlePropertyChange('strokeColor', e.target.value)}
                  />
                </div>
              )}

              {/* Fill Color (for shapes) */}
              {(selectedElementProps.type === 'rectangle' || selectedElementProps.type === 'oval' || selectedElementProps.type === 'diamond') && (
                <div>
                  <label htmlFor="fill-color" className="block text-sm font-medium text-gray-700 mb-1">Fill Color</label>
                  <input
                    type="color"
                    id="fill-color"
                    className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
                    value={selectedElementProps.fillColor}
                    onChange={(e) => handlePropertyChange('fillColor', e.target.value)}
                  />
                </div>
              )}

              {/* Line Width */}
              {selectedElementProps.lineWidth !== undefined && (
                <div>
                  <label htmlFor="line-width" className="block text-sm font-medium text-gray-700 mb-1">Line Width</label>
                  <input
                    type="range"
                    id="line-width"
                    min="1"
                    max="10"
                    step="1"
                    className="w-full h-8 cursor-pointer"
                    value={selectedElementProps.lineWidth}
                    onChange={(e) => handlePropertyChange('lineWidth', parseInt(e.target.value))}
                  />
                  <span className="text-sm text-gray-600">{selectedElementProps.lineWidth}px</span>
                </div>
              )}

              {/* Font Size (for text elements and labels) */}
              {(selectedElementProps.type === 'text' || selectedElementProps.label !== undefined) && (
                <div>
                  <label htmlFor="font-size" className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                  <input
                    type="range"
                    id="font-size"
                    min="8"
                    max="48"
                    step="1"
                    className="w-full h-8 cursor-pointer"
                    value={selectedElementProps.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}
                    onChange={(e) => handlePropertyChange('fontSize', parseInt(e.target.value))}
                  />
                  <span className="text-sm text-gray-600">{selectedElementProps.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px</span>
                </div>
              )}

              {/* Text Color (for text elements and labels) */}
              {(selectedElementProps.type === 'text' || selectedElementProps.label !== undefined) && (
                <div>
                  <label htmlFor="text-color" className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <input
                    type="color"
                    id="text-color"
                    className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
                    value={selectedElementProps.color || DEFAULT_ELEMENT_STYLE.color}
                    onChange={(e) => handlePropertyChange('color', e.target.value)}
                  />
                </div>
              )}

              {/* Arrowhead (for lines) */}
              {selectedElementProps.type === 'line' && (
                <div>
                  <label htmlFor="arrowhead" className="block text-sm font-medium text-gray-700 mb-1">Arrowhead</label>
                  <input
                    type="checkbox"
                    id="arrowhead"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    checked={selectedElementProps.arrowhead}
                    onChange={(e) => handlePropertyChange('arrowhead', e.target.checked)}
                  />
                </div>
              )}

            </div>
          ) : (
            <p className="text-gray-500">Select an element on the canvas to edit its properties.</p>
          )}
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
            onElementChange={handleElementChange}
            onDoubleClickElement={handleDoubleClickElement}
          />
        </div>
      </div>

      <p className="mt-4 text-gray-500 text-sm">
        Current User ID: {user ? user.uid : 'Not available'} (for Firebase storage)
      </p>
    </div>
  );
};

export default DiagramApp;

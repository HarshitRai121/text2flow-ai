// src/pages/DiagramApp.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Canvas from '../components/Canvas';
import Modal from '../components/Modal';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';
import { pushState, undo, redo, canUndo, canRedo, clearHistory } from '../utils/historyManager';
import { elementsToSvgString } from '../utils/exportUtils';
// Import Lucide icons
import {
  Settings, Undo, Redo, Save, FolderOpen, Eraser,
  MousePointer2, Square, Circle, Diamond, LineChart, Type,
  Trash2, Download, Image, Copy, ClipboardPaste // Added Copy and ClipboardPaste icons
} from 'lucide-react';

const DiagramApp = ({ user, onLogout, geminiService, firebaseService }) => {
  const [diagramElements, setDiagramElements] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("Generate a simple flowchart with a start, a process, a decision, and two end points.");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [appMessage, setAppMessage] = useState('');
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedElementsIds, setSelectedElementsIds] = useState([]);
  const [selectedElementProps, setSelectedElementProps] = useState(null);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [activeTool, setActiveTool] = useState(TOOL_TYPE.SELECT);

  // New: State to hold copied elements
  const [copiedElements, setCopiedElements] = useState([]);

  // Ref for the canvas element in DiagramApp (needed for PNG export)
  const canvasRef = useRef(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', message: '', showConfirm: false, confirmText: '', onConfirm: null });

  // --- History Management ---
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      pushState(diagramElements);
      isInitialRender.current = false;
    }
  }, [diagramElements]);

  // Update selected element properties for the panel whenever selection changes or elements change
  useEffect(() => {
    // If there's a single selected element (for properties panel)
    if (selectedElementId && !selectedElementsIds.length) {
      const element = diagramElements.find(el => el.id === selectedElementId);
      setSelectedElementProps(element || null);
      setShowPropertiesPanel(true);
    } else if (selectedElementsIds.length === 1) { // If only one element in multi-selection
      const element = diagramElements.find(el => el.id === selectedElementsIds[0]);
      setSelectedElementProps(element || null);
      setShowPropertiesPanel(true);
    }
    else {
      setSelectedElementProps(null);
      setShowPropertiesPanel(false);
    }
  }, [selectedElementId, selectedElementsIds, diagramElements]);


  // --- Handlers for Canvas Interactions ---
  const handleElementSelect = useCallback((id) => {
    setSelectedElementId(id);
  }, []);

  // Callback for multi-element selection from Canvas
  const handleElementsSelect = useCallback((ids) => {
    setSelectedElementsIds(ids);
  }, []);

  // This handler is called for both movement and resizing (continuous updates)
  // and also for committing to history (discrete updates on mouseUp/blur)
  const handleElementChange = useCallback((id, newProps, commitToHistory = false) => {
    setDiagramElements(prevElements => {
      let updatedElements;
      if (Array.isArray(newProps)) { // If newProps is an array, it's a multi-element update
        updatedElements = prevElements.map(el => {
          const updated = newProps.find(p => p.id === el.id);
          return updated ? { ...el, ...updated } : el;
        });
      } else { // Single element update
        updatedElements = prevElements.map(el =>
          el.id === id ? { ...el, ...newProps } : el
        );
      }

      if (commitToHistory) {
        pushState(updatedElements); // Only push to history when commitToHistory is true
      }
      return updatedElements;
    });
  }, []);

  // Handler for adding a new element (from manual drawing tools or paste)
  const handleAddElement = useCallback((newElement) => {
    setDiagramElements(prevElements => {
      const updatedElements = [...prevElements, newElement];
      pushState(updatedElements); // Push state immediately after adding
      return updatedElements;
    });
    setSelectedElementId(newElement.id); // Select the newly added element
    setSelectedElementsIds([]); // Clear multi-selection when adding new single element
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
    setSelectedElementsIds([]); // Clear multi-selection
    clearHistory(); // Clear history for new diagram
    setActiveTool(TOOL_TYPE.SELECT); // Reset tool after generation

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
      setSelectedElementsIds([]); // Clear multi-selection
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
      setSelectedElementsIds([]); // Clear multi-selection
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
      setSelectedElementsIds([]); // Clear multi-selection
      setAppMessage('Redo successful.');
    } else {
      setAppMessage('Nothing to redo.');
    }
  };

  // --- Clear Canvas Handler ---
  const handleClearCanvas = () => {
    setModalContent({
      title: 'Clear Canvas',
      message: 'Are you sure you want to clear the entire canvas? This action cannot be undone unless you save first.',
      showConfirm: true,
      confirmText: 'Clear',
      onConfirm: () => {
        setDiagramElements([]);
        clearHistory(); // Clear history when canvas is cleared
        setSelectedElementId(null);
        setSelectedElementsIds([]); // Clear multi-selection
        setAppMessage('Canvas cleared.');
        setShowModal(false);
      }
    });
    setShowModal(true);
  };

  // --- Delete Element Handler ---
  const handleDeleteElement = () => {
    if (!selectedElementId && selectedElementsIds.length === 0) {
      setAppMessage("No element selected to delete.");
      return;
    }

    setModalContent({
      title: 'Delete Element(s)',
      message: `Are you sure you want to delete the selected element${selectedElementsIds.length > 1 || (selectedElementId && selectedElementsIds.length === 0) ? '(s)' : ''}? This action can be undone.`,
      showConfirm: true,
      confirmText: 'Delete',
      onConfirm: () => {
        setDiagramElements(prevElements => {
          const idsToDelete = selectedElementId ? [selectedElementId] : selectedElementsIds;
          const updatedElements = prevElements.filter(el => !idsToDelete.includes(el.id));
          pushState(updatedElements); // Push state after deletion
          return updatedElements;
        });
        setSelectedElementId(null); // Deselect after deletion
        setSelectedElementsIds([]); // Clear multi-selection
        setAppMessage('Element(s) deleted.');
        setShowModal(false);
      }
    });
    setShowModal(true);
  };

  // --- Copy/Paste Handlers ---
  const handleCopy = () => {
    let elementsToCopy = [];
    if (selectedElementId) {
      const element = diagramElements.find(el => el.id === selectedElementId);
      if (element) elementsToCopy.push(element);
    } else if (selectedElementsIds.length > 0) {
      elementsToCopy = diagramElements.filter(el => selectedElementsIds.includes(el.id));
    }

    if (elementsToCopy.length > 0) {
      setCopiedElements(JSON.parse(JSON.stringify(elementsToCopy))); // Deep copy to prevent reference issues
      setAppMessage(`Copied ${elementsToCopy.length} element(s).`);
    } else {
      setAppMessage("No element(s) selected to copy.");
    }
  };

  const handlePaste = () => {
    if (copiedElements.length === 0) {
      setAppMessage("Nothing to paste. Copy element(s) first.");
      return;
    }

    const pastedNewIds = [];
    const newElements = copiedElements.map(el => {
      const newId = generateUniqueId();
      pastedNewIds.push(newId);
      const offset = 20; // Offset for pasted elements

      // Create a new element with new ID and offset position
      if (el.type === 'line') {
        return {
          ...el,
          id: newId,
          startX: el.startX + offset,
          startY: el.startY + offset,
          endX: el.endX + offset,
          endY: el.endY + offset,
        };
      } else {
        return {
          ...el,
          id: newId,
          x: el.x + offset,
          y: el.y + offset,
        };
      }
    });

    setDiagramElements(prevElements => {
      const updatedElements = [...prevElements, ...newElements];
      pushState(updatedElements); // Push state after pasting
      return updatedElements;
    });

    // Select the newly pasted elements
    setSelectedElementId(null);
    setSelectedElementsIds(pastedNewIds);
    setAppMessage(`Pasted ${newElements.length} element(s).`);
  };


  // --- Export Handlers ---
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setAppMessage("Canvas not available for export.");
      return;
    }

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = 'text2flow-diagram.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setAppMessage('Diagram exported as PNG!');
  };

  const handleExportSvg = () => {
    const svgString = elementsToSvgString(diagramElements, CANVAS_WIDTH, CANVAS_HEIGHT);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'text2flow-diagram.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the URL object
    setAppMessage('Diagram exported as SVG!');
  };


  // --- Properties Panel Handlers ---
  const handlePropertyChange = (key, value) => {
    setDiagramElements(prevElements => {
      const updatedElements = prevElements.map(el => {
        // Apply property change only to the single selected element
        // If multiple elements are selected, properties panel should ideally be disabled or apply to all.
        // For now, it only applies to `selectedElementId`.
        if (el.id === selectedElementId) {
          // Special handling for text vs. label
          if (el.type === 'text' && key === 'label') {
            return { ...el, text: value };
          } else if (el.type !== 'text' && key === 'text') {
             return { ...el, label: value };
          }
          return { ...el, [key]: value };
        }
        return el;
      });
      pushState(updatedElements); // Push state immediately for property changes
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
          <button
            onClick={handleClearCanvas}
            className="flex-1 min-w-[120px] bg-red-400 hover:bg-red-500 text-white px-6 py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 flex items-center justify-center space-x-2"
          >
            <Eraser size={20} />
            <span>Clear</span>
          </button>
        </div>
        {appMessage && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
            {appMessage}
          </div>
        )}
      </div>

      <div className="w-full max-w-4xl flex flex-col lg:flex-row gap-6">
        {/* Toolbar */}
        <div className="lg:w-1/4 bg-white rounded-xl shadow-lg p-4 flex flex-col items-start space-y-3">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Tools</h2>
          {/* Select Tool */}
          <button
            onClick={() => setActiveTool(TOOL_TYPE.SELECT)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${activeTool === TOOL_TYPE.SELECT ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <MousePointer2 size={20} />
            <span>Select</span>
          </button>
          <div className="w-full border-t border-gray-200 my-2"></div> {/* Separator */}

          {/* Drawing Tools */}
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Draw</h3>
          <button
            onClick={() => setActiveTool(TOOL_TYPE.RECTANGLE)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${activeTool === TOOL_TYPE.RECTANGLE ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Square size={20} />
            <span>Rectangle</span>
          </button>
          <button
            onClick={() => setActiveTool(TOOL_TYPE.OVAL)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${activeTool === TOOL_TYPE.OVAL ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Circle size={20} />
            <span>Oval</span>
          </button>
          <button
            onClick={() => setActiveTool(TOOL_TYPE.DIAMOND)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${activeTool === TOOL_TYPE.DIAMOND ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Diamond size={20} />
            <span>Diamond</span>
          </button>
          <button
            onClick={() => setActiveTool(TOOL_TYPE.LINE)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${activeTool === TOOL_TYPE.LINE ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <LineChart size={20} /> {/* Using LineChart for a generic line icon */}
            <span>Line</span>
          </button>
          <button
            onClick={() => setActiveTool(TOOL_TYPE.TEXT)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${activeTool === TOOL_TYPE.TEXT ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Type size={20} />
            <span>Text</span>
          </button>
          <div className="w-full border-t border-gray-200 my-2"></div> {/* Separator */}

          {/* Action Tools */}
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Actions</h3>
          <button
            onClick={handleDeleteElement}
            disabled={!selectedElementId && selectedElementsIds.length === 0}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${(!selectedElementId && selectedElementsIds.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
          >
            <Trash2 size={20} />
            <span>Delete</span>
          </button>
          <button
            onClick={handleCopy}
            disabled={!selectedElementId && selectedElementsIds.length === 0}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${(!selectedElementId && selectedElementsIds.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
          >
            <Copy size={20} />
            <span>Copy</span>
          </button>
          <button
            onClick={handlePaste}
            disabled={copiedElements.length === 0}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center space-x-2
              ${copiedElements.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
          >
            <ClipboardPaste size={20} />
            <span>Paste</span>
          </button>
          <div className="w-full border-t border-gray-200 my-2"></div> {/* Separator */}

          {/* Export Tools */}
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Export</h3>
          <button
            onClick={handleExportPng}
            className="w-full px-4 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
          >
            <Image size={20} />
            <span>Export PNG</span>
          </button>
          <button
            onClick={handleExportSvg}
            className="w-full px-4 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
          >
            <Download size={20} />
            <span>Export SVG</span>
          </button>
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
            ref={canvasRef}
            diagramElements={diagramElements}
            selectedElementId={selectedElementId}
            selectedElementsIds={selectedElementsIds}
            onElementSelect={handleElementSelect}
            onElementChange={handleElementChange}
            onAddElement={handleAddElement}
            onElementsSelect={handleElementsSelect}
            activeTool={activeTool}
          />
        </div>
      </div>

      <p className="mt-4 text-gray-500 text-sm">
        Current User ID: {user ? user.uid : 'Not available'} (for Firebase storage)
      </p>

      {/* Custom Modal for confirmations/alerts */}
      <Modal
        show={showModal}
        title={modalContent.title}
        message={modalContent.message}
        onClose={() => setShowModal(false)}
        onConfirm={modalContent.onConfirm}
        showConfirmButton={modalContent.showConfirm}
        confirmText={modalContent.confirmText}
      />
    </div>
  );
};

export default DiagramApp;
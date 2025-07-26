// src/pages/DiagramApp.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Canvas from '../components/Canvas';
import Modal from '../components/Modal';
import PropertiesPanel from '../components/PropertiesPanel';
import DiagramListModal from '../components/DiagramListModal';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';
import { pushState, undo, redo, canUndo, canRedo, clearHistory } from '../utils/historyManager';
import { elementsToSvgString } from '../utils/exportUtils';
// Import drawing functions for PNG export directly
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement } from '../utils/drawingUtils';
import { getShapeConnectionPoint } from '../services/GeminiAIService';
// Import Lucide icons
import {
  Settings, Undo, Redo, Save, FolderOpen, Eraser,
  MousePointer2, Square, Circle, Diamond, LineChart, Type,
  Trash2, Download, Image, Copy, ClipboardPaste, Sparkles
} from 'lucide-react';

import { geminiService } from '../services/GeminiAIService';

const DiagramApp = ({ user, onLogout, firebaseService }) => {
  const [diagramElements, setDiagramElements] = useState([]);
  const [aiPrompt, setAiPrompt] = useState("Generate a simple flowchart with a start, a process, a decision, and two end points.");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [appMessage, setAppMessage] = useState('');
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedElementsIds, setSelectedElementsIds] = useState([]);
  const [selectedElementProps, setSelectedElementProps] = useState(null);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [activeTool, setActiveTool] = useState(TOOL_TYPE.SELECT);

  const [copiedElements, setCopiedElements] = useState([]);

  // State for AI refinement
  const [aiRefinePrompt, setAiRefinePrompt] = useState("");
  const [isLoadingRefineAI, setIsLoadingRefineAI] = useState(false);

  // Ref for the canvas element in DiagramApp (needed for PNG export and dimensions)
  const canvasRef = useRef(null);

  // Modal state for general confirmations/alerts
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', message: '', showConfirm: false, confirmText: '', onConfirm: null });

  // New states for DiagramListModal
  const [showDiagramListModal, setShowDiagramListModal] = useState(false);
  const [savedDiagrams, setSavedDiagrams] = useState([]);
  const [loadingDiagrams, setLoadingDiagrams] = useState(false);
  const [diagramListError, setDiagramListError] = useState('');

  // New states for Canvas pan/zoom (controlled by DiagramApp for initial view)
  const [canvasInitialOffsetX, setCanvasInitialOffsetX] = useState(0);
  const [canvasInitialOffsetY, setCanvasInitialOffsetY] = useState(0);
  const [canvasInitialScale, setCanvasInitialScale] = useState(1);

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
    if (selectedElementId && !selectedElementsIds.length) {
      const element = diagramElements.find(el => el.id === selectedElementId);
      setSelectedElementProps(element || null);
      setShowPropertiesPanel(true);
    } else if (selectedElementsIds.length === 1) {
      const element = diagramElements.find(el => el.id === selectedElementsIds[0]);
      setSelectedElementProps(element || null);
      setShowPropertiesPanel(true);
    }
    else {
      setSelectedElementProps(null);
      setShowPropertiesPanel(false);
    }
  }, [selectedElementId, selectedElementsIds, diagramElements]);

  // --- Canvas Fit-to-View Logic ---
  const fitElementsToView = useCallback((elements) => {
    if (!canvasRef.current || elements.length === 0) {
      setCanvasInitialOffsetX(0);
      setCanvasInitialOffsetY(0);
      setCanvasInitialScale(1);
      return;
    }

    const canvasDomWidth = canvasRef.current.width;
    const canvasDomHeight = canvasRef.current.height;

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
      let elMinX, elMinY, elMaxX, elMaxY;

      if (el.type === 'line') {
        elMinX = Math.min(el.startX, el.endX);
        elMinY = Math.min(el.startY, el.endY);
        elMaxX = Math.max(el.startX, el.endX);
        elMaxY = Math.max(el.startY, el.endY);
      } else if (el.type === 'text') {
        // Approximate text bounds for fit-to-view
        const dummyCanvas = document.createElement('canvas');
        const dummyCtx = dummyCanvas.getContext('2d');
        dummyCtx.font = `${el.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
        const metrics = dummyCtx.measureText(el.text);
        const textWidth = metrics.width;
        const textHeight = (el.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * el.text.split('\n').length * 1.2;
        elMinX = el.x;
        elMinY = el.y;
        elMaxX = el.x + textWidth;
        elMaxY = el.y + textHeight;
      }
      else { // Shapes
        elMinX = el.x;
        elMinY = el.y;
        elMaxX = el.x + el.width;
        elMaxY = el.y + el.height;
      }

      minX = Math.min(minX, elMinX);
      minY = Math.min(minY, elMinY);
      maxX = Math.max(maxX, elMaxX);
      maxY = Math.max(maxY, elMaxY);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Add some padding around the content
    const padding = 50;
    const paddedContentWidth = contentWidth + 2 * padding;
    const paddedContentHeight = contentHeight + 2 * padding;

    // Calculate scale to fit content within canvas
    const scaleX = canvasDomWidth / paddedContentWidth;
    const scaleY = canvasDomHeight / paddedContentHeight;
    let newScale = Math.min(scaleX, scaleY);

    // Ensure scale doesn't zoom in too much or too little
    newScale = Math.max(0.2, Math.min(newScale, 1.0)); // Min zoom 20%, Max zoom 100%

    // Calculate offset to center the scaled content
    const scaledContentWidth = contentWidth * newScale;
    const scaledContentHeight = contentHeight * newScale;

    const newOffsetX = (canvasDomWidth - scaledContentWidth) / 2 - minX * newScale;
    const newOffsetY = (canvasDomHeight - scaledContentHeight) / 2 - minY * newScale;

    setCanvasInitialOffsetX(newOffsetX);
    setCanvasInitialOffsetY(newOffsetY);
    setCanvasInitialScale(newScale);
  }, []);

  // Call fitElementsToView when diagramElements change (after load/generate)
  useEffect(() => {
    if (diagramElements.length > 0) {
      fitElementsToView(diagramElements);
    } else {
      // Reset view to default when canvas is empty
      setCanvasInitialOffsetX(0);
      setCanvasInitialOffsetY(0);
      setCanvasInitialScale(1);
    }
  }, [diagramElements, fitElementsToView]);

  // --- Handlers for Canvas Interactions ---
  const handleElementSelect = useCallback((id) => {
    setSelectedElementId(id);
  }, []);

  const handleElementsSelect = useCallback((ids) => {
    setSelectedElementsIds(ids);
  }, []);

  // This handler is called for both movement and resizing (continuous updates)
  // and also for committing to history (discrete updates on mouseUp/blur)
  // It now also supports bulk updates for smooth dragging/resizing from Canvas.js
  const handleElementChange = useCallback((id, newPropsOrElements, commitToHistory = false) => {
    setDiagramElements(prevElements => {
      let updatedElements = [...prevElements];

      if (Array.isArray(newPropsOrElements)) { // This is a bulk update from Canvas.js (e.g., after drag/resize)
        const updatedElementsMap = new Map(newPropsOrElements.map(el => [el.id, el]));
        updatedElements = prevElements.map(el => updatedElementsMap.has(el.id) ? updatedElementsMap.get(el.id) : el);
        // No need to update connected lines here, Canvas.js already did it on temp elements
      } else { // Single element update (e.g., from properties panel or text input)
        const changedElementIndex = updatedElements.findIndex(el => el.id === id);
        const changedElement = changedElementIndex !== -1 ? updatedElements[changedElementIndex] : null;

        if (changedElement) {
          updatedElements[changedElementIndex] = { ...changedElement, ...newPropsOrElements };

          // If the changed element is a shape, update all connected lines
          if (changedElement.type !== 'line' && (newPropsOrElements.x !== undefined || newPropsOrElements.y !== undefined || newPropsOrElements.width !== undefined || newPropsOrElements.height !== undefined)) {
            updatedElements = updatedElements.map(el => {
              if (el.type === 'line' && (el.sourceId === id || el.targetId === id)) {
                const sourceShape = updatedElements.find(s => s.id === el.sourceId);
                const targetShape = updatedElements.find(s => s.id === el.targetId);

                let newStartX = el.startX;
                let newStartY = el.startY;
                let newEndX = el.endX;
                let newEndY = el.endY;

                if (sourceShape && targetShape) {
                  const { x: connectedStartX, y: connectedStartY } = getShapeConnectionPoint(sourceShape, targetShape.x + targetShape.width / 2, targetShape.y + targetShape.height / 2);
                  const { x: connectedEndX, y: connectedEndY } = getShapeConnectionPoint(targetShape, sourceShape.x + sourceShape.width / 2, sourceShape.y + sourceShape.height / 2);
                  newStartX = connectedStartX;
                  newStartY = connectedStartY;
                  newEndX = connectedEndX;
                  newEndY = connectedEndY;
                } else if (sourceShape) {
                  const { x: connX, y: connY } = getShapeConnectionPoint(sourceShape, el.endX, el.endY);
                  newStartX = connX;
                  newStartY = connY;
                } else if (targetShape) {
                  const { x: connX, y: connY } = getShapeConnectionPoint(targetShape, el.startX, el.startY);
                  newEndX = connX;
                  newEndY = connY;
                }
                return {
                  ...el,
                  startX: newStartX,
                  startY: newStartY,
                  endX: newEndX,
                  endY: newEndY,
                };
              }
              return el;
            });
          }
        }
      }

      if (commitToHistory) {
        pushState(updatedElements);
      }
      return updatedElements;
    });
  }, [diagramElements]);


  // Handler for adding a new element (from manual drawing tools or paste)
  const handleAddElement = useCallback((newElement) => {
    setDiagramElements(prevElements => {
      const updatedElements = [...prevElements, newElement];
      pushState(updatedElements);
      return updatedElements;
    });
    setSelectedElementId(newElement.id);
    setSelectedElementsIds([]);
  }, []);


  // --- AI Generation Handler ---
  const handleGenerateDiagram = async () => {
    if (!aiPrompt.trim()) {
      setAppMessage("Please enter a description for the diagram.");
      return;
    }
    setAppMessage('');
    setIsLoadingAI(true);
    setDiagramElements([]);
    setSelectedElementId(null);
    setSelectedElementsIds([]);
    clearHistory();
    setActiveTool(TOOL_TYPE.SELECT);

    try {
      const newElements = await geminiService.generateDiagramFromPrompt(aiPrompt);
      setDiagramElements(newElements);
      pushState(newElements);
      setAppMessage('Diagram generated successfully!');
      // After generation, fit elements to view
      fitElementsToView(newElements);
    } catch (error) {
      setAppMessage(`Error: ${error.message}`);
      console.error("AI Generation Error:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // --- AI Refinement Handler ---
  const handleRefineElementWithAI = async () => {
    if (!selectedElementId && selectedElementsIds.length === 0) {
      setAppMessage("Please select an element to refine with AI.");
      return;
    }
    if (!aiRefinePrompt.trim()) {
      setAppMessage("Please enter a refinement prompt for the selected element.");
      return;
    }

    setAppMessage('');
    setIsLoadingRefineAI(true);

    try {
      const elementsToRefine = selectedElementId
        ? [diagramElements.find(el => el.id === selectedElementId)]
        : diagramElements.filter(el => selectedElementsIds.includes(el.id));

      if (!elementsToRefine.length || elementsToRefine.some(el => !el)) {
        setAppMessage("Selected element(s) not found.");
        setIsLoadingRefineAI(false);
        return;
      }

      const simplifiedElements = elementsToRefine.map(el => {
        const { id, type, label, text, x, y, width, height, startX, startY, endX, endY, ...rest } = el;
        return { id, type, label: label || text, x, y, width, height, startX, startY, endX, endY };
      });
      const currentElementJson = JSON.stringify(simplifiedElements);

      const refinedElementsData = await geminiService.refineElement(currentElementJson, aiRefinePrompt);

      setDiagramElements(prevElements => {
        let updatedElements = [...prevElements];
        refinedElementsData.forEach(refinedEl => {
          const index = updatedElements.findIndex(el => el.id === refinedEl.id);
          if (index !== -1) {
            updatedElements[index] = { ...updatedElements[index], ...refinedEl };
          }
        });
        pushState(updatedElements);
        return updatedElements;
      });
      setAppMessage('Element(s) refined successfully!');
      setAiRefinePrompt('');
    } catch (error) {
      setAppMessage(`Error refining: ${error.message}`);
      console.error("AI Refinement Error:", error);
    } finally {
      setIsLoadingRefineAI(false);
    }
  };


  // --- Save/Load/List/Delete Diagram Handlers ---

  const handleSaveDiagramPrompt = () => {
    setModalContent({
      title: 'Save Diagram',
      message: 'Enter a name for your diagram:',
      showConfirm: true,
      confirmText: 'Save',
      onConfirm: (name) => {
        if (name && name.trim() !== '') {
          handleSaveDiagram(name.trim());
        } else {
          setAppMessage('Diagram name cannot be empty.');
        }
        setShowModal(false);
      },
      showInput: true,
      inputValue: '',
    });
    setShowModal(true);
  };

  const handleSaveDiagram = async (diagramName) => {
    setAppMessage('');
    try {
      await firebaseService.saveDiagram(diagramName, diagramElements);
      setAppMessage(`Diagram "${diagramName}" saved successfully!`);
    } catch (error) {
      setAppMessage(`Error saving: ${error.message}`);
      console.error("Save error:", error);
    }
  };

  const handleOpenLoadDiagramModal = async () => {
    setLoadingDiagrams(true);
    setDiagramListError('');
    setShowDiagramListModal(true);
    try {
      const diagrams = await firebaseService.listDiagrams();
      setSavedDiagrams(diagrams);
    } catch (error) {
      setDiagramListError(`Failed to load diagram list: ${error.message}`);
      console.error("List diagrams error:", error);
    } finally {
      setLoadingDiagrams(false);
    }
  };

  const handleLoadDiagram = async (diagramName) => {
    setAppMessage('');
    setShowDiagramListModal(false);
    try {
      const loadedData = await firebaseService.loadDiagram(diagramName);
      setDiagramElements(loadedData);
      pushState(loadedData);
      setAppMessage(`Diagram "${diagramName}" loaded successfully!`);
      setSelectedElementId(null);
      setSelectedElementsIds([]);
      // After loading, fit elements to view
      fitElementsToView(loadedData);
    } catch (error) {
      setAppMessage(`Error loading: ${error.message}`);
      console.error("Load error:", error);
    }
  };

  const handleDeleteDiagram = async (diagramName) => {
    setModalContent({
      title: 'Delete Diagram',
      message: `Are you sure you want to delete "${diagramName}"? This action cannot be undone.`,
      showConfirm: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        setAppMessage('');
        setShowModal(false);
        try {
          await firebaseService.deleteDiagram(diagramName);
          setAppMessage(`Diagram "${diagramName}" deleted successfully!`);
          const updatedDiagrams = await firebaseService.listDiagrams();
          setSavedDiagrams(updatedDiagrams);
        } catch (error) {
          setAppMessage(`Error deleting: ${error.message}`);
          console.error("Delete error:", error);
        }
      },
      zIndex: 60,
    });
    setShowModal(true);
  };


  // --- Undo/Redo Handlers ---
  const handleUndo = () => {
    const prevState = undo();
    if (prevState !== null) {
      setDiagramElements(prevState);
      setSelectedElementId(null);
      setSelectedElementsIds([]);
      setAppMessage('Undo successful.');
    } else {
      setAppMessage('Nothing to undo.');
    }
  };

  const handleRedo = () => {
    const nextState = redo();
    if (nextState !== null) {
      setDiagramElements(nextState);
      setSelectedElementId(null);
      setSelectedElementsIds([]);
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
        clearHistory();
        setSelectedElementId(null);
        setSelectedElementsIds([]);
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
          let updatedElements = prevElements.filter(el => !idsToDelete.includes(el.id));
          
          updatedElements = updatedElements.filter(el => 
            el.type !== 'line' || (!idsToDelete.includes(el.sourceId) && !idsToDelete.includes(el.targetId))
          );

          pushState(updatedElements);
          return updatedElements;
        });
        setSelectedElementId(null);
        setSelectedElementsIds([]);
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
      setCopiedElements(JSON.parse(JSON.stringify(elementsToCopy)));
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
      const offset = 20;

      if (el.type === 'line') {
        return {
          ...el,
          id: newId,
          startX: el.startX + offset,
          startY: el.startY + offset,
          endX: el.endX + offset,
          endY: el.endY + offset,
          sourceId: null,
          targetId: null,
        };
      } else {
        return {
          id: newId,
          x: el.x + offset,
          y: el.y + offset,
          ...el, // Ensure all other properties are copied
        };
      }
    });

    setDiagramElements(prevElements => {
      const updatedElements = [...prevElements, ...newElements];
      pushState(updatedElements);
      return updatedElements;
    });

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

    // Create a temporary canvas for high-resolution export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = CANVAS_WIDTH; // Use the large virtual width
    exportCanvas.height = CANVAS_HEIGHT; // Use the large virtual height
    const ctx = exportCanvas.getContext('2d');

    // Fill background with white for PNG (transparent by default)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw elements onto the export canvas without any pan/zoom transformations
    diagramElements.forEach(element => {
      // Draw elements without selection/handles for clean export
      switch (element.type) {
        case 'rectangle': drawRectangle(ctx, element, false); break;
        case 'oval': drawOval(ctx, element, false); break;
        case 'diamond': drawDiamond(ctx, element, false); break;
        case 'line': drawLine(ctx, element, false); break;
        case 'text': drawTextElement(ctx, element, false); break;
        default: break;
      }
    });

    const image = exportCanvas.toDataURL('image/png');
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
    URL.revokeObjectURL(url);
    setAppMessage('Diagram exported as SVG!');
  };


  // --- Properties Panel Handlers ---
  const handlePropertyChange = (key, value) => {
    setDiagramElements(prevElements => {
      const updatedElements = prevElements.map(el => {
        if (el.id === selectedElementId) {
          if (el.type === 'text' && key === 'label') {
            return { ...el, text: value };
          } else if (el.type !== 'text' && key === 'text') {
             return { ...el, label: value };
          }
          return { ...el, [key]: value };
        }
        return el;
      });
      const elementsAfterPropertyChange = updatedElements.map(el => {
        if (el.type === 'line' && (el.sourceId || el.targetId)) {
          const sourceShape = updatedElements.find(s => s.id === el.sourceId);
          const targetShape = updatedElements.find(s => s.id === el.targetId);

          if (sourceShape && targetShape) {
            const { x: startX, y: startY } = getShapeConnectionPoint(sourceShape, targetShape.x + targetShape.width / 2, targetShape.y + targetShape.height / 2);
            const { x: endX, y: endY } = getShapeConnectionPoint(targetShape, sourceShape.x + sourceShape.width / 2, sourceShape.y + sourceShape.height / 2);
            return { ...el, startX, startY, endX, endY };
          } else if (sourceShape) {
            const newStartX = sourceShape.x + sourceShape.width / 2;
            const newStartY = sourceShape.y + sourceShape.height / 2;
            return { ...el, startX: newStartX, startY: newStartY };
          } else if (targetShape) {
            const newEndX = targetShape.x + targetShape.width / 2;
            const newEndY = targetShape.y + targetShape.height / 2;
            return { ...el, endX: newEndX, endY: newEndY };
          }
        }
        return el;
      });

      pushState(elementsAfterPropertyChange);
      return elementsAfterPropertyChange;
    });
  };

  return (
    // Main container: min-h-screen for full height, flex-col for stacking
    // Responsive padding: p-4 for small screens, sm:p-6 for medium/large
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-6">
      {/* Header: max-w-full on mobile, max-w-4xl on larger screens */}
      <header className="w-full max-w-full sm:max-w-4xl flex flex-col sm:flex-row justify-between items-center bg-white rounded-xl shadow-lg p-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-600 mb-2 sm:mb-0">Text2Flow AI</h1>
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          {user && user.isAnonymous ? (
            <span className="text-gray-600 text-sm">Guest User: {user.uid.substring(0, 8)}...</span>
          ) : (
            <span className="text-gray-600 text-sm">Logged in as: {user ? user.email : 'N/A'}</span>
          )}
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition-colors duration-200 w-full sm:w-auto"
          >
            Logout
          </button>
        </div>
      </header>

      {/* AI Prompt Section: max-w-full on mobile, max-w-4xl on larger screens */}
      <div className="w-full max-w-full sm:max-w-4xl bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <label htmlFor="ai-prompt" className="block text-lg font-semibold text-gray-800 mb-2">
          Describe your diagram:
        </label>
        <textarea
          id="ai-prompt"
          className="w-full p-3 sm:p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-y min-h-[80px] sm:min-h-[100px] text-gray-700"
          placeholder="e.g., 'A flowchart with a start oval, a process rectangle, a decision diamond, and two end points.'"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows="4"
        ></textarea>
        {/* Buttons: flex-wrap for mobile, gap-2 for tighter spacing */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-4">
          <button
            onClick={handleGenerateDiagram}
            className={`flex-1 min-w-[150px] sm:min-w-[180px] px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-white font-semibold shadow-md transition-all duration-300
              ${isLoadingAI ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
            disabled={isLoadingAI}
          >
            {isLoadingAI ? (
              <span className="flex items-center justify-center">
                <LoadingSpinner className="-ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" />
                Generating...
              </span>
            ) : (
              'Generate Diagram with AI'
            )}
          </button>
          <button
            onClick={handleSaveDiagramPrompt}
            className="flex-1 min-w-[100px] sm:min-w-[120px] bg-green-500 hover:bg-green-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center justify-center space-x-2"
          >
            <Save size={18} />
            <span>Save</span>
          </button>
          <button
            onClick={handleOpenLoadDiagramModal}
            className="flex-1 min-w-[100px] sm:min-w-[120px] bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 flex items-center justify-center space-x-2"
          >
            <FolderOpen size={18} />
            <span>Load</span>
          </button>
          <button
            onClick={handleUndo}
            disabled={!canUndo()}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-gray-800 font-semibold shadow-md transition-all duration-300 flex items-center justify-center space-x-2
              ${!canUndo() ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'}`}
          >
            <Undo size={18} />
            <span>Undo</span>
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo()}
            className={`flex-1 min-w-[80px] sm:min-w-[100px] px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-gray-800 font-semibold shadow-md transition-all duration-300 flex items-center justify-center space-x-2
              ${!canRedo() ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'}`}
          >
            <Redo size={18} />
            <span>Redo</span>
          </button>
          <button
            onClick={handleClearCanvas}
            className="flex-1 min-w-[100px] sm:min-w-[120px] bg-red-400 hover:bg-red-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 flex items-center justify-center space-x-2"
          >
            <Eraser size={18} />
            <span>Clear</span>
          </button>
          {/* NEW LOCATION FOR EXPORT BUTTONS */}
          <button
            onClick={handleExportPng}
            className="flex-1 min-w-[100px] sm:min-w-[120px] px-4 py-2 sm:px-6 sm:py-3 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
          >
            <Image size={18} />
            <span>Export PNG</span>
          </button>
          <button
            onClick={handleExportSvg}
            className="flex-1 min-w-[100px] sm:min-w-[120px] px-4 py-2 sm:px-6 sm:py-3 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors duration-200 font-semibold flex items-center justify-center space-x-2"
          >
            <Download size={18} />
            <span>Export SVG</span>
          </button>
        </div>
        {appMessage && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg text-sm sm:text-base">
            {appMessage}
          </div>
        )}
      </div>

      {/* Main Content Area: flex-col for mobile, lg:flex-row for desktop */}
      {/* min-h-[400px] for mobile, lg:h-[600px] for desktop */}
      <div className="w-full max-w-full sm:max-w-4xl flex flex-col lg:flex-row gap-4 sm:gap-6 min-h-[400px] lg:h-[600px]">
        {/* Toolbar: w-full on mobile, lg:w-1/4 on desktop. Flex-col for desktop stacking */}
        <div className="w-full lg:w-1/4 bg-white rounded-xl shadow-lg p-4 flex flex-col items-start">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Tools</h2>
          
          {/* Drawing Tools Group */}
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1 w-full">Draw</h3>
          {/* Mobile: flex-wrap, Desktop: flex-col */}
          <div className="flex flex-wrap lg:flex-col justify-start gap-2 w-full mb-2"> 
            {/* Select Tool is now part of "Draw" for simpler grouping on mobile */}
            <button
              onClick={() => setActiveTool(TOOL_TYPE.SELECT)}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${activeTool === TOOL_TYPE.SELECT ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <MousePointer2 size={16} />
              <span>Select</span>
            </button>
            <button
              onClick={() => setActiveTool(TOOL_TYPE.RECTANGLE)}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${activeTool === TOOL_TYPE.RECTANGLE ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Square size={16} />
              <span>Rectangle</span>
            </button>
            <button
              onClick={() => setActiveTool(TOOL_TYPE.OVAL)}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${activeTool === TOOL_TYPE.OVAL ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Circle size={16} />
              <span>Oval</span>
            </button>
            <button
              onClick={() => setActiveTool(TOOL_TYPE.DIAMOND)}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${activeTool === TOOL_TYPE.DIAMOND ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Diamond size={16} />
              <span>Diamond</span>
            </button>
            <button
              onClick={() => setActiveTool(TOOL_TYPE.LINE)}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${activeTool === TOOL_TYPE.LINE ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <LineChart size={16} /> {/* Using LineChart for a generic line icon */}
              <span>Line</span>
            </button>
            <button
              onClick={() => setActiveTool(TOOL_TYPE.TEXT)}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${activeTool === TOOL_TYPE.TEXT ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Type size={16} />
              <span>Text</span>
            </button>
          </div> {/* End of responsive button container for Drawing Tools */}
          <div className="w-full border-t border-gray-200 my-2"></div> {/* Separator */}

          {/* Action Tools Group */}
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1 w-full">Actions</h3>
          {/* Mobile: flex-wrap, Desktop: flex-col */}
          <div className="flex flex-wrap lg:flex-col justify-start gap-2 w-full mb-2"> 
            <button
              onClick={handleDeleteElement}
              disabled={!selectedElementId && selectedElementsIds.length === 0}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${(!selectedElementId && selectedElementsIds.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
            <button
              onClick={handleCopy}
              disabled={!selectedElementId && selectedElementsIds.length === 0}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${(!selectedElementId && selectedElementsIds.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            >
              <Copy size={16} />
              <span>Copy</span>
            </button>
            <button
              onClick={handlePaste}
              disabled={copiedElements.length === 0}
              className={`w-full px-3 py-2 rounded-lg font-semibold text-sm sm:text-base transition-colors duration-200 flex items-center justify-center space-x-2
                ${copiedElements.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
            >
              <ClipboardPaste size={16} />
              <span>Paste</span>
            </button>
          </div> {/* End of responsive button container for Action Tools */}
        </div>

        {/* Canvas Area: w-full on mobile, lg:w-3/5 on desktop. flex-grow to take available height */}
        <div className="w-full lg:w-3/5 bg-white rounded-xl shadow-lg flex items-center justify-center overflow-hidden relative flex-grow min-h-[300px] lg:min-h-0">
          {isLoadingAI && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-10 rounded-xl">
              <div className="flex flex-col items-center text-blue-600">
                <LoadingSpinner className="h-10 w-10 sm:h-12 sm:w-12 mb-2 sm:mb-3" />
                <p className="text-base sm:text-lg font-semibold">Generating your diagram...</p>
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
            initialOffsetX={canvasInitialOffsetX}
            initialOffsetY={canvasInitialOffsetY}
            initialScale={canvasInitialScale}
          />
        </div>

        {/* Properties Panel: w-full on mobile, lg:w-1/5 on desktop. Only show if an element is selected */}
        {showPropertiesPanel && (
          <PropertiesPanel
            selectedElementProps={selectedElementProps}
            onPropertyChange={handlePropertyChange}
            className="w-full lg:w-1/5"
          />
        )}
      </div>

      {/* AI Refinement Section: max-w-full on mobile, max-w-4xl on larger screens */}
      <div className="w-full max-w-full sm:max-w-4xl bg-white rounded-xl shadow-lg p-4 sm:p-6 mt-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3">AI Refinement (Selected Element)</h2>
        <p className="text-gray-600 text-sm sm:text-base mb-3">Select an element on the canvas, then describe how you want to refine it (e.g., "change to a diamond shape", "make text red", "add label 'Error'").</p>
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-y min-h-[60px] text-gray-700 text-sm sm:text-base"
          placeholder="e.g., 'change this rectangle to an oval and make it green'"
          value={aiRefinePrompt}
          onChange={(e) => setAiRefinePrompt(e.target.value)}
          rows="2"
          disabled={!selectedElementId && selectedElementsIds.length === 0}
        ></textarea>
        <button
          onClick={handleRefineElementWithAI}
          disabled={(!selectedElementId && selectedElementsIds.length === 0) || !aiRefinePrompt.trim() || isLoadingRefineAI}
          className={`mt-3 w-full px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-white font-semibold shadow-md transition-all duration-300 flex items-center justify-center space-x-2 text-sm sm:text-base
            ${(!selectedElementId && selectedElementsIds.length === 0) || !aiRefinePrompt.trim() || isLoadingRefineAI
              ? 'bg-purple-400 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'}`}
        >
          {isLoadingRefineAI ? (
            <span className="flex items-center justify-center">
              <LoadingSpinner className="-ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" />
              Refining...
            </span>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Refine Selected with AI</span>
            </>
          )}
        </button>
      </div>

      <p className="mt-4 text-gray-500 text-xs sm:text-sm">
        Current User ID: {user ? user.uid : 'Not available'} (for Firebase storage)
      </p>

      {/* General Confirmation/Input Modal */}
      <Modal
        show={showModal}
        title={modalContent.title}
        message={modalContent.message}
        onClose={() => setShowModal(false)}
        onConfirm={modalContent.onConfirm}
        showConfirmButton={modalContent.showConfirm}
        showInput={modalContent.inputValue}
        confirmText={modalContent.confirmText}
        zIndex={modalContent.zIndex || 50}
      />

      {/* Diagram List Modal */}
      <DiagramListModal
        show={showDiagramListModal}
        onClose={() => setShowDiagramListModal(false)}
        diagrams={savedDiagrams}
        onLoadDiagram={handleLoadDiagram}
        onDeleteDiagram={handleDeleteDiagram}
        loading={loadingDiagrams}
        error={diagramListError}
      />
    </div>
  );
};

export default DiagramApp;
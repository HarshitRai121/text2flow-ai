// src/components/Canvas.js
import React, { useRef, useEffect, useCallback, useState, forwardRef } from 'react';
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement, getResizeHandles, drawConnectionIndicator, isPointInTextElement, getShapeConnectionPoint } from '../utils/drawingUtils';
import { hitTest, isPointInHandle, isPointNearShapeBoundary } from '../utils/hitTestUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';

// Use forwardRef to allow parent components to get a ref to the canvas DOM element
const Canvas = forwardRef(({ diagramElements, selectedElementId, selectedElementsIds, onElementSelect, onElementChange, onAddElement, onElementsSelect, activeTool, initialOffsetX, initialOffsetY, initialScale }, ref) => {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isDrawingRef = useRef(false); // Used for drawing new shapes AND selection box
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // Used for element drag/resize
  const resizeHandleNameRef = useRef(null);
  const selectedElementInitialPropsRef = useRef(null); // Stores initial props of element(s) being dragged/resized
  const startDrawingPointRef = useRef({ x: 0, y: 0 }); // Used for drawing new elements and selection box start
  const currentMousePosRef = useRef({ x: 0, y: 0 }); // Used for current mouse position in world coords
  
  // NEW: Ref to hold temporary, mutable elements during drag/resize for smooth updates
  const tempDiagramElementsRef = useRef([]);

  const potentialSourceElementRef = useRef(null);
  const potentialTargetElementRef = useRef(null);

  const [selectionBox, setSelectionBox] = useState(null); // State for the selection box rectangle
  const [textInputProps, setTextInputProps] = useState(null);

  // State for the actual DOM canvas dimensions (display size)
  const [canvasDisplayWidth, setCanvasDisplayWidth] = useState(CANVAS_WIDTH);
  const [canvasDisplayHeight, setCanvasDisplayHeight] = useState(CANVAS_HEIGHT);

  // Internal state for user-initiated panning/zooming
  const [panOffsetX, setPanOffsetX] = useState(0);
  const [panOffsetY, setPanOffsetY] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);

  const isPanningRef = useRef(false);
  const lastPanMousePosRef = useRef({ x: 0, y: 0 }); // Stores mouse position in screen coordinates for panning

  // Update internal pan/zoom states when initial props change (e.g., from fit-to-view)
  useEffect(() => {
    setPanOffsetX(initialOffsetX);
    setPanOffsetY(initialOffsetY);
    setZoomScale(initialScale);
  }, [initialOffsetX, initialOffsetY, initialScale]);

  // Helper function to get mouse position relative to the canvas's DOM element
  // Converts screen coordinates to world coordinates (after current pan/zoom)
  const getMousePos = (e) => {
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - panOffsetX) / zoomScale,
      y: (e.clientY - rect.top - panOffsetY) / zoomScale,
    };
  };

  // Function to draw all elements on the canvas
  const drawElements = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

    ctx.save(); // Save the current transformation state

    // Apply canvas transformations (panning and zooming)
    ctx.translate(panOffsetX, panOffsetY);
    ctx.scale(zoomScale, zoomScale);

    // Determine which set of elements to draw:
    // If dragging or resizing is active, use the temporary elements for smooth updates.
    // Otherwise, use the official diagramElements from state.
    const elementsToRender = (isDraggingRef.current || isResizingRef.current)
      ? tempDiagramElementsRef.current
      : diagramElements;

    elementsToRender.forEach(element => {
      const isSelected = selectedElementsIds.includes(element.id) || element.id === selectedElementId;
      switch (element.type) {
        case 'rectangle':
          drawRectangle(ctx, element, isSelected);
          break;
        case 'oval':
          drawOval(ctx, element, isSelected);
          break;
        case 'diamond':
          drawDiamond(ctx, element, isSelected);
          break;
        case 'line':
          drawLine(ctx, element, isSelected);
          break;
        case 'text':
          drawTextElement(ctx, element, isSelected);
          break;
        default:
          console.warn('Unknown element type:', element.type);
      }
    });

    // Draw preview of the new element being drawn (if a drawing tool is active and not SELECT)
    if (isDrawingRef.current && startDrawingPointRef.current && activeTool !== TOOL_TYPE.SELECT) {
      const { x: startX, y: startY } = startDrawingPointRef.current;
      const { x: currentX, y: currentY } = currentMousePosRef.current;

      const tempElement = {
        id: 'temp-preview',
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
        startX: startX,
        startY: startY,
        endX: currentX,
        endY: currentY,
        label: '',
        ...DEFAULT_ELEMENT_STYLE,
        strokeColor: '#3B82F6',
        fillColor: 'rgba(59, 130, 246, 0.2)',
      };

      switch (activeTool) {
        case TOOL_TYPE.RECTANGLE:
          drawRectangle(ctx, tempElement, false);
          break;
        case TOOL_TYPE.OVAL:
          drawOval(ctx, tempElement, false);
          break;
        case TOOL_TYPE.DIAMOND:
          drawDiamond(ctx, tempElement, false);
          break;
        case TOOL_TYPE.LINE:
          const sourceEl = potentialSourceElementRef.current;
          const targetEl = potentialTargetElementRef.current;

          const actualStartX = sourceEl ? getShapeConnectionPoint(sourceEl, targetEl ? (targetEl.x + targetEl.width / 2) : currentX, targetEl ? (targetEl.y + targetEl.height / 2) : currentY).x : startX;
          const actualStartY = sourceEl ? getShapeConnectionPoint(sourceEl, targetEl ? (targetEl.x + targetEl.width / 2) : currentX, targetEl ? (targetEl.y + targetEl.height / 2) : currentY).y : startY;
          const actualEndX = targetEl ? getShapeConnectionPoint(targetEl, sourceEl ? (sourceEl.x + sourceEl.width / 2) : startX, sourceEl ? (sourceEl.y + sourceEl.height / 2) : startY).x : currentX;
          const actualEndY = targetEl ? getShapeConnectionPoint(targetEl, sourceEl ? (sourceEl.x + sourceEl.width / 2) : startX, sourceEl ? (sourceEl.y + sourceEl.height / 2) : startY).y : currentY;

          drawLine(ctx, { ...tempElement, startX: actualStartX, startY: actualStartY, endX: actualEndX, endY: actualEndY }, false);
          
          if (sourceEl) {
            drawConnectionIndicator(ctx, sourceEl.x + sourceEl.width / 2, sourceEl.y + sourceEl.height / 2);
          }
          if (targetEl) {
            drawConnectionIndicator(ctx, targetEl.x + targetEl.width / 2, targetEl.y + targetEl.height / 2);
          }
          break;
        case TOOL_TYPE.TEXT:
          break;
        default:
          break;
      }
    }

    // Draw selection box in world coordinates ONLY if activeTool is SELECT and isDrawingRef is true
    if (selectionBox && activeTool === TOOL_TYPE.SELECT && isDrawingRef.current) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1 / zoomScale; // Scale line width so it appears consistent regardless of zoom
      ctx.setLineDash([5 / zoomScale, 5 / zoomScale]); // Scale dash pattern
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    }

    ctx.restore(); // Restore the canvas transformation state
  }, [diagramElements, selectedElementId, selectedElementsIds, activeTool, selectionBox, ref, potentialSourceElementRef, potentialTargetElementRef, panOffsetX, panOffsetY, zoomScale]);

  // Effect to set up ResizeObserver
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === canvas) {
          const newWidth = entry.contentRect.width;
          const newHeight = entry.contentRect.height;

          if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
            setCanvasDisplayWidth(newWidth);
            setCanvasDisplayHeight(newHeight);
          }
        }
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.unobserve(canvas);
    };
  }, [ref]);

  // Effect to re-draw when elements or canvas display dimensions or pan/zoom change
  // This useEffect will trigger redraws for state changes (diagramElements, pan/zoom)
  // For smooth dragging/resizing, drawElements() is called directly in handleMouseMove
  useEffect(() => {
    drawElements();
  }, [drawElements, canvasDisplayWidth, canvasDisplayHeight, panOffsetX, panOffsetY, zoomScale]);

  // --- Mouse Event Handlers ---
  const handleMouseDown = (e) => {
    // Store mouse position in screen coordinates for pan calculations
    lastPanMousePosRef.current = { x: e.clientX, y: e.clientY };

    const { x: mouseX, y: mouseY } = getMousePos(e); // Mouse position in world coordinates
    currentMousePosRef.current = { x: mouseX, y: mouseY };
    
    setTextInputProps(null); // Clear text input if active

    // If a drawing tool is active (excluding SELECT and TEXT)
    if (activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      isDrawingRef.current = true;
      startDrawingPointRef.current = { x: mouseX, y: mouseY };
      onElementSelect(null); // Clear single selection
      onElementsSelect([]); // Clear multi-selection

      if (activeTool === TOOL_TYPE.LINE) {
        for (let i = diagramElements.length - 1; i >= 0; i--) {
          const element = diagramElements[i];
          // Check for connection to shapes only
          if (element.type !== 'line' && element.type !== 'text' && isPointNearShapeBoundary(mouseX, mouseY, element)) {
            potentialSourceElementRef.current = element;
            break;
          }
        }
      }
      // Initialize tempDiagramElementsRef for drawing preview
      tempDiagramElementsRef.current = JSON.parse(JSON.stringify(diagramElements));
      return; // Exit early if drawing a new shape
    }

    // Logic for TEXT tool (click to create/edit)
    if (activeTool === TOOL_TYPE.TEXT) {
      let foundTextElementToEdit = false;
      for (let i = diagramElements.length - 1; i >= 0; i--) {
        const element = diagramElements[i];
        const textContent = element.type === 'text' ? element.text : element.label;

        if (textContent !== undefined && textContent !== null) {
          let textX = element.x;
          let textY = element.y;
          let fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;
          let textColor = element.color || DEFAULT_ELEMENT_STYLE.color;
          // Estimated width/height for hit test, adjusted for current zoomScale
          let estimatedWidth = (textContent.length * (fontSize * 0.6) + 20);
          let estimatedHeight = (fontSize * 1.2 + 20);

          if (element.type !== 'text') { // If it's a shape with a label
            textX = element.x + element.width / 2 - estimatedWidth / 2;
            textY = element.y + element.height / 2 - estimatedHeight / 2;
          }

          const tempTextElement = {
            ...element,
            type: 'text',
            x: textX,
            y: textY,
            text: textContent,
            fontSize: fontSize,
            color: textColor,
          };

          if (isPointInTextElement(mouseX, mouseY, tempTextElement)) {
            setTextInputProps({
              id: element.id,
              x: textX,
              y: textY,
              width: estimatedWidth,
              height: estimatedHeight,
              text: textContent,
              fontSize: fontSize,
              color: textColor,
              originalType: element.type
            });
            onElementSelect(element.id);
            onElementsSelect([]);
            foundTextElementToEdit = true;
            break;
          }
        }
      }

      if (foundTextElementToEdit) {
        isDrawingRef.current = false; // Not drawing a new text box
        return;
      } else {
        const newTextElement = {
          id: generateUniqueId(),
          type: TOOL_TYPE.TEXT,
          x: mouseX,
          y: mouseY,
          text: 'New Text',
          ...DEFAULT_ELEMENT_STYLE,
          fontSize: DEFAULT_ELEMENT_STYLE.fontSize,
          color: DEFAULT_ELEMENT_STYLE.color
        };
        onAddElement(newTextElement); // Add immediately to state for text input to work
        setTextInputProps({
          id: newTextElement.id,
          x: newTextElement.x,
          y: newTextElement.y,
          width: 100, // Initial width, will adjust with text input
          height: newTextElement.fontSize * 1.2,
          text: newTextElement.text,
          fontSize: newTextElement.fontSize,
          color: newTextElement.color,
          originalType: TOOL_TYPE.TEXT
        });
        isDrawingRef.current = false; // Not drawing a new text box
        return;
      }
    }

    // --- SELECT Tool Logic ---
    let clickedElement = null;
    let clickedHandle = null;

    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];

      // Check for resize handles first if an element is already selected (only single selection can resize)
      if (element.id === selectedElementId && (element.type === 'rectangle' || element.type === 'oval' || element.type === 'diamond')) {
        const handles = getResizeHandles(element);
        for (const handleName in handles) {
          if (isPointInHandle(mouseX, mouseY, handles[handleName], zoomScale)) {
            clickedHandle = handles[handleName];
            clickedElement = element;
            break;
          }
        }
      }
      if (clickedHandle) break;

      // If no handle, check for element body
      if (hitTest(element, mouseX, mouseY)) {
        clickedElement = element;
        break;
      }
    }

    // Handle selection and drag/resize state
    if (clickedHandle) {
      onElementSelect(clickedElement.id);
      onElementsSelect([]);
      isResizingRef.current = true;
      resizeHandleNameRef.current = clickedHandle.name;
      dragOffsetRef.current = { x: mouseX, y: mouseY }; // Store initial mouse position for resize calculations
      selectedElementInitialPropsRef.current = { ...clickedElement }; // Store initial properties for calculation
      tempDiagramElementsRef.current = JSON.parse(JSON.stringify(diagramElements)); // Start temp copy
    } else if (clickedElement) {
      if (e.shiftKey) {
        onElementsSelect(prev => {
          const newSelectedIds = prev.includes(clickedElement.id)
            ? prev.filter(id => id !== clickedElement.id)
            : [...prev, clickedElement.id];
          return newSelectedIds;
        });
        onElementSelect(null); // Clear single selection if multi-selecting
        isDraggingRef.current = true; // Allow dragging if shift-clicking an already selected item
        dragOffsetRef.current = { x: mouseX, y: mouseY };
        // Capture current multi-selection state for initial props
        selectedElementInitialPropsRef.current = diagramElements.filter(el => selectedElementsIds.includes(el.id) || el.id === clickedElement.id);
        tempDiagramElementsRef.current = JSON.parse(JSON.stringify(diagramElements)); // Start temp copy
      } else if (selectedElementsIds.includes(clickedElement.id)) {
        // If clicking an already multi-selected element without shift, start dragging the group
        onElementSelect(null); // Clear single selection
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: mouseX, y: mouseY };
        selectedElementInitialPropsRef.current = diagramElements.filter(el => selectedElementsIds.includes(el.id));
        tempDiagramElementsRef.current = JSON.parse(JSON.stringify(diagramElements)); // Start temp copy
      } else {
        // Single element selection and drag
        onElementSelect(clickedElement.id);
        onElementsSelect([]);
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: mouseX, y: mouseY };
        selectedElementInitialPropsRef.current = { ...clickedElement };
        tempDiagramElementsRef.current = JSON.parse(JSON.stringify(diagramElements)); // Start temp copy
      }
    } else { // Clicked on empty space
      onElementSelect(null); // Clear single selection
      onElementsSelect([]);  // Clear multi-selection
      isResizingRef.current = false;
      isDraggingRef.current = false;
      
      if (activeTool === TOOL_TYPE.SELECT) {
        if (e.altKey) { // Alt key for panning when SELECT tool is active
          isPanningRef.current = true;
          lastPanMousePosRef.current = { x: e.clientX, y: e.clientY };
        } else { // No Alt key, start selection box
          isDrawingRef.current = true; // Use isDrawingRef for selection box
          startDrawingPointRef.current = { x: mouseX, y: mouseY };
          setSelectionBox({ x: mouseX, y: mouseY, width: 0, height: 0 });
        }
      } else { // If other tools are active and clicked empty space, just reset states
        isPanningRef.current = false; // Ensure panning is off if not SELECT tool or Alt key
      }
    }
  };

  const handleMouseMove = (e) => {
    // Mouse position in screen coordinates
    const mouseScreenX = e.clientX;
    const mouseScreenY = e.clientY;

    // Mouse position in world coordinates (after applying current pan/zoom)
    const { x: mouseX, y: mouseY } = getMousePos(e);
    currentMousePosRef.current = { x: mouseX, y: mouseY };

    // Handle Panning
    if (isPanningRef.current) {
      const dx = mouseScreenX - lastPanMousePosRef.current.x;
      const dy = mouseScreenY - lastPanMousePosRef.current.y;
      setPanOffsetX(prev => prev + dx);
      setPanOffsetY(prev => prev + dy);
      lastPanMousePosRef.current = { x: mouseScreenX, y: mouseScreenY };
      // drawElements() will be called by useEffect due to panOffsetX/Y state change
      return; // Exit early if panning
    }

    // Drawing a new shape preview OR selection box
    if (isDrawingRef.current && startDrawingPointRef.current) {
      if (activeTool === TOOL_TYPE.LINE) { // Specific logic for line drawing preview
        let hoveredTarget = null;
        for (let i = diagramElements.length - 1; i >= 0; i--) {
          const element = diagramElements[i];
          if (element.type !== 'line' && element.type !== 'text' && isPointNearShapeBoundary(mouseX, mouseY, element)) {
            hoveredTarget = element;
            break;
          }
        }
        potentialTargetElementRef.current = hoveredTarget;
      }

      if (activeTool === TOOL_TYPE.SELECT) { // Logic for drawing selection box
        setSelectionBox(prev => ({
          x: Math.min(startDrawingPointRef.current.x, mouseX),
          y: Math.min(startDrawingPointRef.current.y, mouseY),
          width: Math.abs(mouseX - startDrawingPointRef.current.x),
          height: Math.abs(mouseY - startDrawingPointRef.current.y),
        }));
      }
      // Explicitly draw elements to show the drawing preview or selection box
      drawElements();
      return;
    }

    // Resizing an element
    if (isResizingRef.current && selectedElementInitialPropsRef.current && tempDiagramElementsRef.current) {
      const initialElement = selectedElementInitialPropsRef.current; // This is the single element's initial props
      const handleName = resizeHandleNameRef.current;
      const initialMouseX = dragOffsetRef.current.x; // These are in world coordinates
      const initialMouseY = dragOffsetRef.current.y;

      let newX = initialElement.x;
      let newY = initialElement.y;
      let newWidth = initialElement.width;
      let newHeight = initialElement.height;

      const dx = mouseX - initialMouseX; // Delta in world coordinates
      const dy = mouseY - initialMouseY;

      switch (handleName) {
        case 'tl': newX = initialElement.x + dx; newY = initialElement.y + dy; newWidth = initialElement.width - dx; newHeight = initialElement.height - dy; break;
        case 'tm': newY = initialElement.y + dy; newHeight = initialElement.height - dy; break;
        case 'tr': newWidth = initialElement.width + dx; newY = initialElement.y + dy; newHeight = initialElement.height - dy; break;
        case 'ml': newX = initialElement.x + dx; newWidth = initialElement.width - dx; break;
        case 'mr': newWidth = initialElement.width + dx; break;
        case 'bl': newX = initialElement.x + dx; newWidth = initialElement.width - dx; newHeight = initialElement.height + dy; break;
        case 'bm': newHeight = initialElement.height + dy; break;
        case 'br': newWidth = initialElement.width + dx; newHeight = initialElement.height + dy; break;
        default: break;
      }

      newWidth = Math.max(newWidth, RESIZE_HANDLE_SIZE * 2 / zoomScale); // Adjust min size by zoomScale
      newHeight = Math.max(newHeight, RESIZE_HANDLE_SIZE * 2 / zoomScale); // Adjust min size by zoomScale

      // Update the temporary element directly
      const elementIndex = tempDiagramElementsRef.current.findIndex(el => el.id === selectedElementId);
      if (elementIndex !== -1) {
        tempDiagramElementsRef.current[elementIndex] = {
          ...tempDiagramElementsRef.current[elementIndex],
          x: newX, y: newY, width: newWidth, height: newHeight
        };

        // Update connected lines in tempDiagramElementsRef.current
        tempDiagramElementsRef.current = tempDiagramElementsRef.current.map(el => {
          if (el.type === 'line' && (el.sourceId === selectedElementId || el.targetId === selectedElementId)) {
            const sourceShape = tempDiagramElementsRef.current.find(s => s.id === el.sourceId);
            const targetShape = tempDiagramElementsRef.current.find(s => s.id === el.targetId);

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
            return { ...el, startX: newStartX, startY: newStartY, endX: newEndX, endY: newEndY };
          }
          return el;
        });
      }
      // Explicitly redraw the canvas with the temporary elements
      drawElements();

    } else if (isDraggingRef.current && selectedElementInitialPropsRef.current && tempDiagramElementsRef.current) {
      // Handle dragging for single or multiple elements
      const deltaX = mouseX - dragOffsetRef.current.x; // Delta in world coordinates
      const deltaY = mouseY - dragOffsetRef.current.y;

      const updatedElementsInTemp = tempDiagramElementsRef.current.map(el => {
        // Find the initial properties of this element from the stored initial state
        const initialEl = Array.isArray(selectedElementInitialPropsRef.current)
          ? selectedElementInitialPropsRef.current.find(item => item.id === el.id)
          : (el.id === selectedElementId ? selectedElementInitialPropsRef.current : null);

        if (initialEl) { // If this element is part of the selection being dragged
          if (initialEl.type === 'line') {
            return {
              ...el, // Keep existing properties not related to position
              startX: initialEl.startX + deltaX,
              startY: initialEl.startY + deltaY,
              endX: initialEl.endX + deltaX,
              endY: initialEl.endY + deltaY,
            };
          } else {
            return {
              ...el, // Keep existing properties not related to position
              x: initialEl.x + deltaX,
              y: initialEl.y + deltaY,
            };
          }
        }
        return el; // Return unchanged if not part of the selection
      });

      // Update connected lines for all elements in tempDiagramElementsRef.current
      // This is crucial for lines to follow shapes during drag
      const finalUpdatedTempElements = updatedElementsInTemp.map(el => {
        if (el.type === 'line' && (el.sourceId || el.targetId)) {
          const sourceShape = updatedElementsInTemp.find(s => s.id === el.sourceId);
          const targetShape = updatedElementsInTemp.find(s => s.id === el.targetId);

          if (sourceShape && targetShape) {
            const { x: connectedStartX, y: connectedStartY } = getShapeConnectionPoint(sourceShape, targetShape.x + targetShape.width / 2, targetShape.y + targetShape.height / 2);
            const { x: connectedEndX, y: connectedEndY } = getShapeConnectionPoint(targetShape, sourceShape.x + sourceShape.width / 2, sourceShape.y + sourceShape.height / 2);
            return { ...el, startX: connectedStartX, startY: connectedStartY, endX: connectedEndX, endY: connectedEndY };
          } else if (sourceShape) {
            const { x: connX, y: connY } = getShapeConnectionPoint(sourceShape, el.endX, el.endY);
            return { ...el, startX: connX, startY: connY };
          } else if (targetShape) {
            const { x: connX, y: connY } = getShapeConnectionPoint(targetShape, el.startX, el.startY);
            return { ...el, endX: connX, endY: connY };
          }
        }
        return el;
      });
      
      tempDiagramElementsRef.current = finalUpdatedTempElements; // Update the ref with the new positions
      drawElements(); // Explicitly redraw the canvas with the temporary elements
    }

    // Update cursor based on hover and active tool
    const canvas = ref.current;
    if (canvas) {
      let cursor = 'default';

      if (isPanningRef.current) { // If currently panning
        cursor = 'grabbing';
      } else if (isResizingRef.current) { // If currently resizing
        // Use the element from tempDiagramElementsRef for cursor logic if resizing
        const currentSelectedElementForCursor = tempDiagramElementsRef.current.find(el => el.id === selectedElementId);
        if (currentSelectedElementForCursor) {
          const handles = getResizeHandles(currentSelectedElementForCursor);
          const handleName = resizeHandleNameRef.current;
          cursor = handleName && handles?.[handleName]?.cursor ? handles[handleName].cursor : 'default';
        } else {
          cursor = 'default';
        }
      } else if (isDrawingRef.current && activeTool === TOOL_TYPE.SELECT) { // If drawing selection box
        cursor = 'crosshair';
      } else if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT) { // If drawing new shape
        cursor = 'crosshair';
      } else if (activeTool === TOOL_TYPE.SELECT) { // If SELECT tool is active and not drawing/panning/resizing
        let hoveredElement = null;
        let hoveredHandle = null;

        for (let i = diagramElements.length - 1; i >= 0; i--) {
          const element = diagramElements[i];
          if (element.id === selectedElementId && (element.type === 'rectangle' || element.type === 'oval' || element.type === 'diamond')) {
            const handles = getResizeHandles(element);
            for (const handleName in handles) {
              if (isPointInHandle(mouseX, mouseY, handles[handleName], zoomScale)) {
                hoveredHandle = handles[handleName];
                break;
              }
            }
          }
          if (hoveredHandle) break;

          if (hitTest(element, mouseX, mouseY)) {
            hoveredElement = element;
            break;
          }
        }

        if (hoveredHandle) {
          cursor = hoveredHandle.cursor;
        } else if (hoveredElement) {
          cursor = 'grab'; // For dragging element
        } else if (e.altKey) { // If Alt key is pressed, show grab for panning
          cursor = 'grab';
        } else { // Default for empty space with SELECT tool, ready to draw selection box
          cursor = 'crosshair';
        }
      } else if (activeTool === TOOL_TYPE.TEXT) { // If TEXT tool is active
        cursor = 'text';
      } else { // If other drawing tools are active (RECTANGLE, OVAL, etc.)
        cursor = 'crosshair';
      }
      canvas.style.cursor = cursor;
    }
  };

  const handleMouseUp = (e) => {
    // Reset panning state
    isPanningRef.current = false;

    const { x: mouseX, y: mouseY } = getMousePos(e);
    const { x: startX, y: startY } = startDrawingPointRef.current;

    // Handle selection box completion
    if (selectionBox && activeTool === TOOL_TYPE.SELECT && isDrawingRef.current) {
      const minX = Math.min(startX, mouseX);
      const minY = Math.min(startY, mouseY);
      const maxX = Math.max(startX, mouseX);
      const maxY = Math.max(startY, mouseY);

      const newlySelectedIds = diagramElements.filter(el => {
        let elMinX, elMinY, elMaxX, elMaxY;
        if (el.type === 'line') {
          elMinX = Math.min(el.startX, el.endX);
          elMinY = Math.min(el.startY, el.endY);
          elMaxX = Math.max(el.startX, el.endX);
          elMaxY = Math.max(el.startY, el.endY);
        } else if (el.type === 'text') {
            // Re-calculate text bounds for accurate intersection
            const dummyCanvas = document.createElement('canvas');
            const dummyCtx = dummyCanvas.getContext('2d');
            dummyCtx.font = `${el.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
            const textLines = el.text.split('\n');
            let totalTextHeight = 0;
            let maxWidth = 0;
            for (const line of textLines) {
                const metrics = dummyCtx.measureText(line);
                maxWidth = Math.max(maxWidth, metrics.width);
                totalTextHeight += (el.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * 1.2;
            }
            elMinX = el.x;
            elMinY = el.y;
            elMaxX = el.x + maxWidth;
            elMaxY = el.y + totalTextHeight;
        }
        else { // Shapes
          elMinX = el.x;
          elMinY = el.y;
          elMaxX = el.x + el.width;
          elMaxY = el.y + el.height;
        }

        // Check for intersection (AABB intersection)
        return elMinX < maxX && elMaxX > minX &&
               elMinY < maxY && elMaxY > minY;
      }).map(el => el.id);

      onElementsSelect(newlySelectedIds);
      onElementSelect(null); // Clear single selection when group selecting
      setSelectionBox(null); // Clear the drawing of the selection box
    }

    // Finalize drawing a new shape/line (if activeTool is not SELECT)
    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      let newElement = null;
      const width = Math.abs(mouseX - startX);
      const height = Math.abs(mouseY - startY);
      const x = Math.min(startX, mouseX);
      const y = Math.min(startY, mouseY);

      const MIN_DRAW_THRESHOLD = 5 / zoomScale; // Adjust threshold by zoomScale

      let shouldCreateElement = true;

      if (activeTool === TOOL_TYPE.LINE) {
        if (width < MIN_DRAW_THRESHOLD && height < MIN_DRAW_THRESHOLD) {
          shouldCreateElement = false;
        }
      } else {
        if (width < MIN_DRAW_THRESHOLD || height < MIN_DRAW_THRESHOLD) {
          shouldCreateElement = false;
        }
      }

      if (!shouldCreateElement) {
        isDrawingRef.current = false;
        potentialSourceElementRef.current = null;
        potentialTargetElementRef.current = null;
        tempDiagramElementsRef.current = []; // Clear temp elements
        return;
      }

      switch (activeTool) {
        case TOOL_TYPE.RECTANGLE:
          newElement = { id: generateUniqueId(), type: TOOL_TYPE.RECTANGLE, x, y, width, height, label: '', ...DEFAULT_ELEMENT_STYLE };
          break;
        case TOOL_TYPE.OVAL:
          newElement = { id: generateUniqueId(), type: TOOL_TYPE.OVAL, x, y, width, height, label: '', ...DEFAULT_ELEMENT_STYLE };
          break;
        case TOOL_TYPE.DIAMOND:
          newElement = { id: generateUniqueId(), type: TOOL_TYPE.DIAMOND, x, y, width, height, label: '', ...DEFAULT_ELEMENT_STYLE };
          break;
        case TOOL_TYPE.LINE:
          const sourceElement = potentialSourceElementRef.current;
          const targetElement = potentialTargetElementRef.current;

          let finalStartX = startX;
          let finalStartY = startY;
          let finalEndX = mouseX;
          let finalEndY = mouseY;
          let sourceId = null;
          let targetId = null;

          if (sourceElement) {
            sourceId = sourceElement.id;
            // Use precise connection point if connected
            const { x: connX, y: connY } = getShapeConnectionPoint(sourceElement, targetElement ? (targetElement.x + targetElement.width / 2) : mouseX, targetElement ? (targetElement.y + targetElement.height / 2) : mouseY);
            finalStartX = connX;
            finalStartY = connY;
          }
          if (targetElement) {
            targetId = targetElement.id;
            // Use precise connection point if connected
            const { x: connX, y: connY } = getShapeConnectionPoint(targetElement, sourceElement ? (sourceElement.x + sourceElement.width / 2) : startX, sourceElement ? (sourceElement.y + sourceElement.height / 2) : startY);
            finalEndX = connX;
            finalEndY = connY;
          }

          newElement = {
            id: generateUniqueId(),
            type: TOOL_TYPE.LINE,
            startX: finalStartX,
            startY: finalStartY,
            endX: finalEndX,
            endY: finalEndY,
            label: '',
            arrowhead: true,
            ...DEFAULT_ELEMENT_STYLE,
            sourceId: sourceId,
            targetId: targetId,
          };
          break;
        default:
          break;
      }

      if (newElement) {
        onAddElement(newElement); // Add the new element to the parent state
      }
    }

    // Commit the state to history only when drag/resize ends and there were actual updates
    if ((isDraggingRef.current || isResizingRef.current) && tempDiagramElementsRef.current.length > 0) {
      // Pass the final state of tempDiagramElementsRef.current back to parent
      // The parent (DiagramApp) will then update its diagramElements state and push to history
      onElementChange(null, tempDiagramElementsRef.current, true); // `null` for id indicates a bulk update
    }

    // Reset all transient state variables and refs after any mouse up
    isDraggingRef.current = false;
    isResizingRef.current = false;
    isDrawingRef.current = false; // Important: Reset drawing state here
    resizeHandleNameRef.current = null;
    selectedElementInitialPropsRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    startDrawingPointRef.current = { x: 0, y: 0 };
    currentMousePosRef.current = { x: 0, y: 0 };
    potentialSourceElementRef.current = null;
    potentialTargetElementRef.current = null;
    tempDiagramElementsRef.current = []; // Clear temporary elements after commit
  };

  // Double-click handler for text editing
  const handleDoubleClick = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];
      const textContent = element.type === 'text' ? element.text : element.label;

      if (textContent !== undefined && textContent !== null) {
        let textX = element.x;
        let textY = element.y;
        let fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;
        let textColor = element.color || DEFAULT_ELEMENT_STYLE.color;
        let estimatedWidth = textContent.length * (fontSize * 0.6) + 20;
        let estimatedHeight = fontSize * 1.2 + 20;

        if (element.type !== 'text') {
          textX = element.x + element.width / 2 - estimatedWidth / 2;
          textY = element.y + element.height / 2 - estimatedHeight / 2;
        }

        const tempTextElement = {
          ...element,
          type: 'text',
          x: textX,
          y: textY,
          text: textContent,
          fontSize: fontSize,
          color: textColor,
        };

        if (isPointInTextElement(mouseX, mouseY, tempTextElement)) {
          setTextInputProps({
            id: element.id,
            x: textX,
            y: textY,
            width: estimatedWidth,
            height: estimatedHeight,
            text: textContent,
            fontSize: fontSize,
            color: textColor,
            originalType: element.type
          });
          onElementSelect(element.id);
          onElementsSelect([]);
          return;
        }
      }
    }
    setTextInputProps(null);
  };

  // Handler for text input change (updates element in real-time)
  const handleTextInputChange = (e) => {
    const newText = e.target.value;
    setTextInputProps(prev => ({ ...prev, text: newText }));
    // Directly update the state for text input changes as they are discrete and not continuous drag/resize
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: newText } : { label: newText });
  };

  // Handler for text input blur (commits to history)
  const handleTextInputBlur = () => {
    // The change was already committed in handleTextInputChange, but ensure history is pushed on blur too.
    // This handles cases where user types, then clicks away without moving mouse.
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: textInputProps.text } : { label: textInputProps.text }, true);
    setTextInputProps(null);
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={ref}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Treat mouse leaving canvas as mouse up
        onDoubleClick={handleDoubleClick}
        className="block bg-f8f8f8 border border-e0e0e0 rounded-lg shadow-md w-full h-full"
      ></canvas>

      {textInputProps && (
        <textarea
          className="absolute p-1 border border-blue-500 rounded-md resize-none overflow-hidden focus:outline-none"
          style={{
            // Position the textarea based on transformed coordinates
            left: textInputProps.x * zoomScale + panOffsetX,
            top: textInputProps.y * zoomScale + panOffsetY,
            width: textInputProps.width * zoomScale,
            height: textInputProps.height * zoomScale,
            fontSize: textInputProps.fontSize * zoomScale,
            color: textInputProps.color,
            fontFamily: 'Inter, sans-serif',
            lineHeight: `${textInputProps.fontSize * 1.2 * zoomScale}px`,
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: 20,
          }}
          value={textInputProps.text}
          onChange={handleTextInputChange}
          onBlur={handleTextInputBlur}
          autoFocus
        />
      )}
    </div>
  );
});

export default Canvas;

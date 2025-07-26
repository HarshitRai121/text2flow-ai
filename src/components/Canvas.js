// src/components/Canvas.js
import React, { useRef, useEffect, useCallback, useState, forwardRef } from 'react';
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement, getResizeHandles, drawConnectionIndicator } from '../utils/drawingUtils';
import { hitTest, isPointInHandle, isPointInTextElement, isPointNearShapeBoundary } from '../utils/hitTestUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';

// Use forwardRef to allow parent components to get a ref to the canvas DOM element
const Canvas = forwardRef(({ diagramElements, selectedElementId, selectedElementsIds, onElementSelect, onElementChange, onAddElement, onElementsSelect, activeTool }, ref) => {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isDrawingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 }); // Used for element drag/resize and now for canvas pan
  const resizeHandleNameRef = useRef(null);
  const selectedElementInitialPropsRef = useRef(null);
  const startDrawingPointRef = useRef({ x: 0, y: 0 }); // Used for drawing new elements and selection box
  const currentMousePosRef = useRef({ x: 0, y: 0 });
  const lastUpdatedElementPropsRef = useRef(null);

  const potentialSourceElementRef = useRef(null);
  const potentialTargetElementRef = useRef(null);

  const [selectionBox, setSelectionBox] = useState(null);
  const [textInputProps, setTextInputProps] = useState(null);

  // State for the actual DOM canvas dimensions (display size)
  const [canvasDisplayWidth, setCanvasDisplayWidth] = useState(CANVAS_WIDTH);
  const [canvasDisplayHeight, setCanvasDisplayHeight] = useState(CANVAS_HEIGHT);

  // New: State for canvas pan/zoom
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [scale, setScale] = useState(1); // Will be used later for zooming

  const isPanningRef = useRef(false); // New ref to track if canvas itself is being panned
  const lastPanMousePosRef = useRef({ x: 0, y: 0 }); // To calculate pan delta

  // Helper function to get mouse position relative to the canvas's DOM element
  const getMousePos = (e) => {
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    // Convert mouse coordinates to canvas's internal (scaled and translated) coordinates
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale,
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
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    diagramElements.forEach(element => {
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

    // Draw preview of the new element being drawn (if a drawing tool is active)
    if (isDrawingRef.current && startDrawingPointRef.current) {
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

          // Note: getShapeConnectionPoint expects world coordinates, which startX/Y and currentX/Y already are
          const actualStartX = sourceEl ? (sourceEl.x + sourceEl.width / 2) : startX;
          const actualStartY = sourceEl ? (sourceEl.y + sourceEl.height / 2) : startY;
          const actualEndX = targetEl ? (targetEl.x + targetEl.width / 2) : currentX;
          const actualEndY = targetEl ? (targetEl.y + targetEl.height / 2) : currentY;

          drawLine(ctx, { ...tempElement, startX: actualStartX, startY: actualStartY, endX: actualEndX, endY: actualEndY }, false);
          
          // Draw connection indicators in world coordinates
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

    // Draw selection box in world coordinates
    if (selectionBox) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1 / scale; // Scale line width so it appears consistent regardless of zoom
      ctx.setLineDash([5 / scale, 5 / scale]); // Scale dash pattern
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    }

    ctx.restore(); // Restore the canvas transformation state
  }, [diagramElements, selectedElementId, selectedElementsIds, activeTool, selectionBox, ref, potentialSourceElementRef, potentialTargetElementRef, offsetX, offsetY, scale]); // Add pan/zoom states to dependencies

  // Effect to set up ResizeObserver
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === canvas) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
          setCanvasDisplayWidth(entry.contentRect.width);
          setCanvasDisplayHeight(entry.contentRect.height);
        }
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.unobserve(canvas);
    };
  }, [ref]);

  // Effect to re-draw when elements or canvas display dimensions or pan/zoom change
  useEffect(() => {
    drawElements();
  }, [drawElements, canvasDisplayWidth, canvasDisplayHeight, offsetX, offsetY, scale]); // Added pan/zoom states here

  // --- Mouse Event Handlers ---
  const handleMouseDown = (e) => {
    // Store mouse position in screen coordinates for pan calculations
    lastPanMousePosRef.current = { x: e.clientX, y: e.clientY };

    const { x: mouseX, y: mouseY } = getMousePos(e); // Mouse position in world coordinates
    currentMousePosRef.current = { x: mouseX, y: mouseY };
    lastUpdatedElementPropsRef.current = null;

    setTextInputProps(null);

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
      return; // Exit early if drawing
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
          // Estimated width/height for hit test, adjusted for current scale
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
        isDrawingRef.current = false;
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
        onAddElement(newTextElement);
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
        isDrawingRef.current = false;
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
          // Pass scale to isPointInHandle if handle sizes are affected by zoom
          if (isPointInHandle(mouseX, mouseY, handles[handleName])) {
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
      selectedElementInitialPropsRef.current = { ...clickedElement }; // Store initial properties
    } else if (clickedElement) {
      if (e.shiftKey) {
        onElementsSelect(prev => {
          if (prev.includes(clickedElement.id)) {
            return prev.filter(id => id !== clickedElement.id);
          } else {
            return [...prev, clickedElement.id];
          }
        });
        onElementSelect(null);
      } else if (selectedElementsIds.includes(clickedElement.id)) {
        onElementSelect(null);
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: mouseX, y: mouseY };
        selectedElementInitialPropsRef.current = diagramElements.filter(el => selectedElementsIds.includes(el.id));
      } else {
        onElementSelect(clickedElement.id);
        onElementsSelect([]);
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: mouseX, y: mouseY };
        selectedElementInitialPropsRef.current = { ...clickedElement };
      }
    } else {
      // Clicked on empty space - initiate panning or selection box
      onElementSelect(null);
      onElementsSelect([]);
      isDrawingRef.current = false;
      isDraggingRef.current = false;
      isResizingRef.current = false;
      
      // If no element or handle is clicked, start panning the canvas
      isPanningRef.current = true;
      // No selection box for now, will re-introduce later if needed with pan/zoom
      // setSelectionBox({ x: mouseX, y: mouseY, width: 0, height: 0 }); 
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
      setOffsetX(prev => prev + dx);
      setOffsetY(prev => prev + dy);
      lastPanMousePosRef.current = { x: mouseScreenX, y: mouseScreenY };
      drawElements(); // Redraw immediately for smooth panning
      return; // Exit early if panning
    }

    // Drawing a new shape/line preview
    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      if (activeTool === TOOL_TYPE.LINE) {
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
      drawElements(); // Redraw canvas to show drawing preview or line snapping
      return;
    }

    // Selection box drawing (currently disabled for simplicity with pan)
    if (selectionBox) {
      setSelectionBox(prev => ({
        x: Math.min(startDrawingPointRef.current.x, mouseX),
        y: Math.min(startDrawingPointRef.current.y, mouseY),
        width: Math.abs(mouseX - startDrawingPointRef.current.x),
        height: Math.abs(mouseY - startDrawingPointRef.current.y),
      }));
      drawElements();
      return;
    }

    // Get the *current* elements from diagramElements for up-to-date properties
    const currentSelectedElement = diagramElements.find(el => el.id === selectedElementId);

    // Resizing an element
    if (isResizingRef.current && currentSelectedElement && selectedElementInitialPropsRef.current) {
      const initialElement = selectedElementInitialPropsRef.current;
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

      newWidth = Math.max(newWidth, RESIZE_HANDLE_SIZE * 2 / scale); // Adjust min size by scale
      newHeight = Math.max(newHeight, RESIZE_HANDLE_SIZE * 2 / scale); // Adjust min size by scale

      const updatedProps = { x: newX, y: newY, width: newWidth, height: newHeight };
      onElementChange(currentSelectedElement.id, updatedProps);
      lastUpdatedElementPropsRef.current = updatedProps;

    } else if (isDraggingRef.current && selectedElementInitialPropsRef.current) {
      // Handle dragging for single or multiple elements
      const deltaX = mouseX - dragOffsetRef.current.x; // Delta in world coordinates
      const deltaY = mouseY - dragOffsetRef.current.y;

      if (selectedElementId) { // Single element drag
        const initialElement = selectedElementInitialPropsRef.current;
        let newElementProps = {};
        if (initialElement.type === 'line') {
          newElementProps = {
            startX: initialElement.startX + deltaX,
            startY: initialElement.startY + deltaY,
            endX: initialElement.endX + deltaX,
            endY: initialElement.endY + deltaY,
          };
        } else {
          newElementProps = {
            x: initialElement.x + deltaX,
            y: initialElement.y + deltaY,
          };
        }
        onElementChange(selectedElementId, newElementProps);
        lastUpdatedElementPropsRef.current = newElementProps;
      } else if (selectedElementsIds.length > 0) { // Multi-element drag
        const updatedElementsProps = selectedElementInitialPropsRef.current.map(initialEl => {
          let newProps = {};
          if (initialEl.type === 'line') {
            newProps = {
              startX: initialEl.startX + deltaX,
              startY: initialEl.startY + deltaY,
              endX: initialEl.endX + deltaX,
              endY: initialEl.endY + deltaY,
            };
          } else {
            newProps = {
              x: initialEl.x + deltaX,
              y: initialEl.y + deltaY,
            };
          }
          return { id: initialEl.id, ...newProps };
        });
        updatedElementsProps.forEach(props => onElementChange(props.id, props));
        lastUpdatedElementPropsRef.current = updatedElementsProps;
      }
    }

    // Update cursor based on hover and active tool
    const canvas = ref.current;
    if (canvas) {
      let cursor = 'default';

      if (isDrawingRef.current || selectionBox) {
        cursor = 'crosshair';
      } else if (isResizingRef.current) {
        if (currentSelectedElement) {
          const handles = getResizeHandles(currentSelectedElement);
          const handleName = resizeHandleNameRef.current;
          cursor = handleName && handles?.[handleName]?.cursor ? handles[handleName].cursor : 'default';
        } else {
          cursor = 'default';
        }
      } else if (activeTool === TOOL_TYPE.SELECT) {
        let hoveredElement = null;
        let hoveredHandle = null;

        for (let i = diagramElements.length - 1; i >= 0; i--) {
          const element = diagramElements[i];
          if (element.id === selectedElementId && (element.type === 'rectangle' || element.type === 'oval' || element.type === 'diamond')) {
            const handles = getResizeHandles(element);
            for (const handleName in handles) {
              if (isPointInHandle(mouseX, mouseY, handles[handleName])) {
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
          cursor = 'grab';
        } else {
          // If nothing is selected and not drawing, allow panning with 'grab' cursor
          cursor = 'grab';
        }
      } else if (activeTool === TOOL_TYPE.TEXT) {
        cursor = 'text';
      } else {
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

    // Handle selection box completion (currently disabled for simplicity with pan)
    if (selectionBox) {
      const minX = Math.min(startX, mouseX);
      const minY = Math.min(startY, mouseY);
      const maxX = Math.max(startX, mouseX);
      const maxY = Math.max(startY, mouseY);

      const newlySelectedIds = diagramElements.filter(el => {
        let elX, elY, elWidth, elHeight;
        if (el.type === 'line') {
          elX = Math.min(el.startX, el.endX);
          elY = Math.min(el.startY, el.endY);
          elWidth = Math.abs(el.endX - el.startX);
          elHeight = Math.abs(el.endY - el.startY);
        } else {
          elX = el.x;
          elY = el.y;
          elWidth = el.width;
          elHeight = el.height;
        }

        return elX < maxX && elX + elWidth > minX &&
               elY < maxY && elY + elHeight > minY;
      }).map(el => el.id);

      onElementsSelect(newlySelectedIds);
      onElementSelect(null);
      setSelectionBox(null);
    }

    // Finalize drawing a new shape/line
    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      let newElement = null;
      const width = Math.abs(mouseX - startX);
      const height = Math.abs(mouseY - startY);
      const x = Math.min(startX, mouseX);
      const y = Math.min(startY, mouseY);

      const MIN_DRAW_THRESHOLD = 5 / scale; // Adjust threshold by scale

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
        onAddElement(newElement);
      }
    }

    // Commit the state to history only when drag/resize ends and there were actual updates
    if ((isDraggingRef.current || isResizingRef.current) && lastUpdatedElementPropsRef.current) {
      if (Array.isArray(lastUpdatedElementPropsRef.current)) {
        onElementChange(null, lastUpdatedElementPropsRef.current, true);
      } else {
        onElementChange(selectedElementId, lastUpdatedElementPropsRef.current, true);
      }
    }

    // Reset all transient state variables and refs
    isDraggingRef.current = false;
    isResizingRef.current = false;
    isDrawingRef.current = false;
    resizeHandleNameRef.current = null;
    selectedElementInitialPropsRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    startDrawingPointRef.current = { x: 0, y: 0 };
    currentMousePosRef.current = { x: 0, y: 0 };
    lastUpdatedElementPropsRef.current = null;
    potentialSourceElementRef.current = null;
    potentialTargetElementRef.current = null;
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
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: newText } : { label: newText });
  };

  // Handler for text input blur (commits to history)
  const handleTextInputBlur = () => {
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
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="block bg-f8f8f8 border border-e0e0e0 rounded-lg shadow-md w-full h-full"
      ></canvas>

      {textInputProps && (
        <textarea
          className="absolute p-1 border border-blue-500 rounded-md resize-none overflow-hidden focus:outline-none"
          style={{
            // Position the textarea based on transformed coordinates
            left: textInputProps.x * scale + offsetX,
            top: textInputProps.y * scale + offsetY,
            width: textInputProps.width * scale,
            height: textInputProps.height * scale,
            fontSize: textInputProps.fontSize * scale,
            color: textInputProps.color,
            fontFamily: 'Inter, sans-serif',
            lineHeight: `${textInputProps.fontSize * 1.2 * scale}px`,
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
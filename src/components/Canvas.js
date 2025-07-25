// src/components/Canvas.js
import React, { useRef, useEffect, useCallback, useState, forwardRef } from 'react';
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement, getResizeHandles, drawConnectionIndicator } from '../utils/drawingUtils';
import { hitTest, isPointInHandle, isPointInTextElement, isPointNearShapeBoundary } from '../utils/hitTestUtils'; // Import new hit test
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';

// Use forwardRef to allow parent components to get a ref to the canvas DOM element
const Canvas = forwardRef(({ diagramElements, selectedElementId, selectedElementsIds, onElementSelect, onElementChange, onAddElement, onElementsSelect, activeTool }, ref) => {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isDrawingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeHandleNameRef = useRef(null);
  const selectedElementInitialPropsRef = useRef(null);
  const startDrawingPointRef = useRef({ x: 0, y: 0 });
  const currentMousePosRef = useRef({ x: 0, y: 0 });
  const lastUpdatedElementPropsRef = useRef(null);

  // New: Refs for line connection logic
  const potentialSourceElementRef = useRef(null); // Element hovered over when starting a line drag
  const potentialTargetElementRef = useRef(null); // Element hovered over when ending a line drag

  // State for drawing the selection box (local to Canvas)
  const [selectionBox, setSelectionBox] = useState(null);

  const [textInputProps, setTextInputProps] = useState(null);

  // Helper function to get mouse position relative to the canvas
  const getMousePos = (e) => {
    const canvas = ref.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Function to draw all elements on the canvas
  const drawElements = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

    diagramElements.forEach(element => {
      // Check if element is part of multi-selection or single selection
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
          // If drawing a line, check for potential source/target elements
          const sourceEl = potentialSourceElementRef.current;
          const targetEl = potentialTargetElementRef.current;

          // Draw line preview, possibly snapping to potential source/target
          const actualStartX = sourceEl ? (sourceEl.x + sourceEl.width / 2) : startX;
          const actualStartY = sourceEl ? (sourceEl.y + sourceEl.height / 2) : startY;
          const actualEndX = targetEl ? (targetEl.x + targetEl.width / 2) : currentX;
          const actualEndY = targetEl ? (targetEl.y + targetEl.height / 2) : currentY;

          drawLine(ctx, { ...tempElement, startX: actualStartX, startY: actualStartY, endX: actualEndX, endY: actualEndY }, false);
          
          // Draw connection indicators if hovering over elements
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

    // Draw selection box
    if (selectionBox) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    }
  }, [diagramElements, selectedElementId, selectedElementsIds, activeTool, selectionBox, ref, potentialSourceElementRef, potentialTargetElementRef]);

  // Effect to re-draw when elements or selection changes
  useEffect(() => {
    drawElements();
  }, [drawElements]);

  // --- Mouse Event Handlers ---
  const handleMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    currentMousePosRef.current = { x: mouseX, y: mouseY };
    lastUpdatedElementPropsRef.current = null; // Reset for new operation

    setTextInputProps(null); // Hide text input if clicking anywhere else

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
            onElementSelect(element.id); // Select the element whose text is being edited
            onElementsSelect([]); // Clear multi-selection
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
          width: 100,
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

    // Logic for other drawing tools (RECTANGLE, OVAL, DIAMOND, LINE)
    if (activeTool !== TOOL_TYPE.SELECT) {
      isDrawingRef.current = true;
      startDrawingPointRef.current = { x: mouseX, y: mouseY };
      onElementSelect(null); // Clear single selection
      onElementsSelect([]); // Clear multi-selection

      // If drawing a line, check for a potential source element
      if (activeTool === TOOL_TYPE.LINE) {
        for (let i = diagramElements.length - 1; i >= 0; i--) {
          const element = diagramElements[i];
          if (element.type !== 'line' && element.type !== 'text' && isPointNearShapeBoundary(mouseX, mouseY, element)) {
            potentialSourceElementRef.current = element;
            break;
          }
        }
      }
      return;
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
      onElementSelect(clickedElement.id); // Ensure single selection for resize
      onElementsSelect([]); // Clear multi-selection for resize
      isResizingRef.current = true;
      resizeHandleNameRef.current = clickedHandle.name;
      dragOffsetRef.current = { x: mouseX, y: mouseY }; // Store initial mouse position for resize calculations
      selectedElementInitialPropsRef.current = { ...clickedElement }; // Store initial properties
    } else if (clickedElement) {
      // If clicked on an element
      if (e.shiftKey) {
        // Shift-click for multi-selection toggle
        onElementsSelect(prev => { // Use onElementsSelect from props
          if (prev.includes(clickedElement.id)) {
            return prev.filter(id => id !== clickedElement.id); // Deselect if already selected
          } else {
            return [...prev, clickedElement.id]; // Add to selection
          }
        });
        onElementSelect(null); // Clear single selection when multi-selecting
      } else if (selectedElementsIds.includes(clickedElement.id)) {
        // If clicking on an already multi-selected element, start dragging the group
        onElementSelect(null); // Clear single selection
        isDraggingRef.current = true;
        dragOffsetRef.current = { x: mouseX, y: mouseY }; // Store initial mouse position for group drag
        // Store initial properties for all selected elements for group drag
        selectedElementInitialPropsRef.current = diagramElements.filter(el => selectedElementsIds.includes(el.id));
      } else {
        // Single selection, clear multi-selection
        onElementSelect(clickedElement.id);
        onElementsSelect([]); // Clear multi-selection
        isDraggingRef.current = true;
        // Store initial mouse position for single element drag to calculate delta
        dragOffsetRef.current = { x: mouseX, y: mouseY };
        selectedElementInitialPropsRef.current = { ...clickedElement };
      }
    } else {
      // Clicked on empty space
      onElementSelect(null); // Clear single selection
      onElementsSelect([]); // Clear multi-selection
      isDrawingRef.current = false; // Not drawing a shape
      isDraggingRef.current = false; // Not dragging an element
      isResizingRef.current = false; // Not resizing an element
      startDrawingPointRef.current = { x: mouseX, y: mouseY }; // Set start point for selection box
      setSelectionBox({ x: mouseX, y: mouseY, width: 0, height: 0 }); // Start drawing selection box
    }
  };

  const handleMouseMove = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    currentMousePosRef.current = { x: mouseX, y: mouseY };

    // If drawing a line, update potential target element
    if (isDrawingRef.current && activeTool === TOOL_TYPE.LINE) {
      let hoveredTarget = null;
      for (let i = diagramElements.length - 1; i >= 0; i--) {
        const element = diagramElements[i];
        if (element.type !== 'line' && element.type !== 'text' && isPointNearShapeBoundary(mouseX, mouseY, element)) {
          hoveredTarget = element;
          break;
        }
      }
      potentialTargetElementRef.current = hoveredTarget;
      drawElements(); // Re-draw to show line preview and potential target indicator
      return;
    }

    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      drawElements(); // Re-draw canvas to show drawing preview
      return;
    }

    // Update selection box
    if (selectionBox) {
      setSelectionBox(prev => ({
        x: Math.min(startDrawingPointRef.current.x, mouseX),
        y: Math.min(startDrawingPointRef.current.y, mouseY),
        width: Math.abs(mouseX - startDrawingPointRef.current.x),
        height: Math.abs(mouseY - startDrawingPointRef.current.y),
      }));
      drawElements(); // Redraw to show updated selection box
      return;
    }

    // Get the *current* elements from diagramElements for up-to-date properties
    const currentSelectedElement = diagramElements.find(el => el.id === selectedElementId);

    if (isResizingRef.current && currentSelectedElement && selectedElementInitialPropsRef.current) {
      const initialElement = selectedElementInitialPropsRef.current;
      const handleName = resizeHandleNameRef.current;
      const initialMouseX = dragOffsetRef.current.x;
      const initialMouseY = dragOffsetRef.current.y;

      let newX = initialElement.x;
      let newY = initialElement.y;
      let newWidth = initialElement.width;
      let newHeight = initialElement.height;

      const dx = mouseX - initialMouseX;
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

      newWidth = Math.max(newWidth, RESIZE_HANDLE_SIZE * 2);
      newHeight = Math.max(newHeight, RESIZE_HANDLE_SIZE * 2);

      const updatedProps = { x: newX, y: newY, width: newWidth, height: newHeight };
      onElementChange(currentSelectedElement.id, updatedProps);
      lastUpdatedElementPropsRef.current = updatedProps;

    } else if (isDraggingRef.current && selectedElementInitialPropsRef.current) {
      // Handle dragging for single or multiple elements
      // Calculate delta based on initial mouse position (stored in dragOffsetRef.current)
      const deltaX = mouseX - dragOffsetRef.current.x;
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
        lastUpdatedElementPropsRef.current = newElementProps; // Store for commit
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
        // Send multiple updates to parent, but don't commit to history yet
        updatedElementsProps.forEach(props => onElementChange(props.id, props));
        lastUpdatedElementPropsRef.current = updatedElementsProps; // Store for commit
      }
    }

    // Update cursor based on hover and active tool
    const canvas = ref.current;
    if (canvas) {
      let cursor = 'default';

      if (isDrawingRef.current || selectionBox) { // Drawing a new shape or selection box
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
          // Only check handles if it's the single selected element (multi-selection doesn't resize)
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
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const { x: startX, y: startY } = startDrawingPointRef.current;

    // Handle selection box completion
    if (selectionBox) {
      const minX = Math.min(startX, mouseX);
      const minY = Math.min(startY, mouseY);
      const maxX = Math.max(startX, mouseX);
      const maxY = Math.max(startY, mouseY);

      const newlySelectedIds = diagramElements.filter(el => {
        // Simplified bounding box for hit test with selection box
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

      onElementsSelect(newlySelectedIds); // Update parent's multi-selection state
      onElementSelect(null); // Clear single selection when multi-selecting
      setSelectionBox(null); // Hide selection box
    }

    // Finalize drawing a new shape/line
    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      let newElement = null;
      const width = Math.abs(mouseX - startX);
      const height = Math.abs(mouseY - startY);
      const x = Math.min(startX, mouseX);
      const y = Math.min(startY, mouseY);

      const MIN_DRAW_THRESHOLD = 5; // A small threshold to distinguish a drag from a click

      let shouldCreateElement = true;

      if (activeTool === TOOL_TYPE.LINE) {
        // For a line, if both width AND height are too small, it's just a click
        if (width < MIN_DRAW_THRESHOLD && height < MIN_DRAW_THRESHOLD) {
          shouldCreateElement = false;
        }
      } else { // For shapes (rectangle, oval, diamond)
        // For shapes, if either width OR height is too small, don't create
        if (width < MIN_DRAW_THRESHOLD || height < MIN_DRAW_THRESHOLD) {
          shouldCreateElement = false;
        }
      }

      if (!shouldCreateElement) {
        isDrawingRef.current = false;
        potentialSourceElementRef.current = null; // Clear potential source
        potentialTargetElementRef.current = null; // Clear potential target
        return; // Don't create tiny elements or accidental clicks
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
          // If a line is being drawn, check for connection points
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
            // Use center of source element as start point if connected
            finalStartX = sourceElement.x + sourceElement.width / 2;
            finalStartY = sourceElement.y + sourceElement.height / 2;
          }
          if (targetElement) {
            targetId = targetElement.id;
            // Use center of target element as end point if connected
            finalEndX = targetElement.x + targetElement.width / 2;
            finalEndY = targetElement.y + targetElement.height / 2;
          }

          newElement = {
            id: generateUniqueId(),
            type: TOOL_TYPE.LINE,
            startX: finalStartX,
            startY: finalStartY,
            endX: finalEndX,
            endY: finalEndY,
            label: '',
            arrowhead: true, // Default lines to have arrowheads
            ...DEFAULT_ELEMENT_STYLE,
            sourceId: sourceId, // Store connected source element ID
            targetId: targetId, // Store connected target element ID
          };
          break;
        default:
          break;
      }

      if (newElement) {
        onAddElement(newElement); // Add the new element via callback
      }
    }

    // Commit the state to history only when drag/resize ends and there were actual updates
    if ((isDraggingRef.current || isResizingRef.current) && lastUpdatedElementPropsRef.current) {
      if (Array.isArray(lastUpdatedElementPropsRef.current)) { // Multi-element drag commit
        onElementChange(null, lastUpdatedElementPropsRef.current, true);
      } else { // Single element drag/resize commit
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
    potentialSourceElementRef.current = null; // Clear potential source
    potentialTargetElementRef.current = null; // Clear potential target
  };

  // Double-click handler for text editing
  const handleDoubleClick = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    // Iterate elements in reverse to find the top-most text element or shape with label
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
          onElementsSelect([]); // Clear multi-selection for text editing
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
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="block bg-f8f8f8 border border-e0e0e0 rounded-lg shadow-md"
      ></canvas>

      {textInputProps && (
        <textarea
          className="absolute p-1 border border-blue-500 rounded-md resize-none overflow-hidden focus:outline-none"
          style={{
            left: textInputProps.x,
            top: textInputProps.y,
            width: textInputProps.width,
            height: textInputProps.height,
            fontSize: textInputProps.fontSize,
            color: textInputProps.color,
            fontFamily: 'Inter, sans-serif',
            lineHeight: `${textInputProps.fontSize * 1.2}px`,
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

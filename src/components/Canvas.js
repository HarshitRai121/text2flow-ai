// src/components/Canvas.js
import React, { useRef, useEffect, useCallback, useState, forwardRef } from 'react'; // Import forwardRef
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement, getResizeHandles } from '../utils/drawingUtils';
import { hitTest, isPointInHandle, isPointInTextElement } from '../utils/hitTestUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';

// Use forwardRef to allow parent components to get a ref to the canvas DOM element
const Canvas = forwardRef(({ diagramElements, selectedElementId, onElementSelect, onElementChange, onAddElement, activeTool }, ref) => {
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isDrawingRef = useRef(false);
  // dragOffsetRef will store initial mouse position for resize, or offset for drag
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeHandleNameRef = useRef(null);
  // selectedElementInitialPropsRef will store the element's properties AT THE START of drag/resize
  const selectedElementInitialPropsRef = useRef(null);
  const startDrawingPointRef = useRef({ x: 0, y: 0 });
  const currentMousePosRef = useRef({ x: 0, y: 0 }); // Stores current mouse position for drawing preview
  const lastUpdatedElementPropsRef = useRef(null); // Stores the props sent to onElementChange for commit on mouseUp

  const [textInputProps, setTextInputProps] = useState(null);

  // Helper function to get mouse position relative to the canvas
  const getMousePos = (e) => {
    const canvas = ref.current; // Use the forwarded ref
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Function to draw all elements on the canvas
  const drawElements = useCallback(() => {
    const canvas = ref.current; // Use the forwarded ref
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

    // Draw existing diagram elements
    diagramElements.forEach(element => {
      const isSelected = element.id === selectedElementId;
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
      const { x: currentX, y: currentY } = currentMousePosRef.current; // Use the ref for current mouse position

      const tempElement = {
        id: 'temp-preview', // Temporary ID for preview
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY),
        startX: startX,
        startY: startY,
        endX: currentX,
        endY: currentY,
        label: '', // No label during drawing preview
        ...DEFAULT_ELEMENT_STYLE,
        strokeColor: '#3B82F6', // Blue preview outline
        fillColor: 'rgba(59, 130, 246, 0.2)', // Light blue transparent fill
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
          drawLine(ctx, tempElement, false);
          break;
        case TOOL_TYPE.TEXT:
          // No live preview for text tool; it creates on click
          break;
        default:
          break;
      }
    }
  }, [diagramElements, selectedElementId, activeTool, ref]); // Added ref to dependencies

  // Effect to re-draw when elements or selection changes
  useEffect(() => {
    drawElements();
  }, [drawElements]);

  // --- Mouse Event Handlers ---
  const handleMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    currentMousePosRef.current = { x: mouseX, y: mouseY }; // Update current mouse position ref
    lastUpdatedElementPropsRef.current = null; // Reset for new operation

    // Hide text input if clicking anywhere else
    setTextInputProps(null);

    // Logic for TEXT tool (click to create/edit)
    if (activeTool === TOOL_TYPE.TEXT) {
      let foundTextElementToEdit = false;
      // Check if an existing text element or label was clicked
      for (let i = diagramElements.length - 1; i >= 0; i--) {
        const element = diagramElements[i];
        const textContent = element.type === 'text' ? element.text : element.label;

        if (textContent !== undefined && textContent !== null) {
          let textX = element.x;
          let textY = element.y;
          let fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;
          let textColor = element.color || DEFAULT_ELEMENT_STYLE.color;
          let estimatedWidth = textContent.length * (fontSize * 0.6) + 20; // Rough estimate + padding
          let estimatedHeight = fontSize * 1.2 + 20; // Rough estimate + padding

          if (element.type !== 'text') { // It's a shape with a label
            textX = element.x + element.width / 2 - estimatedWidth / 2;
            textY = element.y + element.height / 2 - estimatedHeight / 2;
          }

          const tempTextElement = {
            ...element,
            type: 'text', // Treat as text for hit test
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
            foundTextElementToEdit = true;
            break;
          }
        }
      }

      if (foundTextElementToEdit) {
        isDrawingRef.current = false; // Not drawing, just editing
        return;
      } else {
        // If no existing text element/label was clicked, create a new one
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
          width: 100, // Initial estimate
          height: newTextElement.fontSize * 1.2, // Initial estimate
          text: newTextElement.text,
          fontSize: newTextElement.fontSize,
          color: newTextElement.color,
          originalType: TOOL_TYPE.TEXT
        });
        isDrawingRef.current = false; // Text tool doesn't "drag" to draw
        return;
      }
    }

    // Logic for other drawing tools (RECTANGLE, OVAL, DIAMOND, LINE)
    if (activeTool !== TOOL_TYPE.SELECT) {
      isDrawingRef.current = true;
      startDrawingPointRef.current = { x: mouseX, y: mouseY };
      onElementSelect(null); // Deselect any existing element when starting to draw
      return;
    }

    // --- SELECT Tool Logic ---
    let clickedElement = null;
    let clickedHandle = null;

    // Iterate elements in reverse to select top-most
    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];

      // Check for resize handles first if an element is already selected
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
      if (clickedHandle) break; // Found a handle, no need to check element body

      // If no handle, check for element body
      if (hitTest(element, mouseX, mouseY)) {
        clickedElement = element;
        break;
      }
    }

    // Handle selection and drag/resize state
    if (clickedHandle) {
      onElementSelect(clickedElement.id);
      isResizingRef.current = true;
      resizeHandleNameRef.current = clickedHandle.name;
      // Store initial mouse position for resize calculations
      dragOffsetRef.current = { x: mouseX, y: mouseY };
      // Store initial properties of the element when resize starts
      selectedElementInitialPropsRef.current = { ...clickedElement };
    } else if (clickedElement) {
      onElementSelect(clickedElement.id);
      isDraggingRef.current = true;
      // Store offset from mouse to element's top-left/start for dragging
      let offsetX, offsetY;
      if (clickedElement.type === 'line') {
        offsetX = mouseX - clickedElement.startX;
        offsetY = mouseY - clickedElement.startY;
      } else {
        offsetX = mouseX - clickedElement.x;
        offsetY = mouseY - clickedElement.y;
      }
      dragOffsetRef.current = { x: offsetX, y: offsetY };
      // Store initial properties of the element when drag starts
      selectedElementInitialPropsRef.current = { ...clickedElement };
    } else {
      onElementSelect(null); // Clicked on empty space
      selectedElementInitialPropsRef.current = null;
    }
  };

  const handleMouseMove = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    currentMousePosRef.current = { x: mouseX, y: mouseY }; // Always update current mouse position

    // If currently drawing a new element
    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      drawElements(); // Re-draw canvas to show drawing preview
      return;
    }

    // Get the *current* element from diagramElements for up-to-date properties
    const currentSelectedElement = diagramElements.find(el => el.id === selectedElementId);

    // If currently resizing an element
    if (isResizingRef.current && currentSelectedElement && selectedElementInitialPropsRef.current) {
      const initialElement = selectedElementInitialPropsRef.current; // Use initial properties
      const handleName = resizeHandleNameRef.current;
      const initialMouseX = dragOffsetRef.current.x; // Initial mouse position
      const initialMouseY = dragOffsetRef.current.y;

      let newX = initialElement.x;
      let newY = initialElement.y;
      let newWidth = initialElement.width;
      let newHeight = initialElement.height;

      const dx = mouseX - initialMouseX; // Change in X from initial mouse position
      const dy = mouseY - initialMouseY; // Change in Y from initial mouse position

      // Calculate new dimensions and position based on handle
      switch (handleName) {
        case 'tl': // Top-Left
          newX = initialElement.x + dx;
          newY = initialElement.y + dy;
          newWidth = initialElement.width - dx;
          newHeight = initialElement.height - dy;
          break;
        case 'tm': // Top-Mid
          newY = initialElement.y + dy;
          newHeight = initialElement.height - dy;
          break;
        case 'tr': // Top-Right
          newWidth = initialElement.width + dx;
          newY = initialElement.y + dy;
          newHeight = initialElement.height - dy;
          break;
        case 'ml': // Mid-Left
          newX = initialElement.x + dx;
          newWidth = initialElement.width - dx;
          break;
        case 'mr': // Mid-Right
          newWidth = initialElement.width + dx;
          break;
        case 'bl': // Bottom-Left
          newX = initialElement.x + dx;
          newWidth = initialElement.width - dx;
          newHeight = initialElement.height + dy;
          break;
        case 'bm': // Bottom-Mid
          newHeight = initialElement.height + dy;
          break;
        case 'br': // Bottom-Right
          newWidth = initialElement.width + dx;
          newHeight = initialElement.height + dy;
          break;
        default:
          break;
      }

      // Ensure minimum size and positive dimensions
      newWidth = Math.max(newWidth, RESIZE_HANDLE_SIZE * 2);
      newHeight = Math.max(newHeight, RESIZE_HANDLE_SIZE * 2);

      const updatedProps = {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };
      onElementChange(currentSelectedElement.id, updatedProps);
      lastUpdatedElementPropsRef.current = updatedProps; // Store for commit on mouseUp

    } else if (isDraggingRef.current && currentSelectedElement && selectedElementInitialPropsRef.current) {
      // If currently dragging an element
      const initialElement = selectedElementInitialPropsRef.current; // Use initial properties
      let newElementProps = {};
      const offsetX = dragOffsetRef.current.x; // Offset from mouse to element's top-left/start
      const offsetY = dragOffsetRef.current.y;

      if (initialElement.type === 'line') {
        // Calculate new start/end based on initial position and mouse movement relative to offset
        const deltaX = mouseX - initialElement.startX - offsetX;
        const deltaY = mouseY - initialElement.startY - offsetY;

        newElementProps = {
          startX: initialElement.startX + deltaX,
          startY: initialElement.startY + deltaY,
          endX: initialElement.endX + deltaX,
          endY: initialElement.endY + deltaY,
        };
      } else {
        newElementProps = {
          x: mouseX - offsetX,
          y: mouseY - offsetY,
        };
      }
      onElementChange(currentSelectedElement.id, newElementProps);
      lastUpdatedElementPropsRef.current = newElementProps; // Store for commit on mouseUp
    }

    // Update cursor based on hover and active tool
    const canvas = ref.current; // Use the forwarded ref
    if (canvas) {
      let cursor = 'default';

      if (isDrawingRef.current) {
        cursor = 'crosshair'; // Drawing cursor
      } else if (isResizingRef.current) {
        // Ensure currentSelectedElement is valid here too
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
          cursor = 'grab'; // Indicate draggable
        }
      } else if (activeTool === TOOL_TYPE.TEXT) {
        cursor = 'text';
      } else {
        cursor = 'crosshair'; // For other drawing tools
      }
      canvas.style.cursor = cursor;
    }
  };

  const handleMouseUp = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    const { x: startX, y: startY } = startDrawingPointRef.current;

    // Finalize drawing a new shape/line
    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      let newElement = null;
      const width = Math.abs(mouseX - startX);
      const height = Math.abs(mouseY - startY);
      const x = Math.min(startX, mouseX);
      const y = Math.min(startY, mouseY);

      // Ensure minimum size for shapes
      if (width < 10 || height < 10) {
        isDrawingRef.current = false;
        return; // Don't create tiny elements
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
          newElement = { id: generateUniqueId(), type: TOOL_TYPE.LINE, startX, startY, endX: mouseX, endY: mouseY, label: '', ...DEFAULT_ELEMENT_STYLE };
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
      onElementChange(selectedElementId, lastUpdatedElementPropsRef.current, true); // Pass true to commit
    }

    // Reset all transient state variables and refs
    isDraggingRef.current = false;
    isResizingRef.current = false;
    isDrawingRef.current = false;
    resizeHandleNameRef.current = null;
    selectedElementInitialPropsRef.current = null; // Clear initial props
    dragOffsetRef.current = { x: 0, y: 0 };
    startDrawingPointRef.current = { x: 0, y: 0 };
    currentMousePosRef.current = { x: 0, y: 0 };
    lastUpdatedElementPropsRef.current = null; // Clear last updated props
  };

  // Double-click handler for text editing
  const handleDoubleClick = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    // Iterate elements in reverse to find the top-most text element or shape with label
    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];
      const textContent = element.type === 'text' ? element.text : element.label;

      if (textContent !== undefined && textContent !== null) { // Only consider elements that have text/label
        let textX = element.x;
        let textY = element.y;
        let fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;
        let textColor = element.color || DEFAULT_ELEMENT_STYLE.color;
        let estimatedWidth = textContent.length * (fontSize * 0.6) + 20; // Rough estimate + padding
        let estimatedHeight = fontSize * 1.2 + 20; // Rough estimate + padding

        if (element.type !== 'text') { // It's a shape with a label
          // Adjust position to center of shape for text editing overlay
          textX = element.x + element.width / 2 - estimatedWidth / 2;
          textY = element.y + element.height / 2 - estimatedHeight / 2;
        }

        // Create a temporary element object for hit testing the text content
        const tempTextElement = {
          ...element, // Carry over original element properties
          type: 'text', // Treat as text for hit test
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
            originalType: element.type // Keep original type to know if it's a shape's label
          });
          onElementSelect(element.id); // Select the element when its text is double-clicked
          return;
        }
      }
    }
    setTextInputProps(null); // Double-clicked on empty space or non-text part
  };

  // Handler for text input change (updates element in real-time)
  const handleTextInputChange = (e) => {
    const newText = e.target.value;
    setTextInputProps(prev => ({ ...prev, text: newText }));
    // Update the actual diagram element's label/text
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: newText } : { label: newText });
  };

  // Handler for text input blur (commits to history)
  const handleTextInputBlur = () => {
    // When blur, commit to history
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: textInputProps.text } : { label: textInputProps.text }, true);
    setTextInputProps(null); // Hide the input field
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={ref} // Attach the forwarded ref here
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Stop drawing/dragging if mouse leaves canvas
        onDoubleClick={handleDoubleClick} // Handle double-click for text editing
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
            lineHeight: `${textInputProps.fontSize * 1.2}px`, // Match line height
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: 20, // Ensure it's above canvas
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

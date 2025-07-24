// src/components/Canvas.js
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement, getResizeHandles } from '../utils/drawingUtils';
import { hitTest, isPointInHandle, isPointInTextElement } from '../utils/hitTestUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESIZE_HANDLE_SIZE } from '../utils/constants';

const Canvas = ({ diagramElements, selectedElementId, onElementSelect, onElementChange, onDoubleClickElement }) => {
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeHandleNameRef = useRef(null); // 'tl', 'br', etc.
  const selectedElementRef = useRef(null); // To store the actual selected element object during drag/resize

  // State for the temporary text input for direct editing
  const [textInputProps, setTextInputProps] = useState(null); // { id, x, y, width, height, text, fontSize, color }

  // Function to draw all elements on the canvas
  const drawElements = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

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
  }, [diagramElements, selectedElementId]);

  // Effect to draw when elements or selection changes
  useEffect(() => {
    drawElements();
  }, [drawElements]);

  // --- Mouse Event Handlers ---
  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
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
      selectedElementRef.current = clickedElement;
      isResizingRef.current = true;
      resizeHandleNameRef.current = clickedHandle.name;
      dragOffsetRef.current = { x: mouseX, y: mouseY }; // Store initial mouse pos for resize
    } else if (clickedElement) {
      onElementSelect(clickedElement.id);
      selectedElementRef.current = clickedElement;
      isDraggingRef.current = true;
      // Calculate offset for dragging
      let offsetX, offsetY;
      if (clickedElement.type === 'line') {
        offsetX = mouseX - clickedElement.startX;
        offsetY = mouseY - clickedElement.startY;
      } else {
        offsetX = mouseX - clickedElement.x;
        offsetY = mouseY - clickedElement.y;
      }
      dragOffsetRef.current = { x: offsetX, y: offsetY };
    } else {
      onElementSelect(null); // Clicked on empty space
      selectedElementRef.current = null;
    }

    // Hide text input if clicking anywhere else
    setTextInputProps(null);
  };

  const handleMouseMove = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    if (isResizingRef.current && selectedElementRef.current) {
      const element = selectedElementRef.current;
      const handleName = resizeHandleNameRef.current;
      const startX = dragOffsetRef.current.x;
      const startY = dragOffsetRef.current.y;

      let newX = element.x;
      let newY = element.y;
      let newWidth = element.width;
      let newHeight = element.height;

      const dx = mouseX - startX;
      const dy = mouseY - startY;

      switch (handleName) {
        case 'tl': // Top-Left
          newX = element.x + dx;
          newY = element.y + dy;
          newWidth = element.width - dx;
          newHeight = element.height - dy;
          break;
        case 'tm': // Top-Mid
          newY = element.y + dy;
          newHeight = element.height - dy;
          break;
        case 'tr': // Top-Right
          newWidth = element.width + dx;
          newY = element.y + dy;
          newHeight = element.height - dy;
          break;
        case 'ml': // Mid-Left
          newX = element.x + dx;
          newWidth = element.width - dx;
          break;
        case 'mr': // Mid-Right
          newWidth = element.width + dx;
          break;
        case 'bl': // Bottom-Left
          newX = element.x + dx;
          newWidth = element.width - dx;
          newHeight = element.height + dy;
          break;
        case 'bm': // Bottom-Mid
          newHeight = element.height + dy;
          break;
        case 'br': // Bottom-Right
          newWidth = element.width + dx;
          newHeight = element.height + dy;
          break;
        default:
          break;
      }

      // Ensure minimum size
      newWidth = Math.max(newWidth, 20);
      newHeight = Math.max(newHeight, 20);

      onElementChange(element.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });

      // Update dragOffsetRef for continuous resizing
      dragOffsetRef.current = { x: mouseX, y: mouseY };

    } else if (isDraggingRef.current && selectedElementRef.current) {
      const element = selectedElementRef.current;
      let newElementProps = {};

      if (element.type === 'line') {
        const deltaX = mouseX - (element.startX + dragOffsetRef.current.x);
        const deltaY = mouseY - (element.startY + dragOffsetRef.current.y);
        newElementProps = {
          startX: element.startX + deltaX,
          startY: element.startY + deltaY,
          endX: element.endX + deltaX,
          endY: element.endY + deltaY,
        };
      } else {
        newElementProps = {
          x: mouseX - dragOffsetRef.current.x,
          y: mouseY - dragOffsetRef.current.y,
        };
      }
      onElementChange(element.id, newElementProps);
    }

    // Update cursor based on hover
    const canvas = canvasRef.current;
    if (canvas) {
      let cursor = 'default';
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
      canvas.style.cursor = cursor;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    resizeHandleNameRef.current = null;
    selectedElementRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
  };

  const handleDoubleClick = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    // Iterate elements in reverse to find the top-most text element
    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];
      if (element.type === 'text' || element.label) { // Check if it's a text element or a shape with a label
        // For shapes with labels, we need to estimate the label's position
        let textX = element.x;
        let textY = element.y;
        let textWidth = element.width;
        let textHeight = element.height;
        let textContent = element.text || element.label;
        let fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;

        if (element.type !== 'text') { // It's a shape with a label
          // Estimate text position within the shape for hit testing
          // This is a simplification; ideally, measure text to get exact bounds
          textX = element.x + element.width / 2 - (textContent.length * fontSize * 0.3) ; // Rough center
          textY = element.y + element.height / 2 - (fontSize / 2);
          textWidth = textContent.length * fontSize * 0.6; // Rough width
          textHeight = fontSize;
        }

        // Create a temporary element object for hit testing the text content
        const tempTextElement = {
          ...element, // Carry over original element properties
          type: 'text', // Treat as text for hit test
          x: textX,
          y: textY,
          text: textContent,
          fontSize: fontSize
        };

        if (isPointInTextElement(mouseX, mouseY, tempTextElement)) {
          // Found a text element or a shape's label to edit
          setTextInputProps({
            id: element.id,
            x: textX,
            y: textY,
            width: textWidth, // Pass estimated width for textarea
            height: textHeight, // Pass estimated height for textarea
            text: textContent,
            fontSize: fontSize,
            color: element.color || DEFAULT_ELEMENT_STYLE.color,
            originalType: element.type // Keep original type to know if it's a shape's label
          });
          onElementSelect(element.id); // Select the element when its text is double-clicked
          return;
        }
      }
    }
    setTextInputProps(null); // Double-clicked on empty space or non-text part
  };

  const handleTextInputChange = (e) => {
    const newText = e.target.value;
    setTextInputProps(prev => ({ ...prev, text: newText }));
    // Update the actual diagram element's label/text
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: newText } : { label: newText });
  };

  const handleTextInputBlur = () => {
    setTextInputProps(null); // Hide the input field
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Stop dragging if mouse leaves canvas
        onDoubleClick={handleDoubleClick} // Handle double-click for text editing
        className="block bg-f8f8f8 border border-e0e0e0 rounded-lg shadow-md"
      ></canvas>

      {textInputProps && (
        <textarea
          className="absolute p-1 border border-blue-500 rounded-md resize-none overflow-hidden focus:outline-none"
          style={{
            left: textInputProps.x,
            top: textInputProps.y,
            width: textInputProps.width + 10, // Add some padding
            height: textInputProps.height + 10, // Add some padding
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
};

export default Canvas;
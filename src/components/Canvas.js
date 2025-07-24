// src/components/Canvas.js
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement, getResizeHandles } from '../utils/drawingUtils';
import { hitTest, isPointInHandle, isPointInTextElement } from '../utils/hitTestUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT, RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE, TOOL_TYPE, generateUniqueId } from '../utils/constants';

const Canvas = ({ diagramElements, selectedElementId, onElementSelect, onElementChange, onAddElement, activeTool }) => {
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const isDrawingRef = useRef(false);
  // dragOffsetRef will store initial mouse position for resize, or offset for drag
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeHandleNameRef = useRef(null);
  // selectedElementInitialPropsRef will store the element's properties AT THE START of drag/resize
  const selectedElementInitialPropsRef = useRef(null);
  const startDrawingPointRef = useRef({ x: 0, y: 0 });
  const currentMousePosRef = useRef({ x: 0, y: 0 });
  const lastUpdatedElementPropsRef = useRef(null); // Stores the props sent to onElementChange for commit on mouseUp

  const [textInputProps, setTextInputProps] = useState(null);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const drawElements = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
          drawLine(ctx, tempElement, false);
          break;
        case TOOL_TYPE.TEXT:
          break;
        default:
          break;
      }
    }
  }, [diagramElements, selectedElementId, activeTool]);

  useEffect(() => {
    drawElements();
  }, [drawElements]);

  const handleMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    currentMousePosRef.current = { x: mouseX, y: mouseY };
    lastUpdatedElementPropsRef.current = null; // Reset for new operation

    setTextInputProps(null);

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
            onElementSelect(element.id);
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

    if (activeTool !== TOOL_TYPE.SELECT) {
      isDrawingRef.current = true;
      startDrawingPointRef.current = { x: mouseX, y: mouseY };
      onElementSelect(null);
      return;
    }

    // --- SELECT Tool Logic ---
    let clickedElement = null;
    let clickedHandle = null;

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
      if (clickedHandle) break;

      // If no handle, check for element body
      if (hitTest(element, mouseX, mouseY)) {
        clickedElement = element;
        break;
      }
    }

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
    currentMousePosRef.current = { x: mouseX, y: mouseY };

    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      drawElements();
      return;
    }

    // FIX: Get the *current* element from diagramElements for up-to-date properties
    const currentSelectedElement = diagramElements.find(el => el.id === selectedElementId);

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

      newWidth = Math.max(newWidth, RESIZE_HANDLE_SIZE * 2);
      newHeight = Math.max(newHeight, RESIZE_HANDLE_SIZE * 2);

      const updatedProps = {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      };
      onElementChange(currentSelectedElement.id, updatedProps);
      lastUpdatedElementPropsRef.current = updatedProps;

      // dragOffsetRef should NOT be updated during resize, it holds the initial mouse position
      // dragOffsetRef.current = { x: mouseX, y: mouseY }; // REMOVED
    } else if (isDraggingRef.current && currentSelectedElement && selectedElementInitialPropsRef.current) {
      const initialElement = selectedElementInitialPropsRef.current; // Use initial properties
      let newElementProps = {};
      const offsetX = dragOffsetRef.current.x; // Offset from mouse to element's top-left/start
      const offsetY = dragOffsetRef.current.y;

      if (initialElement.type === 'line') {
        newElementProps = {
          startX: mouseX - offsetX,
          startY: mouseY - offsetY,
          endX: initialElement.endX + (mouseX - initialElement.startX - offsetX), // Calculate delta from initial
          endY: initialElement.endY + (mouseY - initialElement.startY - offsetY), // Calculate delta from initial
        };
      } else {
        newElementProps = {
          x: mouseX - offsetX,
          y: mouseY - offsetY,
        };
      }
      onElementChange(currentSelectedElement.id, newElementProps);
      lastUpdatedElementPropsRef.current = newElementProps;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      let cursor = 'default';

      if (isDrawingRef.current) {
        cursor = 'crosshair';
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

    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      let newElement = null;
      const width = Math.abs(mouseX - startX);
      const height = Math.abs(mouseY - startY);
      const x = Math.min(startX, mouseX);
      const y = Math.min(startY, mouseY);

      if (width < 10 || height < 10) {
        isDrawingRef.current = false;
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
          newElement = { id: generateUniqueId(), type: TOOL_TYPE.LINE, startX, startY, endX: mouseX, endY: mouseY, label: '', ...DEFAULT_ELEMENT_STYLE };
          break;
        default:
          break;
      }

      if (newElement) {
        onAddElement(newElement);
      }
    }

    if ((isDraggingRef.current || isResizingRef.current) && lastUpdatedElementPropsRef.current) {
      onElementChange(selectedElementId, lastUpdatedElementPropsRef.current, true);
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
    lastUpdatedElementPropsRef.current = null;
  };

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
          return;
        }
      }
    }
    setTextInputProps(null);
  };

  const handleTextInputChange = (e) => {
    const newText = e.target.value;
    setTextInputProps(prev => ({ ...prev, text: newText }));
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: newText } : { label: newText });
  };

  const handleTextInputBlur = () => {
    onElementChange(textInputProps.id, textInputProps.originalType === 'text' ? { text: textInputProps.text } : { label: textInputProps.text }, true);
    setTextInputProps(null);
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
};

export default Canvas;

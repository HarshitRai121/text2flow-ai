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
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeHandleNameRef = useRef(null);
  const selectedElementRef = useRef(null);
  const startDrawingPointRef = useRef({ x: 0, y: 0 });
  // --- NEW: Ref to store the current mouse position for drawing preview ---
  const currentMousePosRef = useRef({ x: 0, y: 0 });
  // --- END NEW ---

  const [textInputProps, setTextInputProps] = useState(null);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Function to draw all elements on the canvas
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

    // New: Draw preview of the new element being drawn
    if (isDrawingRef.current && startDrawingPointRef.current) {
      const { x: startX, y: startY } = startDrawingPointRef.current;
      // --- FIX: Use currentMousePosRef for drawing preview ---
      const { x: currentX, y: currentY } = currentMousePosRef.current;
      // --- END FIX ---

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

      // const ctx = canvas.getContext('2d'); // Already defined above, remove this line
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
          // No preview for text tool until double-click
          break;
        default:
          break;
      }
    }
  }, [diagramElements, selectedElementId, activeTool]); // No need to add currentMousePosRef.current to deps

  // Effect to draw when elements or selection changes
  useEffect(() => {
    drawElements();
  }, [drawElements]);

  // --- Mouse Event Handlers ---

  const handleMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    // --- Store current mouse position ---
    currentMousePosRef.current = { x: mouseX, y: mouseY };
    // --- END Store ---
    let clickedElement = null;
    let clickedHandle = null;

    // Hide text input if clicking anywhere else
    setTextInputProps(null);

    // If a drawing tool is active
    if (activeTool !== TOOL_TYPE.SELECT) {
      isDrawingRef.current = true;
      startDrawingPointRef.current = { x: mouseX, y: mouseY };
      onElementSelect(null); // Deselect any existing element when starting to draw
      if (activeTool === TOOL_TYPE.TEXT) {
        const newTextElement = {
          id: generateUniqueId(),
          type: TOOL_TYPE.TEXT,
          x: mouseX,
          y: mouseY,
          text: 'New Text',
          ...DEFAULT_ELEMENT_STYLE,
        };
        onAddElement(newTextElement);
        setTextInputProps({
          id: newTextElement.id,
          x: newTextElement.x,
          y: newTextElement.y,
          width: 100,
          height: newTextElement.fontSize || DEFAULT_ELEMENT_STYLE.fontSize,
          text: newTextElement.text,
          fontSize: newTextElement.fontSize || DEFAULT_ELEMENT_STYLE.fontSize,
          color: newTextElement.color || DEFAULT_ELEMENT_STYLE.color,
          originalType: TOOL_TYPE.TEXT
        });
        isDrawingRef.current = false;
        return;
      }
      return;
    }

    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];

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

      if (hitTest(element, mouseX, mouseY)) {
        clickedElement = element;
        break;
      }
    }

    if (clickedHandle) {
      onElementSelect(clickedElement.id);
      selectedElementRef.current = clickedElement;
      isResizingRef.current = true;
      resizeHandleNameRef.current = clickedHandle.name;
      dragOffsetRef.current = { x: mouseX, y: mouseY };
    } else if (clickedElement) {
      onElementSelect(clickedElement.id);
      selectedElementRef.current = clickedElement;
      isDraggingRef.current = true;
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
      onElementSelect(null);
      selectedElementRef.current = null;
    }
  };

  const handleMouseMove = (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);
    // --- FIX: Update current mouse position in the ref ---
    currentMousePosRef.current = { x: mouseX, y: mouseY };
    // --- END FIX ---

    if (isDrawingRef.current && activeTool !== TOOL_TYPE.SELECT && activeTool !== TOOL_TYPE.TEXT) {
      drawElements();
      return;
    }

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
        case 'tl':
          newX = element.x + dx;
          newY = element.y + dy;
          newWidth = element.width - dx;
          newHeight = element.height - dy;
          break;
        case 'tm':
          newY = element.y + dy;
          newHeight = element.height - dy;
          break;
        case 'tr':
          newWidth = element.width + dx;
          newY = element.y + dy;
          newHeight = element.height - dy;
          break;
        case 'ml':
          newX = element.x + dx;
          newWidth = element.width - dx;
          break;
        case 'mr':
          newWidth = element.width + dx;
          break;
        case 'bl':
          newX = element.x + dx;
          newWidth = element.width - dx;
          newHeight = element.height + dy;
          break;
        case 'bm':
          newHeight = element.height + dy;
          break;
        case 'br':
          newWidth = element.width + dx;
          newHeight = element.height + dy;
          break;
        default:
          break;
      }

      newWidth = Math.max(newWidth, RESIZE_HANDLE_SIZE * 2);
      newHeight = Math.max(newHeight, RESIZE_HANDLE_SIZE * 2);

      onElementChange(element.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });

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

    const canvas = canvasRef.current;
    if (canvas) {
      let cursor = 'default';

      if (isDrawingRef.current) {
        cursor = 'crosshair';
      } else if (isResizingRef.current) {
        cursor = resizeHandleNameRef.current ? getResizeHandles(selectedElementRef.current)[resizeHandleNameRef.current].cursor : 'default';
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

    if (isDraggingRef.current || isResizingRef.current) {
      onElementChange(selectedElementId, selectedElementRef.current, true);
    }

    isDraggingRef.current = false;
    isResizingRef.current = false;
    isDrawingRef.current = false;
    resizeHandleNameRef.current = null;
    selectedElementRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    startDrawingPointRef.current = { x: 0, y: 0 };
    // --- Clear current mouse position when mouse up ---
    currentMousePosRef.current = { x: 0, y: 0 };
    // --- END Clear ---
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
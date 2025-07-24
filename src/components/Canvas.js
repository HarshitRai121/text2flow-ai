// src/components/Canvas.js
import React, { useRef, useEffect, useCallback } from 'react';
import { drawRectangle, drawOval, drawDiamond, drawLine, drawTextElement } from '../utils/drawingUtils';
import { hitTest } from '../utils/hitTestUtils';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/constants';

const Canvas = ({ diagramElements, selectedElementId, onElementSelect, onElementMove }) => {
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const selectedElementRef = useRef(null); // To store the actual selected element object during drag

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

  // Mouse event handlers for selection and dragging
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Iterate elements in reverse to select top-most
    for (let i = diagramElements.length - 1; i >= 0; i--) {
      const element = diagramElements[i];
      if (hitTest(element, mouseX, mouseY)) {
        onElementSelect(element.id); // Notify parent about selection
        selectedElementRef.current = element; // Store reference to the actual element
        isDraggingRef.current = true;

        // Calculate offset for dragging
        let offsetX, offsetY;
        if (element.type === 'line') {
          // For lines, calculate offset relative to start point
          offsetX = mouseX - element.startX;
          offsetY = mouseY - element.startY;
        } else {
          // For shapes/text, calculate offset relative to top-left corner
          offsetX = mouseX - element.x;
          offsetY = mouseY - element.y;
        }
        dragOffsetRef.current = { x: offsetX, y: offsetY };
        return; // Stop after finding the first hit element
      }
    }
    onElementSelect(null); // No element clicked, deselect
    selectedElementRef.current = null;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !selectedElementRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

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
    // Notify parent to update the element's position
    onElementMove(element.id, newElementProps);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    selectedElementRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Stop dragging if mouse leaves canvas
      className="block w-full h-full" // Tailwind classes for responsiveness
    ></canvas>
  );
};

export default Canvas;
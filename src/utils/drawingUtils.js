// src/utils/drawingUtils.js
import { RESIZE_HANDLE_SIZE } from './constants';

// Base function to apply common styles and draw text
const applyStylesAndDrawText = (ctx, element, isSelected, centerX, centerY, textAlign = 'center', textBaseline = 'middle') => {
  ctx.fillStyle = element.fillColor || '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = isSelected ? '#3B82F6' : (element.strokeColor || '#000000'); // Blue for selected
  ctx.lineWidth = element.lineWidth || 2;
  ctx.stroke();

  // Draw label (text) for shapes
  if (element.label) {
    ctx.font = `${element.fontSize || 16}px Inter, sans-serif`;
    ctx.fillStyle = isSelected ? '#3B82F6' : (element.color || '#000000');
    ctx.textAlign = textAlign;
    ctx.textBaseline = textBaseline;
    ctx.fillText(element.label, centerX, centerY);
  }
};

// Helper to draw a resize handle
const drawHandle = (ctx, x, y) => {
  const size = RESIZE_HANDLE_SIZE;
  ctx.fillStyle = '#3B82F6'; // Blue handle
  ctx.strokeStyle = '#FFFFFF'; // White border
  ctx.lineWidth = 1;
  ctx.fillRect(x - size / 2, y - size / 2, size, size);
  ctx.strokeRect(x - size / 2, y - size / 2, size, size);
};

// Get resize handle positions for a shape
export const getResizeHandles = (element) => {
  const { x, y, width, height } = element;
  const hw = width / 2;
  const hh = height / 2;

  return {
    topLeft: { x: x, y: y, cursor: 'nwse-resize', name: 'tl' },
    topMid: { x: x + hw, y: y, cursor: 'ns-resize', name: 'tm' },
    topRight: { x: x + width, y: y, cursor: 'nesw-resize', name: 'tr' },
    midLeft: { x: x, y: y + hh, cursor: 'ew-resize', name: 'ml' },
    midRight: { x: x + width, y: y + hh, cursor: 'ew-resize', name: 'mr' },
    bottomLeft: { x: x, y: y + height, cursor: 'nesw-resize', name: 'bl' },
    bottomMid: { x: x + hw, y: y + height, cursor: 'ns-resize', name: 'bm' },
    bottomRight: { x: x + width, y: y + height, cursor: 'nwse-resize', name: 'br' },
  };
};

// Draw a rectangle element
export const drawRectangle = (ctx, element, isSelected) => {
  ctx.beginPath();
  ctx.rect(element.x, element.y, element.width, element.height);
  applyStylesAndDrawText(ctx, element, isSelected, element.x + element.width / 2, element.y + element.height / 2);

  if (isSelected) {
    const handles = getResizeHandles(element);
    Object.values(handles).forEach(handle => drawHandle(ctx, handle.x, handle.y));
  }
};

// Draw an oval element
export const drawOval = (ctx, element, isSelected) => {
  ctx.beginPath();
  ctx.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
  applyStylesAndDrawText(ctx, element, isSelected, element.x + element.width / 2, element.y + element.height / 2);

  if (isSelected) {
    const handles = getResizeHandles(element);
    Object.values(handles).forEach(handle => drawHandle(ctx, handle.x, handle.y));
  }
};

// Draw a diamond element
export const drawDiamond = (ctx, element, isSelected) => {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  ctx.beginPath();
  ctx.moveTo(centerX, element.y); // Top
  ctx.lineTo(element.x + element.width, centerY); // Right
  ctx.lineTo(centerX, element.y + element.height); // Bottom
  ctx.lineTo(element.x, centerY); // Left
  ctx.closePath();
  applyStylesAndDrawText(ctx, element, isSelected, centerX, centerY);

  if (isSelected) {
    const handles = getResizeHandles(element);
    Object.values(handles).forEach(handle => drawHandle(ctx, handle.x, handle.y));
  }
};

// Draw a line element (with optional arrowhead)
export const drawLine = (ctx, element, isSelected) => {
  ctx.beginPath();
  ctx.moveTo(element.startX, element.startY);
  ctx.lineTo(element.endX, element.endY);
  ctx.strokeStyle = isSelected ? '#3B82F6' : (element.strokeColor || '#000000');
  ctx.lineWidth = element.lineWidth || 2;
  ctx.stroke();

  // Draw arrowhead if specified
  if (element.arrowhead) {
    const angle = Math.atan2(element.endY - element.startY, element.endX - element.startX);
    const headLength = 15; // Length of the arrowhead sides
    const headWidth = 7; // Width of the arrowhead base

    ctx.save(); // Save current canvas state
    ctx.translate(element.endX, element.endY); // Move to the end of the line
    ctx.rotate(angle); // Rotate to align with the line
    ctx.beginPath();
    ctx.moveTo(0, 0); // Tip of the arrow
    ctx.lineTo(-headLength, headWidth); // Bottom point
    ctx.lineTo(-headLength, -headWidth); // Top point
    ctx.closePath();
    ctx.fillStyle = isSelected ? '#3B82F6' : (element.strokeColor || '#000000');
    ctx.fill();
    ctx.restore(); // Restore canvas state
  }

  // Draw label for line (if any)
  if (element.label) {
    const midX = (element.startX + element.endX) / 2;
    const midY = (element.startY + element.endY) / 2;
    ctx.font = `${element.fontSize || 12}px Inter, sans-serif`;
    ctx.fillStyle = isSelected ? '#3B82F6' : (element.color || '#000000');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; // Position above the line
    ctx.fillText(element.label, midX, midY - 5); // Offset slightly above the line
  }
};

// Draw a text element directly (not a label for a shape)
export const drawTextElement = (ctx, element, isSelected) => {
  ctx.font = `${element.fontSize || 16}px Inter, sans-serif`;
  ctx.fillStyle = isSelected ? '#3B82F6' : (element.color || '#000000');
  ctx.textAlign = element.align || 'left';
  ctx.textBaseline = element.baseline || 'top';
  ctx.fillText(element.text, element.x, element.y);
};

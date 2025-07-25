// src/utils/drawingUtils.js
import { RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE } from './constants';

// Helper to draw a rectangle
export const drawRectangle = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
  ctx.fillStyle = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;

  ctx.beginPath();
  ctx.roundRect(element.x, element.y, element.width, element.height, 8); // Rounded corners
  ctx.fill();
  ctx.stroke();

  // Draw label
  drawElementLabel(ctx, element);

  // Draw selection/resize handles if selected
  if (isSelected) {
    drawSelectionHandles(ctx, element);
  }
};

// Helper to draw an oval
export const drawOval = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
  ctx.fillStyle = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;

  ctx.beginPath();
  ctx.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw label
  drawElementLabel(ctx, element);

  // Draw selection/resize handles if selected
  if (isSelected) {
    drawSelectionHandles(ctx, element);
  }
};

// Helper to draw a diamond
export const drawDiamond = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
  ctx.fillStyle = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;

  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;

  ctx.beginPath();
  ctx.moveTo(centerX, element.y); // Top
  ctx.lineTo(element.x + element.width, centerY); // Right
  ctx.lineTo(centerX, element.y + element.height); // Bottom
  ctx.lineTo(element.x, centerY); // Left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Draw label
  drawElementLabel(ctx, element);

  // Draw selection/resize handles if selected
  if (isSelected) {
    drawSelectionHandles(ctx, element);
  }
};

// Helper to draw a line
export const drawLine = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
  ctx.lineCap = 'round'; // Make line caps round for better appearance

  ctx.beginPath();
  ctx.moveTo(element.startX, element.startY);
  ctx.lineTo(element.endX, element.endY);
  ctx.stroke();

  // Draw arrowhead if specified
  if (element.arrowhead) {
    drawArrowhead(ctx, element.startX, element.startY, element.endX, element.endY, element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor, element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth);
  }

  // Draw label for the line if it exists
  if (element.label) {
    const midX = (element.startX + element.endX) / 2;
    const midY = (element.startY + element.endY) / 2;
    const angle = Math.atan2(element.endY - element.startY, element.endX - element.startX);

    ctx.save();
    ctx.translate(midX, midY);
    ctx.rotate(angle);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
    ctx.fillStyle = element.color || DEFAULT_ELEMENT_STYLE.color;
    ctx.fillText(element.label, 0, -10); // Offset slightly above the line
    ctx.restore();
  }

  // Draw selection handles for lines (start and end points)
  if (isSelected) {
    ctx.fillStyle = '#3B82F6'; // Blue for line handles
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1;

    // Start handle
    ctx.beginPath();
    ctx.arc(element.startX, element.startY, RESIZE_HANDLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // End handle
    ctx.beginPath();
    ctx.arc(element.endX, element.endY, RESIZE_HANDLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
};

// Helper to draw a text element
export const drawTextElement = (ctx, element, isSelected) => {
  ctx.font = `${element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
  ctx.fillStyle = element.color || DEFAULT_ELEMENT_STYLE.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  // Basic text wrapping (can be improved)
  const words = element.text.split(' ');
  let line = '';
  const lineHeight = (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * 1.2;
  let y = element.y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    // If element has a defined width, try to wrap within it
    if (element.width && testWidth > element.width && n > 0) {
      ctx.fillText(line, element.x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, element.x, y);

  // Draw selection box for text if selected
  if (isSelected) {
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    // Estimate text box dimensions for selection
    const textMetrics = ctx.measureText(element.text);
    const estimatedWidth = textMetrics.width + 10; // Add some padding
    const estimatedHeight = lineHeight + 10; // Add some padding
    ctx.strokeRect(element.x, element.y, estimatedWidth, estimatedHeight);
    ctx.setLineDash([]);
  }
};

// Helper to draw element labels (for shapes)
const drawElementLabel = (ctx, element) => {
  if (element.label) {
    ctx.fillStyle = element.color || DEFAULT_ELEMENT_STYLE.color;
    ctx.font = `${element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = element.x + element.width / 2;
    const textY = element.y + element.height / 2;

    // Basic text wrapping for labels
    const words = element.label.split(' ');
    let line = '';
    const lineHeight = (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * 1.2;
    let currentY = textY - (words.length > 1 ? (words.length / 2) * lineHeight : 0); // Adjust start Y for multi-line centering

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      // If text exceeds element width or it's a new word on a new line
      if (element.width && testWidth > element.width - 10 && n > 0) { // -10 for padding
        ctx.fillText(line.trim(), textX, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), textX, currentY);
  }
};

// Helper to draw selection/resize handles for shapes
const drawSelectionHandles = (ctx, element) => {
  ctx.fillStyle = '#3B82F6'; // Blue handles
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 1;

  const handles = getResizeHandles(element);
  for (const handleName in handles) {
    const handle = handles[handleName];
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, RESIZE_HANDLE_SIZE, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
};

// Helper to draw an arrowhead
const drawArrowhead = (ctx, fromX, fromY, toX, toY, color, lineWidth) => {
  const headlen = 10; // length of head in pixels
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color; // Fill arrowhead with same color
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); // Close the path to fill the triangle
  ctx.fill(); // Fill the arrowhead
  ctx.restore();
};

// Helper to get resize handle coordinates
export const getResizeHandles = (element) => {
  const { x, y, width, height } = element;
  const halfHandle = RESIZE_HANDLE_SIZE / 2;

  return {
    tl: { x: x - halfHandle, y: y - halfHandle, name: 'tl', cursor: 'nwse-resize' },
    tm: { x: x + width / 2 - halfHandle, y: y - halfHandle, name: 'tm', cursor: 'ns-resize' },
    tr: { x: x + width - halfHandle, y: y - halfHandle, name: 'tr', cursor: 'nesw-resize' },
    ml: { x: x - halfHandle, y: y + height / 2 - halfHandle, name: 'ml', cursor: 'ew-resize' },
    mr: { x: x + width - halfHandle, y: y + height / 2 - halfHandle, name: 'mr', cursor: 'ew-resize' },
    bl: { x: x - halfHandle, y: y + height - halfHandle, name: 'bl', cursor: 'nesw-resize' },
    bm: { x: x + width / 2 - halfHandle, y: y + height - halfHandle, name: 'bm', cursor: 'ns-resize' },
    br: { x: x + width - halfHandle, y: y + height - halfHandle, name: 'br', cursor: 'nwse-resize' },
  };
};

// Helper to draw a connection indicator (e.g., a circle)
export const drawConnectionIndicator = (ctx, x, y, radius = 8, color = '#3B82F6') => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; // White border
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
};

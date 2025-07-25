// src/utils/hitTestUtils.js
import { RESIZE_HANDLE_SIZE } from './constants';

// Basic hit test for rectangular bounds (used by rectangle, oval, diamond for initial click)
export const hitTest = (element, x, y) => {
  if (element.type === 'line') {
    // For lines, check if the point is close to the line segment
    const dist = distToSegment(x, y, element.startX, element.startY, element.endX, element.endY);
    return dist < 5; // A small tolerance for clicking on a line
  } else if (element.type === 'text') {
    // For text, estimate bounding box based on content and font size
    // This is a rough estimate; for precise hit testing, text metrics are needed.
    const estimatedWidth = (element.text || '').length * (element.fontSize || 16) * 0.6; // Avg char width
    const estimatedHeight = (element.fontSize || 16) * 1.2; // Line height
    return x >= element.x && x <= element.x + estimatedWidth &&
           y >= element.y && y <= element.y + estimatedHeight;
  } else {
    // For shapes (rectangle, oval, diamond)
    return x >= element.x && x <= element.x + element.width &&
           y >= element.y && y <= element.y + element.height;
  }
};

// Helper for line hit testing (distance from point to segment)
const distToSegment = (px, py, x1, y1, x2, y2) => {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1)); // Line is a point

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1]

  const nearestX = x1 + t * (x2 - x1);
  const nearestY = y1 + t * (y2 - y1);

  return Math.sqrt((px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY));
};


// Hit test for resize handles
export const isPointInHandle = (x, y, handle) => {
  const halfSize = RESIZE_HANDLE_SIZE / 2;
  return x >= handle.x - halfSize && x <= handle.x + halfSize &&
         y >= handle.y - halfSize && y <= handle.y + halfSize;
};

// Hit test for text input area (more precise for text elements)
export const isPointInTextElement = (x, y, element) => {
  if (element.type !== 'text' && element.label === undefined) return false; // Only for actual text elements or shapes with labels

  const ctx = document.createElement('canvas').getContext('2d'); // Create a dummy context
  ctx.font = `${element.fontSize || 16}px Inter, sans-serif`;

  const textContent = element.type === 'text' ? element.text : element.label;
  if (!textContent) return false;

  const textMetrics = ctx.measureText(textContent);
  const estimatedWidth = textMetrics.width;
  const lineHeight = (element.fontSize || 16) * 1.2;

  let actualX = element.x;
  let actualY = element.y;

  // If it's a shape with a label, adjust hit test area to label's approximate position
  if (element.type !== 'text') {
    actualX = element.x + element.width / 2 - estimatedWidth / 2;
    actualY = element.y + element.height / 2 - lineHeight / 2;
  }

  // Add some padding to the hit area
  const padding = 5;
  return x >= actualX - padding && x <= actualX + estimatedWidth + padding &&
         y >= actualY - padding && y <= actualY + lineHeight + padding;
};

// New: Check if a point is near a shape's boundary for connection
export const isPointNearShapeBoundary = (pointX, pointY, shape, tolerance = 15) => {
  if (shape.type === 'line' || shape.type === 'text') return false; // Only shapes can be connected to

  const { x, y, width, height } = shape;
  
  // Get the center of the shape
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Calculate distance from point to center
  const distToCenter = Math.sqrt(Math.pow(pointX - centerX, 2) + Math.pow(pointY - centerY, 2));

  // A rough way to check if near boundary for rectangle/oval/diamond
  // This is a simplification. For true boundary hit, you'd need more complex geometry.
  // For now, we check if the point is within the shape's bounding box plus tolerance
  // AND not too close to the center.
  const isWithinBoundsPlusTolerance = 
    pointX >= x - tolerance && pointX <= x + width + tolerance &&
    pointY >= y - tolerance && pointY <= y + height + tolerance;

  // And also check if it's not too deep inside the shape
  const isOutsideInnerTolerance = 
    pointX <= x + tolerance || pointX >= x + width - tolerance ||
    pointY <= y + tolerance || pointY >= y + height - tolerance;

  // For ovals and diamonds, it's more about distance from center relative to axes
  if (shape.type === 'oval') {
    const dx = pointX - centerX;
    const dy = pointY - centerY;
    // Normalized distance from center (should be close to 1 for points on ellipse boundary)
    const normalizedDist = (dx * dx) / ((width / 2) * (width / 2)) + (dy * dy) / ((height / 2) * (height / 2));
    return isWithinBoundsPlusTolerance && (normalizedDist > 0.8 && normalizedDist < 1.5); // Near 1 but with tolerance
  } else if (shape.type === 'diamond') {
    // For diamond, check if point is near one of the four lines
    // This is a simplified check. A more robust solution would involve line-point distance.
    // For now, rely on bounding box + tolerance and not too close to center.
    return isWithinBoundsPlusTolerance && (distToCenter > Math.min(width, height) / 4);
  }

  return isWithinBoundsPlusTolerance && isOutsideInnerTolerance; // For rectangles
};

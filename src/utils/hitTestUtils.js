// src/utils/hitTestUtils.js
import { RESIZE_HANDLE_SIZE, TOOL_TYPE, DEFAULT_ELEMENT_STYLE } from './constants'; // Import DEFAULT_ELEMENT_STYLE

// Helper to check if a point is inside a rectangle
const isPointInRect = (x, y, rectX, rectY, rectWidth, rectHeight) => {
  return x >= rectX && x <= rectX + rectWidth &&
         y >= rectY && y <= rectY + rectHeight;
};

// Helper to check if a point is inside an oval (ellipse)
const isPointInOval = (x, y, oval) => {
  const centerX = oval.x + oval.width / 2;
  const centerY = oval.y + oval.height / 2;
  const rx = oval.width / 2;
  const ry = oval.height / 2;
  return ((x - centerX) * (x - centerX)) / (rx * rx) + ((y - centerY) * (y - centerY)) / (ry * ry) <= 1;
};

// Helper to check if a point is inside a diamond (rhombus)
const isPointInDiamond = (x, y, diamond) => {
  const centerX = diamond.x + diamond.width / 2;
  const centerY = diamond.y + diamond.height / 2;
  const dx = Math.abs(x - centerX);
  const dy = Math.abs(y - centerY);
  return (dx / (diamond.width / 2) + dy / (diamond.height / 2)) <= 1;
};

// Helper to check if a point is near a line (for selection)
const isPointNearLine = (x, y, line, tolerance = 5) => {
  const dist = distToSegment(x, y, line.startX, line.startY, line.endX, line.endY);
  return dist <= tolerance;
};

// Helper function to calculate distance from a point to a line segment
// (x, y) is the point, (x1, y1) and (x2, y2) are the line segment endpoints
const distToSegment = (px, py, x1, y1, x2, y2) => {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1)); // Line is a point

  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1]

  const projectionX = x1 + t * (x2 - x1);
  const projectionY = y1 + t * (y2 - y1);

  return Math.sqrt((px - projectionX) * (px - projectionX) + (py - projectionY) * (py - projectionY));
};

// Main hit test function for elements
export const hitTest = (element, x, y) => {
  switch (element.type) {
    case TOOL_TYPE.RECTANGLE:
      return isPointInRect(x, y, element.x, element.y, element.width, element.height);
    case TOOL_TYPE.OVAL:
      return isPointInOval(x, y, element);
    case TOOL_TYPE.DIAMOND:
      return isPointInDiamond(x, y, element);
    case TOOL_TYPE.LINE:
      return isPointNearLine(x, y, element);
    case TOOL_TYPE.TEXT:
      // For text elements, hit test their bounding box
      // This is an approximation; a more accurate hit test would involve text metrics
      // We'll use a generous bounding box for now
      const dummyCanvas = document.createElement('canvas');
      const dummyCtx = dummyCanvas.getContext('2d');
      dummyCtx.font = `${element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
      const metrics = dummyCtx.measureText(element.text);
      const textWidth = metrics.width;
      const textHeight = (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * element.text.split('\n').length * 1.2; // Approximate height
      return isPointInRect(x, y, element.x, element.y, textWidth, textHeight);
    default:
      return false;
  }
};

// Helper to check if a point is within a resize handle
export const isPointInHandle = (x, y, handle, scale = 1) => { // Added scale parameter
  // Adjust the effective size of the handle for hit testing based on scale
  // This makes handles easier to click when zoomed out, and prevents them from becoming too large when zoomed in
  const scaledHandleSize = RESIZE_HANDLE_SIZE / scale;
  // Calculate the top-left corner of the scaled handle, centered around the original handle's center
  const scaledHandleX = handle.x + (RESIZE_HANDLE_SIZE / 2 - scaledHandleSize / 2);
  const scaledHandleY = handle.y + (RESIZE_HANDLE_SIZE / 2 - scaledHandleSize / 2);

  return x >= scaledHandleX && x <= scaledHandleX + scaledHandleSize &&
         y >= scaledHandleY && y <= scaledHandleY + scaledHandleSize;
};

// Helper to check if a point is near a shape's boundary (for line connection)
export const isPointNearShapeBoundary = (x, y, shape, tolerance = 10) => {
  // Check if point is within a slightly expanded bounding box of the shape
  return isPointInRect(x, y, shape.x - tolerance, shape.y - tolerance, shape.width + 2 * tolerance, shape.height + 2 * tolerance);
};

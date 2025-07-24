// src/utils/hitTestUtils.js
import { RESIZE_HANDLE_SIZE } from './constants';
import { getResizeHandles } from './drawingUtils'; // Import getResizeHandles

// Check if a point is inside a rectangle
const isPointInRectangle = (pointX, pointY, element) => {
  return pointX >= element.x && pointX <= element.x + element.width &&
         pointY >= element.y && pointY <= element.y + element.height;
};

// Check if a point is inside an oval
const isPointInOval = (pointX, pointY, element) => {
  const rx = element.width / 2;
  const ry = element.height / 2;
  const cx = element.x + rx;
  const cy = element.y + ry;
  // Ellipse equation: ((x-cx)^2 / rx^2) + ((y-cy)^2 / ry^2) <= 1
  return ((pointX - cx) * (pointX - cx)) / (rx * rx) + ((pointY - cy) * (pointY - cy)) / (ry * ry) <= 1;
};

// Check if a point is inside a diamond
const isPointInDiamond = (pointX, pointY, element) => {
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  // Diamond equation (sum of absolute normalized distances from center <= 1)
  return (
    Math.abs((pointX - centerX) / (element.width / 2)) +
    Math.abs((pointY - centerY) / (element.height / 2)) <= 1
  );
};

// Check if a point is on a line (within a tolerance)
const isPointOnLine = (pointX, pointY, element, tolerance = 5) => {
  const dist = (x1, y1, x2, y2) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const d1 = dist(pointX, pointY, element.startX, element.startY);
  const d2 = dist(pointX, pointY, element.endX, element.endY);
  const lineLength = dist(element.startX, element.startY, element.endX, element.endY);
  // Check if the sum of distances from the point to the line's endpoints is approximately equal to the line's length
  return d1 + d2 >= lineLength - tolerance && d1 + d2 <= lineLength + tolerance;
};

// Check if a point is within a text element's bounding box
export const isPointInTextElement = (pointX, pointY, element) => {
  // For accurate text hit testing, you'd ideally measure text width using ctx.measureText().
  // For now, we'll use a simplified approach based on font size and assumed average character width.
  const assumedCharWidth = (element.fontSize || 16) * 0.6;
  const assumedTextWidth = (element.text ? element.text.length : 10) * assumedCharWidth; // Estimate width
  const textHeight = (element.fontSize || 16);

  // Adjust x based on textAlign for accurate bounding box
  let effectiveX = element.x;
  if (element.textAlign === 'center') {
    effectiveX = element.x - assumedTextWidth / 2;
  } else if (element.textAlign === 'right') {
    effectiveX = element.x - assumedTextWidth;
  }

  // Adjust y based on textBaseline for accurate bounding box
  let effectiveY = element.y;
  if (element.textBaseline === 'middle') {
    effectiveY = element.y - textHeight / 2;
  } else if (element.textBaseline === 'bottom') {
    effectiveY = element.y - textHeight;
  }

  return pointX >= effectiveX && pointX <= effectiveX + assumedTextWidth &&
         pointY >= effectiveY && pointY <= effectiveY + textHeight;
};

// Check if a point is inside a resize handle
export const isPointInHandle = (pointX, pointY, handle) => {
  const size = RESIZE_HANDLE_SIZE;
  return pointX >= handle.x - size / 2 && pointX <= handle.x + size / 2 &&
         pointY >= handle.y - size / 2 && pointY <= handle.y + size / 2;
};

// Main hit test function to determine which element or handle was clicked
export const hitTest = (element, mouseX, mouseY) => {
  switch (element.type) {
    case 'rectangle':
    case 'oval':
    case 'diamond':
      return isPointInRectangle(mouseX, mouseY, element); // For shapes, check the main body
    case 'line':
      return isPointOnLine(mouseX, mouseY, element);
    case 'text':
      return isPointInTextElement(mouseX, mouseY, element);
    default:
      return false;
  }
};


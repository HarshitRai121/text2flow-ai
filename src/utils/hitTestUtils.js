// src/utils/hitTestUtils.js

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
const isPointInText = (pointX, pointY, element) => {
  // This is a simplified bounding box. For accurate text hit testing,
  // you'd need to measure text width using ctx.measureText().
  // For now, assume a reasonable width based on font size.
  const assumedCharWidth = (element.fontSize || 16) * 0.6; // Approx char width
  const assumedTextWidth = (element.text ? element.text.length : 10) * assumedCharWidth;
  const textHeight = (element.fontSize || 16);

  let actualX = element.x;
  let actualY = element.y;

  // Adjust for textAlign and textBaseline if needed for accurate bounding box
  // For simplicity, we'll just use top-left as anchor for now.

  return pointX >= actualX && pointX <= actualX + assumedTextWidth &&
         pointY >= actualY && pointY <= actualY + textHeight;
};


// Main hit test function to determine which element was clicked
export const hitTest = (element, mouseX, mouseY) => {
  switch (element.type) {
    case 'rectangle':
      return isPointInRectangle(mouseX, mouseY, element);
    case 'oval':
      return isPointInOval(mouseX, mouseY, element);
    case 'diamond':
      return isPointInDiamond(mouseX, mouseY, element);
    case 'line':
      return isPointOnLine(mouseX, mouseY, element);
    case 'text':
      return isPointInText(mouseX, mouseY, element);
    default:
      return false;
  }
};

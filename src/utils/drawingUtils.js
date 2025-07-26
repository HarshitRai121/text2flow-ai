// src/utils/drawingUtils.js
import { RESIZE_HANDLE_SIZE, DEFAULT_ELEMENT_STYLE } from './constants'; // Import DEFAULT_ELEMENT_STYLE

// Helper to draw a rectangle
export const drawRectangle = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.fillStyle = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;

  ctx.fillRect(element.x, element.y, element.width, element.height);
  ctx.strokeRect(element.x, element.y, element.width, element.height);

  if (element.label) {
    drawText(ctx, element.label, element.x + element.width / 2, element.y + element.height / 2, element.fontSize, element.color, element.width);
  }

  if (isSelected) {
    drawSelectionOutline(ctx, element);
    drawResizeHandles(ctx, element);
  }
};

// Helper to draw an oval
export const drawOval = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.fillStyle = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;

  ctx.beginPath();
  ctx.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width / 2, element.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (element.label) {
    drawText(ctx, element.label, element.x + element.width / 2, element.y + element.height / 2, element.fontSize, element.color, element.width);
  }

  if (isSelected) {
    drawSelectionOutline(ctx, element);
    drawResizeHandles(ctx, element);
  }
};

// Helper to draw a diamond (rhombus)
export const drawDiamond = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.fillStyle = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;

  ctx.beginPath();
  ctx.moveTo(element.x + element.width / 2, element.y); // Top
  ctx.lineTo(element.x + element.width, element.y + element.height / 2); // Right
  ctx.lineTo(element.x + element.width / 2, element.y + element.height); // Bottom
  ctx.lineTo(element.x, element.y + element.height / 2); // Left
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (element.label) {
    drawText(ctx, element.label, element.x + element.width / 2, element.y + element.height / 2, element.fontSize, element.color, element.width);
  }

  if (isSelected) {
    drawSelectionOutline(ctx, element);
    drawResizeHandles(ctx, element);
  }
};

// Helper to draw a line
export const drawLine = (ctx, element, isSelected) => {
  ctx.strokeStyle = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
  ctx.lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(element.startX, element.startY);
  ctx.lineTo(element.endX, element.endY);
  ctx.stroke();

  if (element.arrowhead) {
    drawArrowhead(ctx, element.startX, element.startY, element.endX, element.endY, element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor);
  }

  if (element.label) {
    // Position label in the middle of the line
    const midX = (element.startX + element.endX) / 2;
    const midY = (element.startY + element.endY) / 2;
    drawText(ctx, element.label, midX, midY, element.fontSize, element.color);
  }

  if (isSelected) {
    drawSelectionOutline(ctx, element);
  }
};

// Helper to draw a text element
export const drawTextElement = (ctx, element, isSelected) => {
  ctx.fillStyle = element.color || DEFAULT_ELEMENT_STYLE.color;
  ctx.font = `${element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const textLines = element.text.split('\n');
  let yOffset = 0;
  for (const line of textLines) {
    ctx.fillText(line, element.x, element.y + yOffset);
    yOffset += (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * 1.2; // Line height
  }

  if (isSelected) {
    // For text, draw a simple bounding box as selection outline
    const metrics = ctx.measureText(element.text);
    const textWidth = metrics.width;
    const textHeight = (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * textLines.length * 1.2; // Approximate height
    drawSelectionOutline(ctx, { x: element.x, y: element.y, width: textWidth, height: textHeight });
  }
};


// Generic text drawing helper for shapes and lines
const drawText = (ctx, text, x, y, fontSize = DEFAULT_ELEMENT_STYLE.fontSize, color = DEFAULT_ELEMENT_STYLE.color, maxWidth = null) => {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapText(ctx, text, maxWidth || Infinity); // Use maxWidth for wrapping
  let currentY = y - (lines.length - 1) * (fontSize * 0.6); // Adjust start Y for multi-line centering

  lines.forEach(line => {
    ctx.fillText(line, x, currentY);
    currentY += fontSize * 1.2; // Line height
  });
};

// Text wrapping utility
const wrapText = (ctx, text, maxWidth) => {
  if (!maxWidth || maxWidth === Infinity) {
    return [text];
  }

  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};


// Helper to draw an arrowhead for lines
const drawArrowhead = (ctx, fromX, fromY, toX, toY, color) => {
  const headlen = 10; // length of head in pixels
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.fillStyle = color; // Fill arrowhead with stroke color
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
};

// Helper to draw the selection outline
const drawSelectionOutline = (ctx, element) => {
  ctx.save();
  ctx.strokeStyle = '#3B82F6'; // Blue for selection
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]); // Dashed line

  if (element.type === 'line') {
    // For lines, draw a dashed line along the line itself
    ctx.beginPath();
    ctx.moveTo(element.startX, element.startY);
    ctx.lineTo(element.endX, element.endY);
    ctx.stroke();
  } else if (element.type === 'text') {
    // For text, draw a dashed rectangle around its approximate bounds
    const metrics = ctx.measureText(element.text);
    const textWidth = metrics.width;
    const textHeight = (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * element.text.split('\n').length * 1.2;
    ctx.strokeRect(element.x, element.y, textWidth, textHeight);
  }
  else {
    // For shapes, draw a dashed rectangle around their bounds
    ctx.strokeRect(element.x, element.y, element.width, element.height);
  }

  ctx.restore();
};

// Helper to draw resize handles
export const drawResizeHandles = (ctx, element) => {
  ctx.fillStyle = '#3B82F6'; // Blue handles
  ctx.strokeStyle = '#FFFFFF'; // White border
  ctx.lineWidth = 1;

  const handles = getResizeHandles(element);
  for (const handleName in handles) {
    const handle = handles[handleName];
    ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
    ctx.strokeRect(handle.x, handle.y, handle.width, handle.height);
  }
};

// Helper to get resize handle coordinates
export const getResizeHandles = (element) => {
  const h = RESIZE_HANDLE_SIZE / 2; // Half handle size for centering
  return {
    tl: { x: element.x - h, y: element.y - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'tl', cursor: 'nwse-resize' },
    tm: { x: element.x + element.width / 2 - h, y: element.y - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'tm', cursor: 'ns-resize' },
    tr: { x: element.x + element.width - h, y: element.y - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'tr', cursor: 'nesw-resize' },
    ml: { x: element.x - h, y: element.y + element.height / 2 - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'ml', cursor: 'ew-resize' },
    mr: { x: element.x + element.width - h, y: element.y + element.height / 2 - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'mr', cursor: 'ew-resize' },
    bl: { x: element.x - h, y: element.y + element.height - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'bl', cursor: 'nesw-resize' },
    bm: { x: element.x + element.width / 2 - h, y: element.y + element.height - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'bm', cursor: 'ns-resize' },
    br: { x: element.x + element.width - h, y: element.y + element.height - h, width: RESIZE_HANDLE_SIZE, height: RESIZE_HANDLE_SIZE, name: 'br', cursor: 'nwse-resize' },
  };
};

// Helper to check if a point is within a text element's bounding box
export const isPointInTextElement = (x, y, element) => {
  // This requires a dummy canvas context to measure text accurately
  const dummyCanvas = document.createElement('canvas');
  const dummyCtx = dummyCanvas.getContext('2d');
  dummyCtx.font = `${element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize}px Inter, sans-serif`;

  const textLines = element.text.split('\n');
  let totalTextHeight = 0;
  let maxWidth = 0;

  for (const line of textLines) {
    const metrics = dummyCtx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
    totalTextHeight += (element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * 1.2;
  }

  // Add some padding to the hit area for easier clicking
  const padding = 5;
  const hitX = element.x - padding;
  const hitY = element.y - padding;
  const hitWidth = maxWidth + 2 * padding;
  const hitHeight = totalTextHeight + 2 * padding;

  return x >= hitX && x <= hitX + hitWidth &&
         y >= hitY && y <= hitY + hitHeight;
};


// Helper to draw connection indicator (small circle)
export const drawConnectionIndicator = (ctx, x, y) => {
  ctx.save();
  ctx.fillStyle = '#3B82F6'; // Blue
  ctx.strokeStyle = '#FFFFFF'; // White border
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2); // Small circle
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

// Helper to get connection point on a shape's boundary
// This function is robust and considers the target point to find the closest edge
export const getShapeConnectionPoint = (shape, targetX, targetY) => {
  const shapeCenterX = shape.x + shape.width / 2;
  const shapeCenterY = shape.y + shape.height / 2;

  // Vector from shape center to target point
  const dx = targetX - shapeCenterX;
  const dy = targetY - shapeCenterY;

  // Angle from shape center to target point
  const angle = Math.atan2(dy, dx);

  let connectX, connectY;

  switch (shape.type) {
    case 'rectangle':
      // Intersection of line from center to target with rectangle boundary
      // This is a simplified approach, a more accurate one would involve line-segment intersection
      // For now, we'll use a basic angle-based approach that works reasonably well
      if (Math.abs(dx) > Math.abs(dy)) { // Intersecting left/right edge
        connectX = dx > 0 ? shape.x + shape.width : shape.x;
        connectY = shapeCenterY + dy * (shape.width / 2) / Math.abs(dx);
      } else { // Intersecting top/bottom edge
        connectY = dy > 0 ? shape.y + shape.height : shape.y;
        connectX = shapeCenterX + dx * (shape.height / 2) / Math.abs(dy);
      }
      break;
    case 'oval':
      // Intersection of line from center to target with ellipse boundary
      const rx = shape.width / 2;
      const ry = shape.height / 2;
      const tanAngle = Math.tan(angle);
      const xSign = Math.cos(angle) > 0 ? 1 : -1;
      const ySign = Math.sin(angle) > 0 ? 1 : -1;

      // Formula for ellipse intersection
      connectX = shapeCenterX + xSign * rx * ry / Math.sqrt(ry * ry + rx * rx * tanAngle * tanAngle);
      connectY = shapeCenterY + ySign * rx * ry * tanAngle / Math.sqrt(ry * ry + rx * rx * tanAngle * tanAngle);
      break;
    case 'diamond':
      // Intersection of line from center to target with diamond boundary
      // This is more complex, approximating with a square for simplicity
      // A more accurate approach would involve checking intersection with each of the 4 lines
      const halfWidth = shape.width / 2;
      const halfHeight = shape.height / 2;

      const slope = dy / dx;

      if (Math.abs(slope) <= halfHeight / halfWidth) { // Intersects left or right segment
        connectX = dx > 0 ? shape.x + shape.width : shape.x;
        connectY = shapeCenterY + slope * (connectX - shapeCenterX);
      } else { // Intersects top or bottom segment
        connectY = dy > 0 ? shape.y + shape.height : shape.y;
        connectX = shapeCenterX + (connectY - shapeCenterY) / slope;
      }
      break;
    default:
      // Fallback for unknown shape types or text, connect to center
      connectX = shapeCenterX;
      connectY = shapeCenterY;
      break;
  }
  return { x: connectX, y: connectY };
};

// src/utils/constants.js

export const generateUniqueId = () => crypto.randomUUID();

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

export const RESIZE_HANDLE_SIZE = 8;

// Default styling for new elements (can be overridden by AI or properties panel)
export const DEFAULT_ELEMENT_STYLE = {
  strokeColor: '#000000',
  fillColor: '#FFFFFF',
  lineWidth: 2,
  fontSize: 16,
  color: '#000000', // Text color
  arrowhead: true, // Default for lines
};

// --- New: Tool Types ---
export const TOOL_TYPE = {
  SELECT: 'select',
  RECTANGLE: 'rectangle',
  OVAL: 'oval',
  DIAMOND: 'diamond',
  LINE: 'line',
  TEXT: 'text',
  // Add more tools here later (e.g., pen, erase)
};

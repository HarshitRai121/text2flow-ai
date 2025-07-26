// src/utils/constants.js

// Define a larger virtual canvas size for internal calculations
// This allows for more complex diagrams without immediately going "off-canvas"
export const CANVAS_WIDTH = 2000; // Increased virtual width
export const CANVAS_HEIGHT = 1500; // Increased virtual height

export const RESIZE_HANDLE_SIZE = 8; // Size of the resize handles

export const DEFAULT_ELEMENT_STYLE = {
  strokeColor: '#000000',
  fillColor: '#FFFFFF',
  lineWidth: 2,
  fontSize: 16,
  color: '#000000', // Text color
};

export const TOOL_TYPE = {
  SELECT: 'select',
  RECTANGLE: 'rectangle',
  OVAL: 'oval',
  DIAMOND: 'diamond',
  LINE: 'line',
  TEXT: 'text',
};

// Helper to generate unique IDs
export const generateUniqueId = () => {
  return 'id_' + Math.random().toString(36).substr(2, 9) + Date.now();
};
// src/utils/constants.js

// Function to generate a unique ID for diagram elements
export const generateUniqueId = () => crypto.randomUUID();

// Canvas dimensions
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

// Default styling for new elements (can be overridden by AI or properties panel)
export const DEFAULT_ELEMENT_STYLE = {
  strokeColor: '#000000',
  fillColor: '#FFFFFF',
  lineWidth: 2,
  fontSize: 16,
  color: '#000000', // Text color
  arrowhead: true, // Default for lines
};

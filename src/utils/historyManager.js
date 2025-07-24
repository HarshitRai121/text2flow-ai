// src/utils/historyManager.js

let historyStack = [[]]; // Start with an empty diagram state
let historyPointer = 0;

// Pushes a new state onto the history stack
export const pushState = (newState) => {
  // If we've undone, clear any 'redo' states
  if (historyPointer < historyStack.length - 1) {
    historyStack = historyStack.slice(0, historyPointer + 1);
  }
  historyStack.push(newState);
  historyPointer = historyStack.length - 1;
  // console.log('State pushed. History length:', historyStack.length, 'Pointer:', historyPointer);
};

// Gets the current state
export const getCurrentState = () => {
  return historyStack[historyPointer];
};

// Undoes the last action
export const undo = () => {
  if (historyPointer > 0) {
    historyPointer--;
    // console.log('Undo. History length:', historyStack.length, 'Pointer:', historyPointer);
    return historyStack[historyPointer];
  }
  return null; // Cannot undo further
};

// Redoes the last undone action
export const redo = () => {
  if (historyPointer < historyStack.length - 1) {
    historyPointer++;
    // console.log('Redo. History length:', historyStack.length, 'Pointer:', historyPointer);
    return historyStack[historyPointer];
  }
  return null; // Cannot redo further
};

// Clears the history (e.g., when loading a new diagram)
export const clearHistory = () => {
  historyStack = [[]];
  historyPointer = 0;
  // console.log('History cleared.');
};

// Check if undo is possible
export const canUndo = () => historyPointer > 0;

// Check if redo is possible
export const canRedo = () => historyPointer < historyStack.length - 1;
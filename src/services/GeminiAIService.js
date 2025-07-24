// src/services/GeminiAIService.js
import { generateUniqueId } from '../utils/constants'; // Import from constants

export const GeminiAIService = {
  async generateDiagramFromPrompt(promptText) {
    console.log("Mock Gemini API Call: Generating diagram for prompt:", promptText);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    let generatedElements = [];

    // Simple mock logic based on keywords
    if (promptText.toLowerCase().includes("flowchart") || promptText.toLowerCase().includes("process")) {
      generatedElements = [
        { id: generateUniqueId(), type: 'oval', x: 250, y: 50, width: 100, height: 50, label: 'Start', fillColor: '#E0F2F7', strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'rectangle', x: 225, y: 150, width: 150, height: 70, label: 'Perform Task', fillColor: '#F0F8FF', strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 300, startY: 100, endX: 300, endY: 150, arrowhead: true, strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'diamond', x: 250, y: 270, width: 100, height: 60, label: 'Decision?', fillColor: '#FFFACD', strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 300, startY: 220, endX: 300, endY: 270, arrowhead: true, strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 350, startY: 300, endX: 450, endY: 300, arrowhead: true, strokeColor: '#008000', lineWidth: 2, label: 'Yes' },
        { id: generateUniqueId(), type: 'rectangle', x: 450, y: 270, width: 120, height: 60, label: 'Action A', fillColor: '#F0FFF0', strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 250, startY: 300, endX: 150, endY: 300, arrowhead: true, strokeColor: '#FF0000', lineWidth: 2, label: 'No' },
        { id: generateUniqueId(), type: 'rectangle', x: 30, y: 270, width: 120, height: 60, label: 'Action B', fillColor: '#FFFAF0', strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'oval', x: 250, y: 400, width: 100, height: 50, label: 'End', fillColor: '#E0F2F7', strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 300, startY: 330, endX: 300, endY: 400, arrowhead: true, strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 510, startY: 330, endX: 350, endY: 400, arrowhead: true, strokeColor: '#000000', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 90, startY: 330, endX: 250, endY: 400, arrowhead: true, strokeColor: '#000000', lineWidth: 2 },
      ];
    } else if (promptText.toLowerCase().includes("simple shapes")) {
      generatedElements = [
        { id: generateUniqueId(), type: 'rectangle', x: 50, y: 50, width: 100, height: 70, label: 'Box 1', fillColor: '#FFDDC1', strokeColor: '#A0522D', lineWidth: 2 },
        { id: generateUniqueId(), type: 'oval', x: 200, y: 80, width: 80, height: 80, label: 'Circle 1', fillColor: '#D4EEFF', strokeColor: '#4682B4', lineWidth: 2 },
        { id: generateUniqueId(), type: 'line', startX: 150, startY: 85, endX: 200, endY: 120, arrowhead: true, strokeColor: '#333333', lineWidth: 2 },
        { id: generateUniqueId(), type: 'text', x: 300, y: 50, text: 'Hello Text!', fontSize: 20, color: '#6A5ACD' }
      ];
    } else {
      generatedElements = [
        { id: generateUniqueId(), type: 'text', x: 100, y: 100, text: 'AI could not generate specific diagram. Try "flowchart" or "simple shapes".', fontSize: 18, color: '#FF0000' }
      ];
    }
    return generatedElements;
  }
};

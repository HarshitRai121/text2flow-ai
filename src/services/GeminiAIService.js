// src/services/GeminiAIService.js
import { generateUniqueId, DEFAULT_ELEMENT_STYLE, CANVAS_WIDTH, CANVAS_HEIGHT } from '../utils/constants';

// Helper function to calculate the connection point on a shape's boundary
// towards a target point. This version is more robust for various shapes.
const getShapeConnectionPoint = (shape, targetX, targetY) => {
  const cx = shape.x + (shape.width / 2 || 0);
  const cy = shape.y + (shape.height / 2 || 0);

  // Vector from shape center to target
  const dx = targetX - cx;
  const dy = targetY - cy;

  let x = cx;
  let y = cy;

  if (shape.type === 'rectangle' || shape.type === 'oval') {
    // For rectangles and ovals, find intersection with boundary
    const halfWidth = (shape.width || 0) / 2;
    const halfHeight = (shape.height || 0) / 2;

    if (dx === 0 && dy === 0) { // If target is exactly at center, return center
        return { x: cx, y: cy };
    }

    // Calculate intersection point based on ratio of dx/dy to halfWidth/halfHeight
    if (Math.abs(dx) / halfWidth > Math.abs(dy) / halfHeight) {
      // Intersecting vertical sides (left/right)
      x = cx + Math.sign(dx) * halfWidth;
      y = cy + Math.sign(dx) * halfWidth * (dy / dx);
    } else {
      // Intersecting horizontal sides (top/bottom)
      y = cy + Math.sign(dy) * halfHeight;
      x = cx + Math.sign(dy) * halfHeight * (dx / dy);
    }
  } else if (shape.type === 'diamond') {
    const halfWidth = (shape.width || 0) / 2;
    const halfHeight = (shape.height || 0) / 2;

    if (dx === 0 && dy === 0) { // If target is exactly at center, return center
        return { x: cx, y: cy };
    }

    // Determine which of the four lines of the diamond the connection point lies on
    // This is a simplified approach, for perfect accuracy, line-segment intersection is needed.
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx / halfWidth > absDy / halfHeight) { // Closer to horizontal axis, connect to left/right points
        x = cx + Math.sign(dx) * halfWidth;
        y = cy + Math.sign(dx) * halfWidth * (dy / dx);
    } else { // Closer to vertical axis, connect to top/bottom points
        y = cy + Math.sign(dy) * halfHeight;
        x = cx + Math.sign(dy) * halfHeight * (dx / dy);
    }

    // Ensure the point is within the diamond's bounds (approximate)
    // This part can still be tricky for perfect diamond connections
    // For flowcharts, connecting to the nearest side is often sufficient.
  }
  // For text elements, just use their center as connection point for now
  // More advanced logic might be needed if text boxes are draggable/resizable
  // For now, text elements are assumed to be points for connection.

  return { x, y };
};


// Helper function to parse the AI's natural language text output into diagram elements
const parseDiagramTextOutput = (textOutput) => {
  const elements = [];
  const linesToProcess = []; // Store lines to process in the second pass
  const elementMap = new Map(); // To store elements by their labels for connecting lines
  const adjacencyList = new Map(); // For graph traversal: label -> [connected_labels]
  const inDegrees = new Map(); // To count incoming edges for topological sort

  const rawLines = textOutput.split('\n').filter(line => line.trim() !== '');

  // --- First Pass: Parse all elements and populate elementMap ---
  rawLines.forEach(line => {
    line = line.trim();
    if (line.startsWith('- Element:')) {
      const typeMatch = line.match(/- Element:\s*(\w+),\s*Label:\s*(.*)/);
      
      if (typeMatch) {
        const type = typeMatch[1].toLowerCase();
        const label = typeMatch[2].trim();
        const id = generateUniqueId();

        let element = {
          id: id,
          type: type,
          label: label,
          x: 0, // Will be set by layout algorithm
          y: 0, // Will be set by layout algorithm
          ...DEFAULT_ELEMENT_STYLE // Apply default styles
        };

        // Assign specific dimensions and colors based on type
        switch (type) {
          case 'start':
          case 'end':
            element.type = 'oval';
            element.width = 100;
            element.height = 50;
            element.fillColor = '#E0F2F7'; // Light blue
            break;
          case 'process':
            element.type = 'rectangle';
            element.width = 120;
            element.height = 60;
            element.fillColor = '#F0FFF0'; // Light green
            break;
          case 'decision':
            element.type = 'diamond';
            element.width = 100;
            element.height = 80;
            element.fillColor = '#FFFACD'; // Light yellow
            break;
          case 'text':
            element.type = 'text';
            element.fontSize = 16;
            element.color = '#333333'; // Dark gray
            element.fillColor = undefined; // Text elements don't have fill
            element.strokeColor = undefined; // Text elements don't have stroke
            element.lineWidth = undefined; // Text elements don't have line width
            // Estimate width/height for layout purposes, actual rendering might differ
            element.width = label.length * 8 + 20; 
            element.height = 30; 
            break;
          default:
            // Fallback for unrecognized types, treat as rectangle
            element.type = 'rectangle';
            element.width = 120;
            element.height = 60;
            element.fillColor = '#F0FFF0';
        }

        elements.push(element);
        elementMap.set(label, element); // Store by label for line connections
        adjacencyList.set(label, []); // Initialize adjacency list for this element
        inDegrees.set(label, 0); // Initialize in-degree
      }
    } else if (line.startsWith('- Line:')) {
      // Collect lines for the second pass
      linesToProcess.push(line);
    }
  });

  // --- Second Pass: Parse all lines and build graph ---
  linesToProcess.forEach(line => {
    const lineMatch = line.match(/- Line:\s*(.+?)\s*->\s*(.+?)(?:\s*\((.+)\))?$/); 
    
    if (lineMatch) {
      const sourceLabel = lineMatch[1].trim();
      const targetLabel = lineMatch[2].trim();
      const lineLabel = lineMatch[3] ? lineMatch[3].trim() : '';

      const sourceElement = elementMap.get(sourceLabel);
      const targetElement = elementMap.get(targetLabel);

      if (sourceElement && targetElement) {
        // Add to adjacency list
        adjacencyList.get(sourceLabel).push(targetLabel);
        inDegrees.set(targetLabel, inDegrees.get(targetLabel) + 1);

        // Add line element (coordinates will be updated after layout)
        elements.push({
          id: generateUniqueId(),
          type: 'line',
          startX: 0, // Placeholder
          startY: 0, // Placeholder
          endX: 0,   // Placeholder
          endY: 0,   // Placeholder
          arrowhead: true,
          strokeColor: '#000000',
          lineWidth: 2,
          label: lineLabel,
          sourceId: sourceElement.id,
          targetId: targetElement.id,
          sourceLabel: sourceLabel, // Store labels for layout pass
          targetLabel: targetLabel
        });
      } else {
        console.warn(`Could not find source or target element for line: "${line}". Source: "${sourceLabel}", Target: "${targetLabel}"`);
      }
    }
  });

  // --- Third Pass: Layered Layout Algorithm (BFS-based) ---
  const layers = []; // Array of arrays: layers[i] contains elements in layer i
  const elementLayers = new Map(); // label -> layer_index
  const queue = [];

  // Initialize queue with all nodes that have no incoming edges (start nodes)
  for (const [label, inDegree] of inDegrees.entries()) {
    if (inDegree === 0) {
      queue.push(label);
      elementLayers.set(label, 0);
      if (!layers[0]) layers[0] = [];
      layers[0].push(elementMap.get(label));
    }
  }

  let head = 0;
  while(head < queue.length) {
    const currentLabel = queue[head++];
    const currentLayer = elementLayers.get(currentLabel);

    for (const neighborLabel of adjacencyList.get(currentLabel) || []) { // Ensure adjacencyList.get returns an array
      inDegrees.set(neighborLabel, inDegrees.get(neighborLabel) - 1);
      if (inDegrees.get(neighborLabel) === 0) {
        const nextLayer = currentLayer + 1;
        elementLayers.set(neighborLabel, nextLayer);
        if (!layers[nextLayer]) layers[nextLayer] = [];
        layers[nextLayer].push(elementMap.get(neighborLabel));
        queue.push(neighborLabel);
      }
    }
  }

  // Position elements based on layers
  const startY = 50;
  const layerSpacingY = 120; // Vertical space between layers
  const minElementSpacingX = 40; // Minimum horizontal space between elements

  let maxDiagramWidth = 0; // Track the widest layer for scaling

  layers.forEach((layerElements, layerIndex) => {
    const layerY = startY + layerIndex * layerSpacingY;
    
    // Calculate total width of elements in this layer
    const totalElementsWidth = layerElements.reduce((sum, el) => sum + (el.width || 0), 0);
    const totalSpacingWidth = (layerElements.length - 1) * minElementSpacingX;
    const requiredLayerWidth = totalElementsWidth + totalSpacingWidth;

    // Determine starting X to center the layer
    let currentLayerX = (CANVAS_WIDTH - requiredLayerWidth) / 2;
    if (currentLayerX < 20) currentLayerX = 20; // Ensure some padding from left edge

    layerElements.forEach(element => {
      element.x = currentLayerX;
      element.y = layerY;
      currentLayerX += (element.width || 0) + minElementSpacingX;
    });

    maxDiagramWidth = Math.max(maxDiagramWidth, currentLayerX);
  });

  // --- Fourth Pass: Update line coordinates based on new element positions ---
  elements.forEach(el => {
    if (el.type === 'line') {
      const sourceElement = elementMap.get(el.sourceLabel);
      const targetElement = elementMap.get(el.targetLabel);

      if (sourceElement && targetElement) {
        // Calculate the center points of source and target
        const sourceCenterX = sourceElement.x + (sourceElement.width / 2 || 0);
        const sourceCenterY = sourceElement.y + (sourceElement.height / 2 || 0);
        const targetCenterX = targetElement.x + (targetElement.width / 2 || 0);
        const targetCenterY = targetElement.y + (targetElement.height / 2 || 0);

        // Get connection points on the boundary of the shapes
        const { x: startX, y: startY } = getShapeConnectionPoint(sourceElement, targetCenterX, targetCenterY);
        const { x: endX, y: endY } = getShapeConnectionPoint(targetElement, sourceCenterX, sourceCenterY);

        el.startX = startX;
        el.startY = startY;
        el.endX = endX;
        el.endY = endY;
      }
    }
  });

  // --- Fifth Pass: Scale the entire diagram to fit the canvas ---
  // Find min/max coordinates to determine current diagram bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach(el => {
    if (el.type !== 'line') { // Only consider shapes/text for bounding box
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 0));
      maxY = Math.max(maxY, el.y + (el.height || 0));
    }
    // Lines don't define the overall bounds in the same way, but their endpoints should be within bounds
  });

  const diagramCurrentWidth = maxX - minX;
  const diagramCurrentHeight = maxY - minY;

  // Add some padding
  const padding = 40;
  const targetWidth = CANVAS_WIDTH - padding * 2;
  const targetHeight = CANVAS_HEIGHT - padding * 2;

  let scaleFactor = 1;
  if (diagramCurrentWidth > targetWidth || diagramCurrentHeight > targetHeight) {
    scaleFactor = Math.min(targetWidth / diagramCurrentWidth, targetHeight / diagramCurrentHeight);
  }

  // Apply scaling and re-center
  const scaledElements = elements.map(el => {
    if (el.type !== 'line') {
      return {
        ...el,
        x: (el.x - minX) * scaleFactor + padding,
        y: (el.y - minY) * scaleFactor + padding,
        width: (el.width || 0) * scaleFactor,
        height: (el.height || 0) * scaleFactor,
        fontSize: el.type === 'text' ? (el.fontSize || DEFAULT_ELEMENT_STYLE.fontSize) * scaleFactor : el.fontSize,
        lineWidth: (el.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth) * scaleFactor // Scale line width too
      };
    } else {
      // Scale line coordinates
      return {
        ...el,
        startX: (el.startX - minX) * scaleFactor + padding,
        startY: (el.startY - minY) * scaleFactor + padding,
        endX: (el.endX - minX) * scaleFactor + padding,
        endY: (el.endY - minY) * scaleFactor + padding,
        lineWidth: (el.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth) * scaleFactor // Scale line width
      };
    }
  });

  return scaledElements;
};


export const GeminiAIService = {
  async generateDiagramFromPrompt(promptText) {
    console.log("Calling actual Gemini API with prompt (text-based):", promptText);

    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("Gemini API Key is not defined. Please set REACT_APP_GEMINI_API_KEY in your .env file and restart your development server.");
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    console.log("Using API URL:", apiUrl);

    let chatHistory = [];
    chatHistory.push({
      role: "user",
      parts: [
        {
          text: `Generate a list of elements and connections for a diagram based on the following description.
                   Provide the output as a plain text list, one item per line, without any JSON, markdown formatting (like \`\`\`json), or extra conversational text.
                   Use the following format for elements: "- Element: [type], Label: [label]"
                   Use the following format for lines: "- Line: [Source Label] -> [Target Label] (optional label for line)"
                   Recognized element types are: start, process, decision, end, text.
                   Ensure logical flow and reasonable connections.

                   Example:
                   - Element: Start, Label: Begin Process
                   - Element: Process, Label: Step A
                   - Element: Decision, Label: Is it OK?
                   - Element: Process, Label: Step B
                   - Element: End, Label: Finish (Success)
                   - Element: End, Label: Finish (Failure)
                   - Line: Begin Process -> Step A
                   - Line: Step A -> Is it OK?
                   - Line: Is it OK? -> Step B (Yes)
                   - Line: Is it OK? -> Finish (Failure) (No)
                   - Line: Step B -> Finish (Success)

                   Here's the diagram description: "${promptText}"`
        }
      ]
    });

    const payload = {
      contents: chatHistory,
      // No responseMimeType or responseSchema here, as we expect plain text
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Gemini API Error Response:", errorData);
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message || 'Unknown API error'}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const textOutput = result.candidates[0].content.parts[0].text;
        
        console.log("Raw AI response text (for parsing):", textOutput); 

        // Parse the text output into structured diagram elements
        const finalElements = parseDiagramTextOutput(textOutput);

        console.log("Gemini API generated elements (after parsing):", finalElements);
        return finalElements;
      } else {
        throw new Error("Gemini API response was empty or malformed. No candidates or content found.");
      }
    } catch (error) {
      console.error("Error during Gemini API call:", error);
      throw new Error(`Failed to generate diagram from AI: ${error.message}`);
    }
  }
};

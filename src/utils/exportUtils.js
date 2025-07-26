// src/utils/exportUtils.js
import { DEFAULT_ELEMENT_STYLE } from './constants'; // Import DEFAULT_ELEMENT_STYLE

// Helper to convert elements to SVG string
export const elementsToSvgString = (elements, canvasWidth, canvasHeight) => {
  let svgContent = '';

  elements.forEach(element => {
    const strokeColor = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
    const fillColor = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;
    const lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
    const fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;
    const textColor = element.color || DEFAULT_ELEMENT_STYLE.color;

    switch (element.type) {
      case 'rectangle':
        svgContent += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" stroke="${strokeColor}" fill="${fillColor}" stroke-width="${lineWidth}" />`;
        if (element.label) {
          svgContent += `<text x="${element.x + element.width / 2}" y="${element.y + element.height / 2}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${element.label}</text>`;
        }
        break;
      case 'oval':
        svgContent += `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" stroke="${strokeColor}" fill="${fillColor}" stroke-width="${lineWidth}" />`;
        if (element.label) {
          svgContent += `<text x="${element.x + element.width / 2}" y="${element.y + element.height / 2}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${element.label}</text>`;
        }
        break;
      case 'diamond':
        const points = [
          `${element.x + element.width / 2},${element.y}`,
          `${element.x + element.width},${element.y + element.height / 2}`,
          `${element.x + element.width / 2},${element.y + element.height}`,
          `${element.x},${element.y + element.height / 2}`
        ].join(' ');
        svgContent += `<polygon points="${points}" stroke="${strokeColor}" fill="${fillColor}" stroke-width="${lineWidth}" />`;
        if (element.label) {
          svgContent += `<text x="${element.x + element.width / 2}" y="${element.y + element.height / 2}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${element.label}</text>`;
        }
        break;
      case 'line':
        let markerEnd = '';
        if (element.arrowhead) {
          // Define an arrowhead marker in SVG defs
          markerEnd = `url(#arrowhead)`;
        }
        svgContent += `<line x1="${element.startX}" y1="${element.startY}" x2="${element.endX}" y2="${element.endY}" stroke="${strokeColor}" stroke-width="${lineWidth}" marker-end="${markerEnd}" />`;
        if (element.label) {
          const midX = (element.startX + element.endX) / 2;
          const midY = (element.startY + element.endY) / 2;
          svgContent += `<text x="${midX}" y="${midY}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${element.label}</text>`;
        }
        break;
      case 'text':
        // For multiline text, we need to split and position each line
        const textLines = element.text.split('\n');
        let yOffset = 0;
        textLines.forEach(line => {
          svgContent += `<text x="${element.x}" y="${element.y + yOffset}" font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}" text-anchor="start" dominant-baseline="text-before-edge">${line}</text>`;
          yOffset += fontSize * 1.2; // Approximate line height
        });
        break;
      default:
        break;
    }
  });

  // Add arrowhead definition if any line has an arrowhead
  const hasArrowhead = elements.some(el => el.type === 'line' && el.arrowhead);
  let defs = '';
  if (hasArrowhead) {
    defs = `
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="black" />
        </marker>
      </defs>
    `;
  }

  return `
    <svg width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      ${defs}
      ${svgContent}
    </svg>
  `;
};


// src/utils/exportUtils.js
import { DEFAULT_ELEMENT_STYLE } from './constants';

// Helper to escape HTML entities for SVG text
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Converts diagram elements into an SVG string
export const elementsToSvgString = (elements, width, height) => {
  let svgContent = '';

  elements.forEach(element => {
    const strokeColor = element.strokeColor || DEFAULT_ELEMENT_STYLE.strokeColor;
    const fillColor = element.fillColor || DEFAULT_ELEMENT_STYLE.fillColor;
    const lineWidth = element.lineWidth || DEFAULT_ELEMENT_STYLE.lineWidth;
    const textColor = element.color || DEFAULT_ELEMENT_STYLE.color;
    const fontSize = element.fontSize || DEFAULT_ELEMENT_STYLE.fontSize;
    const label = element.label ? escapeHtml(element.label) : '';
    const textContent = element.text ? escapeHtml(element.text) : '';

    switch (element.type) {
      case 'rectangle':
        svgContent += `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"
                       fill="${fillColor}" stroke="${strokeColor}" stroke-width="${lineWidth}" />`;
        if (label) {
          // Center text within rectangle
          svgContent += `<text x="${element.x + element.width / 2}" y="${element.y + element.height / 2}"
                         font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}"
                         text-anchor="middle" dominant-baseline="middle">${label}</text>`;
        }
        break;
      case 'oval':
        svgContent += `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}"
                        rx="${element.width / 2}" ry="${element.height / 2}"
                        fill="${fillColor}" stroke="${strokeColor}" stroke-width="${lineWidth}" />`;
        if (label) {
          // Center text within oval
          svgContent += `<text x="${element.x + element.width / 2}" y="${element.y + element.height / 2}"
                         font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}"
                         text-anchor="middle" dominant-baseline="middle">${label}</text>`;
        }
        break;
      case 'diamond':
        const centerX = element.x + element.width / 2;
        const centerY = element.y + element.height / 2;
        const points = `${centerX},${element.y} ${element.x + element.width},${centerY} ${centerX},${element.y + element.height} ${element.x},${centerY}`;
        svgContent += `<polygon points="${points}"
                       fill="${fillColor}" stroke="${strokeColor}" stroke-width="${lineWidth}" />`;
        if (label) {
          // Center text within diamond
          svgContent += `<text x="${centerX}" y="${centerY}"
                         font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}"
                         text-anchor="middle" dominant-baseline="middle">${label}</text>`;
        }
        break;
      case 'line':
        svgContent += `<line x1="${element.startX}" y1="${element.startY}" x2="${element.endX}" y2="${element.endY}"
                       stroke="${strokeColor}" stroke-width="${lineWidth}" />`;
        if (element.arrowhead) {
          // Define a reusable arrow marker
          const markerId = `arrow-${element.id}`;
          svgContent += `
            <defs>
              <marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="${strokeColor}" />
              </marker>
            </defs>
            <line x1="${element.startX}" y1="${element.startY}" x2="${element.endX}" y2="${element.endY}"
                  stroke="${strokeColor}" stroke-width="${lineWidth}" marker-end="url(#${markerId})" />
          `;
        }
        if (label) {
          // Position label near the middle of the line, slightly offset
          const midX = (element.startX + element.endX) / 2;
          const midY = (element.startY + element.endY) / 2;
          const angleRad = Math.atan2(element.endY - element.startY, element.endX - element.startX);
          const angleDeg = angleRad * 180 / Math.PI;

          svgContent += `<text x="${midX}" y="${midY - 5}"
                         font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}"
                         text-anchor="middle" dominant-baseline="auto" transform="rotate(${angleDeg}, ${midX}, ${midY})">${label}</text>`;
        }
        break;
      case 'text':
        svgContent += `<text x="${element.x}" y="${element.y}"
                       font-family="Inter, sans-serif" font-size="${fontSize}" fill="${textColor}"
                       text-anchor="${element.textAlign || 'left'}" dominant-baseline="${element.textBaseline || 'hanging'}"
                       >${textContent}</text>`;
        break;
      default:
        break;
    }
  });

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f8f8" /> <!-- Background color -->
      ${svgContent}
    </svg>
  `;
};

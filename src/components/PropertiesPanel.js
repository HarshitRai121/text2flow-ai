// src/components/PropertiesPanel.js
import React from 'react';

const PropertiesPanel = ({ selectedElementProps, onPropertyChange }) => {
  if (!selectedElementProps) {
    return (
      <div className="lg:w-1/4 bg-white rounded-xl shadow-lg p-4 flex flex-col items-start space-y-3">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Properties</h2>
        <p className="text-gray-500">Select an element to view/edit its properties.</p>
      </div>
    );
  }

  const { id, type, label, text, strokeColor, fillColor, lineWidth, fontSize, color } = selectedElementProps;

  return (
    <div className="lg:w-1/4 bg-white rounded-xl shadow-lg p-4 flex flex-col items-start space-y-3">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Properties</h2>
      <div className="w-full space-y-2">
        <p className="text-sm text-gray-600">ID: <span className="font-mono text-xs">{id}</span></p>
        <p className="text-sm text-gray-600">Type: <span className="font-semibold capitalize">{type}</span></p>

        {/* Label/Text Input */}
        {(type === 'text' || label !== undefined) && (
          <div>
            <label htmlFor="element-text" className="block text-sm font-medium text-gray-700">
              {type === 'text' ? 'Text Content' : 'Label'}
            </label>
            <input
              type="text"
              id="element-text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              value={type === 'text' ? text : label}
              onChange={(e) => onPropertyChange(type === 'text' ? 'text' : 'label', e.target.value)}
            />
          </div>
        )}

        {/* Stroke Color */}
        {(type !== 'text' || (type === 'text' && strokeColor !== undefined)) && ( // Text elements can have stroke if defined, though typically not
          <div>
            <label htmlFor="stroke-color" className="block text-sm font-medium text-gray-700">Stroke Color</label>
            <input
              type="color"
              id="stroke-color"
              className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={strokeColor || '#000000'} // Default to black if undefined
              onChange={(e) => onPropertyChange('strokeColor', e.target.value)}
            />
          </div>
        )}

        {/* Fill Color (only for shapes) */}
        {(type === 'rectangle' || type === 'oval' || type === 'diamond') && (
          <div>
            <label htmlFor="fill-color" className="block text-sm font-medium text-gray-700">Fill Color</label>
            <input
              type="color"
              id="fill-color"
              className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={fillColor || '#FFFFFF'} // Default to white if undefined
              onChange={(e) => onPropertyChange('fillColor', e.target.value)}
            />
          </div>
        )}

        {/* Line Width */}
        {(type !== 'text' || (type === 'text' && lineWidth !== undefined)) && ( // Text elements can have line width if defined, though typically not
          <div>
            <label htmlFor="line-width" className="block text-sm font-medium text-gray-700">Line Width</label>
            <input
              type="number"
              id="line-width"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              value={lineWidth || 2}
              onChange={(e) => onPropertyChange('lineWidth', parseInt(e.target.value, 10))}
              min="1"
              max="10"
            />
          </div>
        )}

        {/* Font Size (for text and shapes with labels) */}
        {(type === 'text' || (type !== 'line' && label !== undefined)) && (
          <div>
            <label htmlFor="font-size" className="block text-sm font-medium text-gray-700">Font Size</label>
            <input
              type="number"
              id="font-size"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              value={fontSize || 16}
              onChange={(e) => onPropertyChange('fontSize', parseInt(e.target.value, 10))}
              min="8"
              max="72"
            />
          </div>
        )}

        {/* Text Color (for text and shapes with labels) */}
        {(type === 'text' || (type !== 'line' && label !== undefined)) && (
          <div>
            <label htmlFor="text-color" className="block text-sm font-medium text-gray-700">Text Color</label>
            <input
              type="color"
              id="text-color"
              className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={color || '#000000'}
              onChange={(e) => onPropertyChange('color', e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;

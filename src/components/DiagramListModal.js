// src/components/DiagramListModal.js
import React from 'react';
import Modal from './Modal'; // Assuming you have a Modal component

const DiagramListModal = ({
  show,
  onClose,
  diagrams,
  onLoadDiagram,
  onDeleteDiagram,
  loading,
  error
}) => {
  return (
    <Modal show={show} onClose={onClose} title="My Saved Diagrams">
      <div className="p-4">
        {loading && <p className="text-blue-600 text-center">Loading diagrams...</p>}
        {error && <p className="text-red-600 text-center">Error: {error}</p>}
        {!loading && diagrams && diagrams.length === 0 && !error && ( // Added check for `diagrams` being truthy
          <p className="text-gray-600 text-center">No diagrams saved yet. Start creating!</p>
        )}
        {!loading && diagrams && diagrams.length > 0 && ( // Added check for `diagrams` being truthy
          <ul className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {diagrams.map((diagram) => (
              <li key={diagram.name} className="py-3 flex items-center justify-between">
                <div>
                  {/* Ensure diagram.name is always rendered */}
                  <p className="font-semibold text-gray-800">{diagram.name || 'Untitled Diagram'}</p> 
                  <p className="text-sm text-gray-500">
                    Last Saved: {diagram.lastSaved ? new Date(diagram.lastSaved).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => onLoadDiagram(diagram.name)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => onDeleteDiagram(diagram.name)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};

export default DiagramListModal;
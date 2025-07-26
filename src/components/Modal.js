// src/components/Modal.js
import React, { useState, useEffect } from 'react';

const Modal = ({ show, title, message, onClose, onConfirm, showConfirmButton, confirmText, showInput, inputValue: initialInputValue, children, zIndex = 50 }) => { // Added zIndex prop with default
  const [inputValue, setInputValue] = useState(initialInputValue || '');

  useEffect(() => {
    if (show) {
      setInputValue(initialInputValue || '');
    }
  }, [show, initialInputValue]);

  if (!show) return null;

  const handleConfirmClick = () => {
    if (onConfirm) {
      onConfirm(showInput ? inputValue : undefined);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4" style={{ zIndex: zIndex }}> {/* Apply zIndex here */}
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-auto p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">{title}</h3>
        {message && <p className="text-gray-700 mb-4">{message}</p>}

        {showInput && (
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded-md mb-4 focus:ring-blue-500 focus:border-blue-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter diagram name"
            autoFocus
          />
        )}

        {children}

        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200"
          >
            Cancel
          </button>
          {showConfirmButton && (
            <button
              onClick={handleConfirmClick}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              {confirmText || 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;


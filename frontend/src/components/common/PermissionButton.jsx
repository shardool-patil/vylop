import React from 'react';

const PermissionButton = ({ 
  onClick, 
  disabled, 
  tooltipMessage, 
  children, 
  className 
}) => {
  return (
    <div className="relative group inline-block" title={disabled ? tooltipMessage : ""}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`px-4 py-2 rounded transition-colors ${
          disabled 
            ? 'bg-gray-400 cursor-not-allowed opacity-50' 
            : `hover:bg-blue-600 ${className}`
        }`}
      >
        {children}
      </button>
    </div>
  );
};

export default PermissionButton;
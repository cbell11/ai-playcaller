import React from 'react';

export function LoadingModal() {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl text-center">
        <div className="w-24 h-24 mx-auto mb-4 relative">
          {/* Football SVG with spinning animation */}
          <svg
            className="w-full h-full animate-spin"
            viewBox="0 0 24 24"
            style={{ animationDuration: '3s' }}
          >
            <path
              fill="#8B4513"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
            />
            {/* Football laces */}
            <rect x="11" y="7" width="2" height="10" fill="#8B4513" />
            <rect x="8" y="11" width="8" height="2" fill="#8B4513" />
          </svg>
        </div>
        <h3 className="text-xl font-bold mb-2">Generating Game Plan</h3>
        <p className="text-gray-600">
          Please wait while our AI creates your game plan. This may take a minute...
        </p>
      </div>
    </div>
  );
} 
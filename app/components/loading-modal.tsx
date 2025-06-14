import React from 'react';
import Image from 'next/image';

interface LoadingModalProps {
  message?: string;
}

export function LoadingModal({ message = "Generating your Play Pool now!" }: LoadingModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl flex flex-col items-center space-y-4">
        <div className="relative w-24 h-24">
          <Image
            src="/ball.gif"
            alt="Loading football"
            width={96}
            height={96}
            priority
            className="object-contain"
          />
        </div>
        <p className="text-lg font-semibold text-gray-700">{message}</p>
        <p className="text-sm text-gray-500">This may take a few moments</p>
      </div>
    </div>
  );
} 
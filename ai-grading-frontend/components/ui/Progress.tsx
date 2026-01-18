import React from 'react';

interface ProgressProps {
  value?: number;
  max?: number;
  className?: string;
}

const Progress: React.FC<ProgressProps> = ({ 
  value = 0, 
  max = 100, 
  className = '' 
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div
      className={`w-full bg-gray-200 rounded-full h-2 ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-valuemin={0}
    >
      <div
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default Progress;
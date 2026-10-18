import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullHeight?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading...',
  size = 'md',
  fullHeight = false,
}) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 36,
  };

  const containerClasses = fullHeight
    ? 'flex flex-col items-center justify-center p-12 min-h-[300px]'
    : 'flex items-center justify-center p-4 space-x-2';

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      <Loader2
        size={sizeMap[size]}
        className="animate-spin text-primary flex-shrink-0"
        aria-hidden="true"
      />
      <span className="text-secondary text-sm font-medium">{label}</span>
    </div>
  );
};

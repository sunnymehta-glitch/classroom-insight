import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border bg-card/60 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-canvas flex items-center justify-center text-secondary mb-3">
        {icon || <FolderOpen size={24} aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-main">{title}</h3>
      <p className="text-sm text-secondary max-w-md mt-1">{description}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

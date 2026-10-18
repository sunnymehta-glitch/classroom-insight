import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorMessageProps {
  title?: string;
  message: string;
  details?: Array<{ field?: string; issue: string }>;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'An error occurred',
  message,
  details = [],
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl border border-danger/20 bg-danger-light/50 p-5 text-main ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-danger mr-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-danger">{title}</h3>
          <p className="text-sm text-secondary mt-1">{message}</p>
          {details.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-secondary list-disc list-inside">
              {details.map((d, idx) => (
                <li key={idx}>
                  {d.field ? <strong className="text-main">{d.field}:</strong> : null} {d.issue}
                </li>
              ))}
            </ul>
          )}
          {onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-card border border-border text-main hover:bg-canvas transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <RefreshCw size={13} className="mr-1.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

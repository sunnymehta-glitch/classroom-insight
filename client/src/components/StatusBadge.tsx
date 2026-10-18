import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md';
  icon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  icon = true,
  className = '',
}) => {
  const getStyles = () => {
    switch (status) {
      case 'success':
        return 'bg-success-light text-success border-success/30';
      case 'warning':
        return 'bg-warning-light text-warning border-warning/30';
      case 'danger':
        return 'bg-danger-light text-danger border-danger/30';
      case 'info':
        return 'bg-primary-light text-primary border-primary/30';
      case 'neutral':
      default:
        return 'bg-canvas text-secondary border-border';
    }
  };

  const renderIcon = () => {
    if (!icon) return null;
    const iconSize = size === 'sm' ? 14 : 16;
    switch (status) {
      case 'success':
        return <CheckCircle2 size={iconSize} className="mr-1.5 flex-shrink-0" aria-hidden="true" />;
      case 'warning':
        return <AlertTriangle size={iconSize} className="mr-1.5 flex-shrink-0" aria-hidden="true" />;
      case 'danger':
        return <XCircle size={iconSize} className="mr-1.5 flex-shrink-0" aria-hidden="true" />;
      case 'info':
        return <Info size={iconSize} className="mr-1.5 flex-shrink-0" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${getStyles()} ${className}`}
      role="status"
    >
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
};

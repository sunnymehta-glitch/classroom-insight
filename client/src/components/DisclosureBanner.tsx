import React from 'react';
import { AlertCircle } from 'lucide-react';

export const DisclosureBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <div
      className={`rounded-xl border border-warning/30 bg-warning-light p-3 text-sm text-main flex items-start space-x-2.5 ${
        compact ? 'py-2 px-3 text-xs' : ''
      }`}
      role="note"
      aria-label="Dataset provenance and domain disclosure"
    >
      <AlertCircle
        size={compact ? 16 : 18}
        className="text-warning mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div>
        <p className="font-medium text-warning">
          Academic Dataset Provenance & Scope Disclosure
        </p>
        <p className="text-secondary mt-0.5 text-xs leading-relaxed">
          Inference models were trained exclusively on secondary school mathematics performance data from two Portuguese public schools (UCI Student Performance dataset). Models have <strong>not</strong> been calibrated or validated for Indian secondary curricula, examination systems, or state boards. Predictions represent statistical trajectory estimates and must not replace pedagogical judgment or teacher evaluation.
        </p>
      </div>
    </div>
  );
};

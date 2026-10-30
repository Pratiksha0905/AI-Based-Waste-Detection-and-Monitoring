import React from 'react';
import type { Severity } from '../api/endpoints';
import { severityBg, severityDot, severityLabel, getSeverityAriaLabel } from '../utils/display';

interface SeverityBadgeProps {
  severity: Severity;
  showDot?: boolean;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  showDot = true,
}) => {
  return (
    <span
      className={`badge ${severityBg(severity)}`}
      aria-label={getSeverityAriaLabel(severity)}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${severityDot(severity)} flex-shrink-0`}
          aria-hidden="true"
        />
      )}
      {severityLabel(severity)}
    </span>
  );
};

export default SeverityBadge;

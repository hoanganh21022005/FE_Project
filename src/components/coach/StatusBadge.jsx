import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { statusLabel, statusTone } from '../../utils/status';

const TONE_CLASSES = {
  green: 'bg-emerald-50 text-status-success ring-1 ring-inset ring-emerald-200',
  amber: 'bg-amber-50 text-status-warning ring-1 ring-inset ring-amber-200',
  red: 'bg-rose-50 text-status-danger ring-1 ring-inset ring-rose-200',
  blue: 'bg-sky-50 text-status-info ring-1 ring-inset ring-sky-200',
  slate: 'bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border-color',
};

export function CoachStatusBadge({ type = 'session', value = '', className = '' }) {
  const { t } = useSCMS();
  const label = statusLabel(type, value, t);
  const tone = statusTone(type, value);
  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.slate;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}

export default CoachStatusBadge;

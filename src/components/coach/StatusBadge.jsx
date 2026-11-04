import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { statusLabel, statusTone } from '../../utils/status';

const TONE_CLASSES = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-rose-50 text-rose-800 border-rose-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function CoachStatusBadge({ type = 'session', value = '', className = '' }) {
  const { t } = useSCMS();
  const label = statusLabel(type, value, t);
  const tone = statusTone(type, value);
  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.slate;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border whitespace-nowrap ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}

export default CoachStatusBadge;

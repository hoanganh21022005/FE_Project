import React from 'react';

import { useSCMS } from '../../context/SCMSContext';



export function StatusBadge({ type, status, label: customLabel }) {
  const { t } = useSCMS();
  const normalizedStatus = String(status || '').toLowerCase().replace(/[ -]/g, '_');

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-300';

  if (type === 'membership') {
    switch (normalizedStatus) {
      case 'active':
        colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        break;
      case 'pending_payment':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
      case 'grace_period':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
      case 'expired':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'none':
        colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';
        break;
      case 'cancelled':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
    }
  } else if (type === 'payment') {
    switch (normalizedStatus) {
      case 'successful':
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'pending':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
      case 'failed':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'reversed':
        colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
        break;
      case 'expired':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'cancelled':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
    }
  } else if (type === 'class') {
    switch (normalizedStatus) {
      case 'published':
        colorClasses = 'bg-blue-50 text-blue-800 border-blue-200';
        break;
      case 'full':
        colorClasses = 'bg-amber-50 text-status-warning border-amber-200';
        break;
      case 'draft':
        colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
        break;
      case 'completed':
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
    }
  } else if (type === 'attendance') {
    switch (normalizedStatus) {
      case 'present':
        colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'late':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
      case 'absent':
        colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
        break;
      case 'not_recorded':
        colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
        break;
    }
  }

  const label = customLabel || t(status) || status;

  return (
    <span className={`inline-flex items-center justify-center w-[112px] px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap shrink-0 text-center ${colorClasses}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

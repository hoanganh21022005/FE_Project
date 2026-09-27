import React from 'react';

import { useSCMS } from '../../context/SCMSContext';



export function StatusBadge({ type, status }) {
  const { t } = useSCMS();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-300';

  if (type === 'membership') {
    switch (status) {
      case 'active':
        colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        break;
      case 'pending_payment':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        break;
      case 'grace_period':
        colorClasses = 'bg-orange-50 text-orange-800 border-orange-300 font-extrabold shadow-2xs';
        break;
      case 'expired':
        colorClasses = 'bg-rose-50 text-rose-800 border-rose-200';
        break;
      case 'none':
        colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';
        break;
      case 'cancelled':
        colorClasses = 'bg-slate-100 text-slate-600 border-slate-300';
        break;
    }
  } else if (type === 'payment') {
    switch (status) {
      case 'successful':
        colorClasses = 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]';
        break;
      case 'pending':
        colorClasses = 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]';
        break;
      case 'failed':
        colorClasses = 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
        break;
      case 'reversed':
        colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
        break;
    }
  } else if (type === 'class') {
    switch (status) {
      case 'published':
        colorClasses = 'bg-blue-50 text-blue-800 border-blue-200';
        break;
      case 'full':
        colorClasses = 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
        break;
      case 'draft':
        colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
        break;
      case 'completed':
        colorClasses = 'bg-indigo-50 text-indigo-800 border-indigo-200';
        break;
    }
  } else if (type === 'attendance') {
    switch (status) {
      case 'present':
        colorClasses = 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]';
        break;
      case 'late':
        colorClasses = 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]';
        break;
      case 'absent':
        colorClasses = 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]';
        break;
      case 'not_recorded':
        colorClasses = 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]';
        break;
    }
  }

  const label = t(status) || status;

  return (
    <span className={`inline-flex items-center justify-center w-[112px] px-2 py-1 rounded text-[11px] font-bold border whitespace-nowrap shrink-0 text-center ${colorClasses}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function Toast() {
  const { toast } = useSCMS();

  if (!toast) return null;

  const tone = {
    success: 'bg-status-success text-white border-status-success',
    warning: 'bg-status-warning text-white border-status-warning',
    error: 'bg-status-error text-white border-status-error',
    info: 'bg-status-info text-white border-status-info',
  }[toast.type] || 'bg-brand-primary text-white border-brand-primary';

  const Icon = toast.type === 'success' ? CheckCircle2 :
               toast.type === 'error' ? AlertCircle : Info;

  const iconTone = toast.type === 'error' ? 'text-white' : 'text-brand-accent-soft';

  return (
    <div id="scms-toast" className="fixed bottom-6 right-6 z-50 animate-bounce">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg ${tone}`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${iconTone}`} />
        <span className="text-xs font-bold">{toast.message}</span>
      </div>
    </div>
  );
}

import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function Toast() {
  const { toast } = useSCMS();

  if (!toast) return null;

  const bg = toast.type === 'success' ? 'bg-slate-900 text-white border-slate-800' :
             toast.type === 'error' ? 'bg-rose-900 text-white border-rose-800' :
             'bg-slate-800 text-white border-slate-700';

  const Icon = toast.type === 'success' ? CheckCircle2 :
               toast.type === 'error' ? AlertCircle : Info;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg ${bg}`}>
        <Icon className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <span className="text-xs font-bold">{toast.message}</span>
      </div>
    </div>
  );
}

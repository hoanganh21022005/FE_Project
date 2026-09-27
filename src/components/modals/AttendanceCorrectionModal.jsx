import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';

import { AlertTriangle, ShieldAlert, Check, X } from 'lucide-react';



export function AttendanceCorrectionModal({
  classId, memberId, memberName, currentStatus, isOpen, onClose
}) {
  const { recordAttendance, t, language } = useSCMS();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t('correctionReasonRequired'));
      return;
    }

    recordAttendance(classId, memberId, selectedStatus, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md shadow-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>{t('correctAttendance')}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">{language === 'vi' ? 'Học viên' : 'Member'}</label>
            <div className="text-xs font-bold text-slate-900 bg-slate-50 px-3 py-2 rounded border border-slate-200">
              {memberName}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-2">{language === 'vi' ? 'Trạng thái mới' : 'New Status'}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['present', 'late', 'absent']).map(st => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`py-2 px-3 rounded text-xs font-bold border flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                    selectedStatus === st
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {selectedStatus === st && <Check className="w-3.5 h-3.5 shrink-0" />}
                  <span>{t(st)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'vi' ? 'Lý do chỉnh sửa' : 'Mandatory Correction Reason'} <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => { setReason(e.target.value); setError(''); }}
              placeholder={language === 'vi' ? 'Ví dụ: Học viên đến trễ 10 phút do kẹt xe, đã gọi xin phép Coach...' : 'e.g., Student arrived 10 mins late due to traffic...'}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            {error && <p className="text-xs text-rose-600 mt-1 font-semibold">{error}</p>}
          </div>

          {/* Audit Log Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t('attendanceAuditWarning')}</p>
              <p className="text-[10px] text-amber-800 mt-0.5 font-mono">
                Value change: {t(currentStatus)} &rarr; {t(selectedStatus)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded shadow-xs"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded shadow-xs"
            >
              {t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

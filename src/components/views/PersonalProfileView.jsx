import React from 'react';
import { useSCMS } from '../../context/SCMSContext';

export function PersonalProfileView() {
  const { currentUser, t } = useSCMS();

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-6">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="w-14 h-14 rounded bg-slate-900 flex items-center justify-center text-white text-xl font-bold">
          {currentUser.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">{currentUser.name}</h2>
          <p className="text-xs text-slate-500">{currentUser.email}</p>
          <span className="inline-flex items-center justify-center min-w-[140px] mt-1 px-3 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200 text-center">
            {t(currentUser.role === 'manager' ? 'roleManager' : currentUser.role === 'coach' ? 'roleCoach' : currentUser.role === 'receptionist' ? 'roleReceptionist' : 'roleMember')}
          </span>
        </div>
      </div>

      <div className="space-y-3 text-xs text-slate-700">
        <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
          <span className="text-slate-500">ID Người Dùng:</span>
          <span className="font-mono text-slate-900 font-bold">{currentUser.id}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
          <span className="text-slate-500">Trạng Thái Tài Khoản:</span>
          <span className="font-bold text-emerald-800">Đang hoạt động (Active)</span>
        </div>
      </div>
    </div>
  );
}

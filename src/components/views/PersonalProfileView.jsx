import React from 'react';
import { useSCMS } from '../../context/SCMSContext';

export function PersonalProfileView() {
  const { currentUser, t } = useSCMS();
  const userName = currentUser?.name || 'User';
  const userEmail = currentUser?.email || '';
  const userId = currentUser?.id ?? 'N/A';
  const role = currentUser?.role || 'member';

  const roleLabel = t(
    role === 'admin'
      ? 'roleAdmin'
      : role === 'manager'
        ? 'roleManager'
        : role === 'coach'
          ? 'roleCoach'
          : role === 'receptionist'
            ? 'roleReceptionist'
            : 'roleMember'
  );

  return (
    <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-lg p-6 shadow-xs space-y-6">
      <div className="flex items-center gap-4 border-b border-stone-200 pb-6">
        <div className="w-14 h-14 rounded-lg bg-[#181818] text-[#D62323] flex items-center justify-center text-xl font-bold">
          {userName.charAt(0)}
        </div>
        <div>
          <h2 className="text-base font-bold text-[#181818]">{userName}</h2>
          <p className="text-xs text-stone-500">{userEmail}</p>
          <span className="inline-flex items-center justify-center min-w-[140px] mt-1.5 px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider bg-red-50 text-[#BA0000] border border-red-200 text-center">
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="space-y-3 text-xs text-stone-700">
        <div className="p-3 bg-stone-50 rounded border border-stone-200 flex items-center justify-between">
          <span className="text-stone-500">ID Người Dùng:</span>
          <span className="font-mono text-stone-900 font-bold tabular-nums">{userId}</span>
        </div>
        <div className="p-3 bg-stone-50 rounded border border-stone-200 flex items-center justify-between">
          <span className="text-stone-500">Trạng Thái Tài Khoản:</span>
          <span className="font-bold text-emerald-800">Đang hoạt động (Active)</span>
        </div>
      </div>
    </div>
  );
}

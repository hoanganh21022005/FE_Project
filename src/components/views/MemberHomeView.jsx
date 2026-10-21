import React from 'react';
import { useSCMS } from '../../context/SCMSContext';

export function MemberHomeView() {
  const { language } = useSCMS();
  const isVi = language === 'vi';

  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-7 sm:py-8">
    <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">VIBE SPORT · MEMBER</p>
    <h1 className="mt-2 text-3xl font-black text-slate-950">{isVi ? 'Tổng quan' : 'Overview'}</h1>
    <p className="mt-2 text-sm text-slate-500">{isVi ? 'Trang tổng quan sẽ được cập nhật sau. Chọn chức năng ở thanh bên trái để tiếp tục.' : 'The overview page will be added later. Choose a section from the sidebar to continue.'}</p>
  </main>;
}

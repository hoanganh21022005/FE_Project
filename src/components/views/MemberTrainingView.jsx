import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ClipboardList, RefreshCw, UserRound } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberTrainingPlans, getMemberTrainingResults } from '../../api/memberPortalApi';
import { getErrorMessage } from '../../api/apiErrors';

export function MemberTrainingView() {
  const { currentUser, language } = useSCMS();
  const isVi = language === 'vi';
  const memberId = Number(currentUser?.memberId);
  const validMember = Number.isInteger(memberId) && memberId > 0;
  const [plans, setPlans] = useState([]); const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!validMember) { setPlans([]); setResults([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [planResult, resultResult] = await Promise.allSettled([getMemberTrainingPlans(memberId), getMemberTrainingResults(memberId)]);
      if (planResult.status === 'rejected' && resultResult.status === 'rejected') throw planResult.reason;
      setPlans(planResult.status === 'fulfilled' ? planResult.value : []);
      setResults(resultResult.status === 'fulfilled' ? resultResult.value : []);
      if (planResult.status === 'rejected' || resultResult.status === 'rejected') {
        setError(isVi ? 'Một số dữ liệu tập luyện không được backend cho phép tải. Các mục còn quyền truy cập vẫn được hiển thị.' : 'The backend denied access to some training data. Available data is still shown.');
      }
    }
    catch (err) { setPlans([]); setResults([]); setError(getErrorMessage(err, 'Không thể tải thông tin tập luyện.')); }
    finally { setLoading(false); }
  }, [isVi, memberId, validMember]);
  useEffect(() => { refresh(); }, [refresh]);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal-dark">VIBE SPORT · MEMBER</p><h1 className="mt-2 text-3xl font-black text-slate-950">{isVi ? 'Tiến độ tập luyện' : 'Training progress'}</h1><p className="mt-2 text-sm text-slate-500">{isVi ? 'Kế hoạch từ huấn luyện viên và kết quả từng buổi tập.' : 'Coach plans and session results.'}</p></div><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" />{isVi ? 'Tải lại' : 'Refresh'}</button></header>
    {!validMember && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{isVi ? 'Tài khoản chưa được liên kết với hồ sơ hội viên.' : 'This account is not linked to a member profile.'}</div>}{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {loading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">{isVi ? 'Đang tải…' : 'Loading…'}</div> : <div className="grid gap-6 lg:grid-cols-2"><section className="space-y-3"><div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-brand-teal-dark"/><h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Kế hoạch huấn luyện' : 'Training plans'}</h2></div>{plans.length ? plans.map((p) => <article key={p.planId || p.id} className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">{p.title || (isVi ? 'Kế hoạch tập luyện' : 'Training plan')}</h3><p className="mt-1 text-xs text-slate-500">{p.className || ''} {p.coachName ? `· ${p.coachName}` : ''}</p>{p.goal && <p className="mt-3 text-sm"><strong>{isVi ? 'Mục tiêu: ' : 'Goal: '}</strong>{p.goal}</p>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{p.content || (isVi ? 'Chưa có nội dung chi tiết.' : 'No details yet.')}</p>{(p.startDate || p.endDate) && <p className="mt-3 text-xs text-slate-500">{p.startDate || '—'} – {p.endDate || '—'}</p>}</article>) : <Empty text={isVi ? 'Huấn luyện viên chưa giao kế hoạch.' : 'No coach plan assigned yet.'} />}</section><section className="space-y-3"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-brand-teal-dark"/><h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Kết quả tập luyện' : 'Session results'}</h2></div>{results.length ? results.map((r) => <article key={r.resultId || r.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex justify-between gap-3"><h3 className="font-bold text-slate-900">{r.className || (isVi ? 'Buổi tập' : 'Training session')}</h3><span className="text-xs text-slate-500">{r.sessionDate || ''}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{r.content || '—'}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5"/>{r.coachName || (isVi ? 'Huấn luyện viên' : 'Coach')}</span>{r.attendanceStatus && <span>{isVi ? 'Điểm danh:' : 'Attendance:'} {r.attendanceStatus}</span>}</div></article>) : <Empty text={isVi ? 'Chưa có kết quả tập luyện được ghi nhận.' : 'No training results recorded yet.'} />}</section></div>}
  </main>;
}

function Empty({ text }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>; }

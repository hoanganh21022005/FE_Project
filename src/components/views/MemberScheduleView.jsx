import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Clock3, RefreshCw, UserRound } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberClasses } from '../../api/memberPortalApi';
import { getErrorMessage } from '../../api/apiErrors';

const toDate = (value) => value
  ? new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  : null;

const getEnrollmentSessions = (enrollment) => {
  const sessions = enrollment.sessions || enrollment.classSessions || enrollment.scheduledSessions;
  return Array.isArray(sessions) ? sessions : [];
};

const isLegacyStrengthClass = (enrollment) =>
  String(enrollment.className || '').trim().toLocaleLowerCase('vi') === 'gym suc manh';

export function MemberScheduleView() {
  const { currentUser, language } = useSCMS();
  const isVi = language === 'vi';
  const memberId = Number(currentUser?.memberId);
  const validMember = Number.isInteger(memberId) && memberId > 0;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!validMember) { setRows([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const enrollments = await getMemberClasses(memberId);
      setRows(enrollments.map((enrollment) => ({
        ...enrollment,
        sessions: getEnrollmentSessions(enrollment),
      })));
    }
    catch (err) { setRows([]); setError(getErrorMessage(err, 'Không thể tải lịch học.')); }
    finally { setLoading(false); }
  }, [isVi, memberId, validMember]);
  useEffect(() => { refresh(); }, [refresh]);

  const activeRows = rows.filter((row) =>
    !['cancelled', 'canceled', 'dropped', 'rejected'].includes(String(row.status || '').toLowerCase())
    && !isLegacyStrengthClass(row));
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">VIBE SPORT · MEMBER</p><h1 className="mt-2 text-3xl font-black text-slate-950">{isVi ? 'Lịch học của tôi' : 'My class schedule'}</h1><p className="mt-2 text-sm text-slate-500">{isVi ? 'Theo dõi lớp đã đăng ký, lịch học và huấn luyện viên.' : 'Review enrolled classes, schedule and coaches.'}</p></div><button onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw className="h-4 w-4" />{isVi ? 'Tải lại' : 'Refresh'}</button></header>
    {!validMember && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{isVi ? 'Tài khoản chưa được liên kết với hồ sơ hội viên. Vui lòng liên hệ lễ tân để cập nhật hồ sơ.' : 'This account is not linked to a member profile. Please contact reception.'}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{isVi ? 'Đang tải lịch học…' : 'Loading schedule…'}</div> : activeRows.length ? <div className="grid gap-3 md:grid-cols-2">{activeRows.map((row, index) => {
      const sessions = row.sessions || [];
      const firstSession = sessions.find((session) => session.sessionDate);
      const firstClassDate = toDate(row.startDate);
      return <article key={row.id || `${row.classId}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div>
          <span className="text-xs font-bold uppercase tracking-wide text-red-700">{row.subjectName || 'VIBE SPORT'}</span>
          <h2 className="mt-1 text-lg font-extrabold text-slate-900">{row.className || (isVi ? `Lớp #${row.classId}` : `Class #${row.classId}`)}</h2>
        </div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{row.status || (isVi ? 'Đã đăng ký' : 'Enrolled')}</span></div>
        <div className="mt-4 grid gap-2 text-sm text-slate-600">
          <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{firstSession ? toDate(firstSession.sessionDate) : firstClassDate || (isVi ? 'Lịch học chưa được xếp' : 'Schedule not set')}</p>
          <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-400" />{sessions.length ? `${sessions.length} ${isVi ? 'buổi đã lên lịch' : 'scheduled sessions'}` : (isVi ? 'Chưa có thông tin buổi học' : 'Session details unavailable')}</p>
          <p className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" />{row.coachName || firstSession?.coachName || (isVi ? 'Chưa phân công huấn luyện viên' : 'Coach not assigned')}</p>
        </div>
        {sessions.length > 0 && <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">{sessions.slice(0, 4).map((session) => <p key={session.id} className="text-xs text-slate-600">{toDate(session.sessionDate) || '—'} · {session.startTime || '—'}–{session.endTime || '—'} · {session.roomName || (isVi ? 'Chưa có sân' : 'Room pending')}</p>)}</div>}
        {row.paymentStatus && <p className="mt-3 text-xs text-slate-500">{isVi ? 'Thanh toán:' : 'Payment:'} {row.paymentStatus}</p>}
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{isVi ? 'Khóa Normal gồm 12 buổi cố định và không thể hủy đăng ký. Nếu thông tin lớp hoặc môn học không đúng, vui lòng liên hệ lễ tân để kiểm tra dữ liệu.' : 'Normal courses contain 12 fixed sessions and cannot be cancelled. Contact reception if the class or subject details look incorrect.'}</p>
      </article>;
    })}</div> : validMember && !error && <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><CalendarDays className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 text-lg font-bold text-slate-900">{isVi ? 'Bạn chưa đăng ký lớp học' : 'No classes enrolled'}</h2><p className="mt-1 text-sm text-slate-500">{isVi ? 'Chọn Đăng ký khóa học để tìm lớp phù hợp.' : 'Visit Course Registration to find a class.'}</p></section>}
  </main>;
}

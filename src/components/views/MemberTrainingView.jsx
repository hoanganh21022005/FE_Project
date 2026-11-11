import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Award, ClipboardList, RefreshCw, UserRound, Search, Filter, X } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberTrainingPlans, getMemberTrainingResults, getMemberEvaluations, getTrainingPlanById } from '../../api/memberPortalApi';
import { getAuthoritativeProfileId } from '../../utils/memberSafetyHelpers';
import { getErrorMessage } from '../../api/apiErrors';
import { PageHeader } from '../ui/PageHeader';

export function MemberTrainingView() {
  const { currentUser, language } = useSCMS();
  const isVi = language === 'vi';
  const resolvedId = getAuthoritativeProfileId(currentUser) ?? currentUser?.memberId;
  const memberId = Number(resolvedId);
  const validMember = Number.isInteger(memberId) && memberId > 0;
  const [plans, setPlans] = useState([]);
  const [results, setResults] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [resultSearch, setResultSearch] = useState('');
  const cleanText = (value) => {
    const cleaned = String(value || '').replace(/\bdemo\s*/gi, '').trim();
    return cleaned ? cleaned.charAt(0).toLocaleUpperCase(isVi ? 'vi-VN' : 'en-US') + cleaned.slice(1) : '';
  };
  const formatDate = (value) => {
    if (!value) return '—';
    const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}`;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };
  const courseNames = useMemo(() => [...new Set(results.map((item) => cleanText(item.className)).filter(Boolean))], [results]);
  const visibleResults = useMemo(() => results.filter((item) => (courseFilter === 'all' || cleanText(item.className) === courseFilter) && (!resultSearch.trim() || `${item.className || ''} ${item.content || ''} ${item.coachName || ''}`.toLocaleLowerCase().includes(resultSearch.trim().toLocaleLowerCase()))).sort((a, b) => String(b.sessionDate || '').localeCompare(String(a.sessionDate || ''))), [results, courseFilter, resultSearch]);

  const refresh = useCallback(async () => {
    if (!validMember) {
      setPlans([]);
      setResults([]);
      setEvaluations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [planResult, resultResult, evalResult] = await Promise.allSettled([
        getMemberTrainingPlans(memberId),
        getMemberTrainingResults(memberId),
        getMemberEvaluations(memberId),
      ]);
      if (planResult.status === 'rejected' && resultResult.status === 'rejected' && evalResult.status === 'rejected') {
        throw planResult.reason;
      }
      setPlans(planResult.status === 'fulfilled' && Array.isArray(planResult.value) ? planResult.value : []);
      setResults(resultResult.status === 'fulfilled' && Array.isArray(resultResult.value) ? resultResult.value : []);
      setEvaluations(evalResult.status === 'fulfilled' && Array.isArray(evalResult.value) ? evalResult.value : []);
      if (planResult.status === 'rejected' || resultResult.status === 'rejected') {
        setError(
          isVi
            ? 'Một số dữ liệu tập luyện chưa được cấp quyền truy cập. Các mục khả dụng vẫn được hiển thị đầy đủ.'
            : 'Access to some training data is restricted. Available data is displayed.',
        );
      }
    } catch (err) {
      setPlans([]);
      setResults([]);
      setEvaluations([]);
      setError(getErrorMessage(err, 'Không thể tải thông tin tập luyện.'));
    } finally {
      setLoading(false);
    }
  }, [isVi, memberId, validMember]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSelectPlan = async (plan) => {
    const id = plan?.planId || plan?.id;
    if (!id) {
      setSelectedPlan(plan);
      return;
    }
    try {
      const detail = await getTrainingPlanById(id);
      setSelectedPlan(detail || plan);
    } catch {
      setSelectedPlan(plan);
    }
  };

  return (
    <main className="w-full space-y-6 px-6 py-6">
      <PageHeader
        title={isVi ? 'Tiến độ tập luyện' : 'Training progress'}
        description={isVi ? 'Kế hoạch từ huấn luyện viên, kết quả từng buổi tập và đánh giá định kỳ.' : 'Coach plans, session results, and periodic evaluations.'}
        actions={
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            {isVi ? 'Tải lại' : 'Refresh'}
          </button>
        }
      />
      {!validMember && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isVi ? 'Tài khoản chưa được liên kết với hồ sơ hội viên.' : 'This account is not linked to a member profile.'}
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: isVi ? 'Giáo án đang áp dụng' : 'Current training plans', value: plans.length, Icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
          { label: isVi ? 'Buổi tập đã ghi nhận' : 'Recorded sessions', value: results.length, Icon: Activity, tone: 'bg-emerald-50 text-emerald-700' },
          { label: isVi ? 'Điểm đánh giá TB / Định kỳ' : 'Average periodic score', value: evaluations.length ? (evaluations.reduce((sum, item) => sum + Number(item.progressScore || 0), 0) / evaluations.length).toFixed(1) : '—', Icon: Award, tone: 'bg-violet-50 text-violet-700' },
        ].map(({ label, value, Icon, tone }) => <article key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><span className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-2xl font-extrabold text-slate-900">{value}</p></div></article>)}
      </section>
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">{isVi ? 'Đang tải…' : 'Loading…'}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <section className="space-y-6 lg:col-span-5">
              <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-brand-teal-dark" />
                <h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Kế hoạch huấn luyện' : 'Training plans'}</h2>
              </div>
              {plans.length ? (
                plans.map((p) => (
                  <article key={p.planId || p.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{cleanText(p.title) || (isVi ? 'Kế hoạch tập luyện' : 'Training plan')}</h3>
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(p)}
                        className="text-xs font-semibold text-brand-primary hover:underline cursor-pointer shrink-0"
                      >
                        {isVi ? 'Xem chi tiết' : 'View details'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.className || ''} {p.coachName ? `· ${p.coachName}` : ''}
                    </p>
                    {p.goal && (
                      <p className="mt-3 text-sm">
                        <strong>{isVi ? 'Mục tiêu: ' : 'Goal: '}</strong>
                        {p.goal}
                      </p>
                    )}
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {cleanText(p.content) || (isVi ? 'Chưa có nội dung chi tiết.' : 'No details yet.')}
                    </p>
                    {(p.startDate || p.endDate) && (
                      <p className="mt-3 text-xs text-slate-500">
                        {p.startDate || '—'} – {p.endDate || '—'}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <Empty text={isVi ? 'Huấn luyện viên chưa giao kế hoạch.' : 'No coach plan assigned yet.'} />
              )}
              </div>
              <section className="space-y-3">
                <div className="flex items-center gap-2"><Award className="h-5 w-5 text-brand-teal-dark" /><h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Đánh giá định kỳ từ Huấn luyện viên' : 'Periodic Coach Evaluations'}</h2></div>
                {evaluations.length ? evaluations.map((ev) => <article key={ev.evaluationId || ev.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-500">{ev.evaluationDate || '—'}</span>{ev.progressScore != null && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800">{Number(ev.progressScore).toFixed(1)} / 10</span>}</div>{ev.progressScore != null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, Math.max(0, Number(ev.progressScore) * 10))}%` }} /></div>}<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{cleanText(ev.comment || ev.comments || ev.feedback)}</p><p className="mt-3 text-xs text-slate-500">{ev.coachName || (isVi ? 'Huấn luyện viên' : 'Coach')}</p></article>) : <Empty text={isVi ? 'Chưa có đánh giá định kỳ từ huấn luyện viên.' : 'No periodic coach evaluations yet.'} />}
              </section>
            </section>
            <section className="space-y-3 lg:col-span-7">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-teal-dark" />
                <h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Kết quả tập luyện' : 'Session results'}</h2>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center">
                <label className="relative block sm:w-64"><Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><select aria-label={isVi ? 'Lọc theo khóa học' : 'Filter by course'} value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-7 text-xs font-semibold text-slate-700 hover:bg-white focus:border-blue-500 focus:outline-none"><option value="all">{isVi ? 'Tất cả khóa học' : 'All courses'}</option>{courseNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                <label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={resultSearch} onChange={(event) => setResultSearch(event.target.value)} placeholder={isVi ? 'Tìm kết quả...' : 'Search results...'} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none hover:bg-white focus:border-blue-500" /></label>
                {(courseFilter !== 'all' || resultSearch.trim()) && <button type="button" onClick={() => { setCourseFilter('all'); setResultSearch('') }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"><X className="h-3.5 w-3.5" />{isVi ? 'Xóa lọc' : 'Clear'}</button>}
              </div>
              {visibleResults.length ? (
                <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">{visibleResults.map((r) => (
                  <article key={r.resultId || r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                    <div className="flex justify-between gap-3">
                      <h3 className="font-bold text-slate-900">{cleanText(r.className) || (isVi ? 'Buổi tập' : 'Training session')}</h3>
                      <span className="text-xs text-slate-500">{r.sessionDate ? new Date(r.sessionDate).toLocaleDateString(isVi ? 'vi-VN' : 'en-GB') : ''}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{cleanText(r.content) || '—'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {r.coachName || (isVi ? 'Huấn luyện viên' : 'Coach')}
                      </span>
                      {r.attendanceStatus && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${String(r.attendanceStatus).toLowerCase() === 'present' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>• {String(r.attendanceStatus).toLowerCase() === 'present' ? (isVi ? 'Có mặt' : 'Present') : (isVi ? 'Vắng mặt' : 'Absent')}</span>
                      )}
                    </div>
                  </article>
                ))}</div>
              ) : (
                <Empty text={isVi ? 'Chưa có kết quả tập luyện được ghi nhận.' : 'No training results recorded yet.'} />
              )}
            </section>
          </div>

        </div>
      )}

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="training-plan-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">{cleanText(selectedPlan.className || selectedPlan.subjectName || (isVi ? 'Giáo án huấn luyện' : 'Training plan'))}</span>
                <h2 id="training-plan-title" className="mt-2 text-xl font-extrabold text-slate-900">{cleanText(selectedPlan.title) || (isVi ? 'Chi tiết kế hoạch tập luyện' : 'Training plan details')}</h2>
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><UserRound className="h-4 w-4 text-slate-500"/><span className="font-semibold text-slate-700">{cleanText(selectedPlan.coachName) || (isVi ? 'Huấn luyện viên' : 'Coach')}</span></div>
              </div>
              <button type="button" aria-label={isVi ? 'Đóng' : 'Close'} onClick={() => setSelectedPlan(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base font-bold text-slate-600 hover:bg-slate-100">×</button>
            </header>
            <div className="overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isVi ? 'Mục tiêu' : 'Objectives'}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{cleanText(selectedPlan.goal) || (isVi ? 'Chưa có mục tiêu cụ thể.' : 'No objective provided.')}</p></section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isVi ? 'Lịch tập & thời lượng' : 'Schedule & duration'}</p><p className="mt-2 text-sm font-semibold text-slate-800">{[selectedPlan.startDate, selectedPlan.endDate].filter(Boolean).map(formatDate).join(' – ') || (isVi ? 'Theo lịch khóa học' : 'According to course schedule')}</p>{selectedPlan.duration && <p className="mt-1 text-xs text-slate-600">{cleanText(selectedPlan.duration)}</p>}</section>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isVi ? 'Bài tập & các giai đoạn' : 'Exercises & phases'}</p><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{cleanText(selectedPlan.content) || '—'}</div></section>
                <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:col-span-2"><p className="text-xs font-bold uppercase tracking-wide text-amber-900">{isVi ? 'Ghi chú từ Huấn luyện viên' : 'Coach notes'}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{cleanText(selectedPlan.coachNotes || selectedPlan.notes) || (isVi ? 'Chưa có ghi chú.' : 'No notes provided.')}</p></section>
              </div>
            </div>
            <footer className="flex justify-end border-t border-slate-200 bg-white px-6 py-4"><button type="button" onClick={() => setSelectedPlan(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{isVi ? 'Đóng' : 'Close'}</button></footer>
          </div>
        </div>
      )}
    </main>
  );
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

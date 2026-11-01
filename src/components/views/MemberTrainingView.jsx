import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Award, ClipboardList, RefreshCw, UserRound } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberTrainingPlans, getMemberTrainingResults, getMemberEvaluations, getTrainingPlanById } from '../../api/memberPortalApi';
import { getAuthoritativeProfileId } from '../../utils/memberSafetyHelpers';
import { getErrorMessage } from '../../api/apiErrors';

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
            ? 'Một số dữ liệu tập luyện không được backend cho phép tải. Các mục còn quyền truy cập vẫn được hiển thị.'
            : 'The backend denied access to some training data. Available data is still shown.',
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
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-teal-dark">VIBE SPORT · MEMBER</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{isVi ? 'Tiến độ tập luyện' : 'Training progress'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {isVi
              ? 'Kế hoạch từ huấn luyện viên, kết quả từng buổi tập và đánh giá định kỳ.'
              : 'Coach plans, session results, and periodic evaluations.'}
          </p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          {isVi ? 'Tải lại' : 'Refresh'}
        </button>
      </header>
      {!validMember && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isVi ? 'Tài khoản chưa được liên kết với hồ sơ hội viên.' : 'This account is not linked to a member profile.'}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {loading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">{isVi ? 'Đang tải…' : 'Loading…'}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-brand-teal-dark" />
                <h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Kế hoạch huấn luyện' : 'Training plans'}</h2>
              </div>
              {plans.length ? (
                plans.map((p) => (
                  <article key={p.planId || p.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900">{p.title || (isVi ? 'Kế hoạch tập luyện' : 'Training plan')}</h3>
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
                      {p.content || (isVi ? 'Chưa có nội dung chi tiết.' : 'No details yet.')}
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
            </section>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-brand-teal-dark" />
                <h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Kết quả tập luyện' : 'Session results'}</h2>
              </div>
              {results.length ? (
                results.map((r) => (
                  <article key={r.resultId || r.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex justify-between gap-3">
                      <h3 className="font-bold text-slate-900">{r.className || (isVi ? 'Buổi tập' : 'Training session')}</h3>
                      <span className="text-xs text-slate-500">{r.sessionDate || ''}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{r.content || '—'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {r.coachName || (isVi ? 'Huấn luyện viên' : 'Coach')}
                      </span>
                      {r.attendanceStatus && (
                        <span>
                          {isVi ? 'Điểm danh:' : 'Attendance:'} {r.attendanceStatus}
                        </span>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <Empty text={isVi ? 'Chưa có kết quả tập luyện được ghi nhận.' : 'No training results recorded yet.'} />
              )}
            </section>
          </div>

          {/* Periodic Coach Evaluations (GET /api/evaluations?memberId=...) */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-brand-teal-dark" />
              <h2 className="text-lg font-extrabold text-slate-900">
                {isVi ? 'Đánh giá định kỳ từ Huấn luyện viên' : 'Periodic Coach Evaluations'}
              </h2>
            </div>
            {evaluations.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {evaluations.map((ev) => (
                  <article key={ev.evaluationId || ev.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-500">{ev.evaluationDate || '—'}</span>
                      {ev.progressScore != null && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                          {isVi ? 'Điểm tiến độ:' : 'Score:'} {ev.progressScore}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {ev.comment || ev.comments || ev.feedback || '—'}
                    </p>
                    <p className="mt-3 text-xs text-slate-500 inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      {ev.coachName || (isVi ? 'Huấn luyện viên' : 'Coach')}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty text={isVi ? 'Chưa có đánh giá định kỳ từ huấn luyện viên.' : 'No periodic coach evaluations yet.'} />
            )}
          </section>
        </div>
      )}

      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {selectedPlan.title || (isVi ? 'Chi tiết kế hoạch tập luyện' : 'Training Plan Details')}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {isVi ? 'Đóng' : 'Close'}
              </button>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              {selectedPlan.goal && (
                <p>
                  <strong>{isVi ? 'Mục tiêu: ' : 'Goal: '}</strong>
                  {selectedPlan.goal}
                </p>
              )}
              <p className="whitespace-pre-wrap leading-6">{selectedPlan.content || '—'}</p>
              <p className="text-xs text-slate-500 pt-2">
                {selectedPlan.coachName ? `HLV: ${selectedPlan.coachName} · ` : ''}
                {selectedPlan.startDate || '—'} – {selectedPlan.endDate || '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

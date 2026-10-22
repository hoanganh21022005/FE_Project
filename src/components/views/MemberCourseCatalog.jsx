import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberSubjectCatalog } from '../../api/subjectCatalogApi';
import { getClassSessions, hasScheduledClassSession } from '../../api/memberPortalApi';
import { getErrorMessage } from '../../api/apiErrors';
import { CalendarDays, Check, Clock3, Dumbbell, LoaderCircle, RefreshCw, Users, UserRound, X } from 'lucide-react';

const COURSE_TYPES = {
  Normal: {
    vi: 'Normal · Học nhóm',
    en: 'Normal · Group',
    detailVi: 'Lịch học theo thông tin lớp do trung tâm công bố.',
    detailEn: 'Class schedule follows the details published by the center.',
  },
  Advanced: {
    vi: 'Advanced · Huấn luyện 1:1',
    en: 'Advanced · Personal 1:1',
    detailVi: '12 credit · Hạn dùng 45 ngày tính từ khi thanh toán thành công.',
    detailEn: '12 credits · Valid for 45 days from successful payment.',
  },
};

const SPORTS = [
  { key: 'tennis', name: 'Quần vợt (Tennis)', en: 'Tennis', aliases: ['quan vot', 'tennis'] },
  { key: 'swimming', name: 'Bơi lội', en: 'Swimming', aliases: ['boi loi', 'swimming'] },
  { key: 'pickleball', name: 'Pickleball', en: 'Pickleball', aliases: ['pickleball'] },
  { key: 'archery', name: 'Bắn cung', en: 'Archery', aliases: ['ban cung', 'archery'] },
  { key: 'basketball', name: 'Bóng rổ', en: 'Basketball', aliases: ['bong ro', 'basketball'] },
  { key: 'football', name: 'Bóng đá', en: 'Football', aliases: ['bong da', 'football', 'soccer'] },
  { key: 'volleyball', name: 'Bóng chuyền', en: 'Volleyball', aliases: ['bong chuyen', 'volleyball'] },
  { key: 'badminton', name: 'Cầu lông', en: 'Badminton', aliases: ['cau long', 'badminton'] },
  { key: 'table-tennis', name: 'Bóng bàn', en: 'Table tennis', aliases: ['bong ban', 'table tennis', 'ping pong'] },
];

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const money = (amount, language) => amount == null || !Number.isFinite(Number(amount))
  ? (language === 'vi' ? 'Chưa có thông tin giá' : 'Price unavailable')
  : `${Number(amount).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} ${language === 'vi' ? '₫' : 'VND'}`;

function matchSport(subject) {
  const name = normalize(`${subject?.name || ''} ${subject?.slug || ''}`);
  return SPORTS.find((sport) => sport.aliases.some((alias) => name.includes(alias)));
}

function apiClassType(value) {
  const normalized = normalize(value || 'normal');
  return normalized.includes('advanced') || normalized.includes('1 1') ? 'Advanced' : 'Normal';
}

export function MemberCourseCatalog() {
  const { classes, currentUser, bookClass, reloadClasses, showToast, language } = useSCMS();
  const isVi = language === 'vi';
  const [courseType, setCourseType] = useState('Normal');
  const [selectedSport, setSelectedSport] = useState(SPORTS[0].key);
  const [subjects, setSubjects] = useState([]);
  const [subjectError, setSubjectError] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [refreshingClasses, setRefreshingClasses] = useState(false);
  const [classSessions, setClassSessions] = useState([]);
  const [sessionError, setSessionError] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    setSubjectError('');
    try {
      setSubjects(await getMemberSubjectCatalog());
    } catch (error) {
      setSubjectError(getErrorMessage(error, isVi ? 'Không tải được danh sách môn.' : 'Could not load sports.'));
    } finally {
      setLoadingSubjects(false);
    }
  }, [isVi]);

  const refreshClasses = useCallback(async () => {
    if (typeof reloadClasses !== 'function') return;
    setRefreshingClasses(true);
    try {
      await reloadClasses();
    } finally {
      setRefreshingClasses(false);
    }
  }, [reloadClasses]);

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      setClassSessions(await getClassSessions());
      setSessionError('');
    } catch (error) {
      setSessionError(getErrorMessage(error, isVi ? 'Không xác minh được lịch buổi học.' : 'Could not verify scheduled sessions.'));
    } finally {
      setLoadingSessions(false);
    }
  }, [isVi]);

  useEffect(() => { refreshSubjects(); }, [refreshSubjects]);
  useEffect(() => { refreshClasses(); }, [refreshClasses]);
  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const liveSports = useMemo(() => {
    const bestBySport = new Map();
    subjects.forEach((subject) => {
      const sport = matchSport(subject);
      if (!sport) return;
      const previous = bestBySport.get(sport.key);
      const score = Number(subject.normalPrice > 0 || subject.advancedPrice > 0) * 4
        + Number(Boolean(subject.slug)) * 2
        + Number(subject.id || 0) / 1000;
      const previousScore = previous
        ? Number(previous.normalPrice > 0 || previous.advancedPrice > 0) * 4
          + Number(Boolean(previous.slug)) * 2
          + Number(previous.id || 0) / 1000
        : -1;
      if (score > previousScore) bestBySport.set(sport.key, subject);
    });
    return SPORTS.map((sport) => {
      const subject = bestBySport.get(sport.key);
      return {
        ...sport,
        id: subject?.id ?? null,
        description: subject?.description || '',
        normal: subject?.normalPrice ?? null,
        advanced: subject?.advancedPrice ?? null,
      };
    });
  }, [subjects]);

  const activeSport = liveSports.find((sport) => sport.key === selectedSport) || liveSports[0];
  const memberId = Number(currentUser?.memberId);
  const matchingClasses = useMemo(() => (classes || []).filter((item) => {
    if (item.status !== 'published') return false;
    if (!hasScheduledClassSession(item.id, classSessions)) return false;
    if (apiClassType(item.classType) !== courseType) return false;
    const sameSubject = activeSport?.id != null && String(item.subjectId) === String(activeSport.id);
    const searchableName = normalize(`${item.category || ''} ${item.name || ''} ${item.subjectName || ''}`);
    const sameName = [activeSport?.en, activeSport?.name, ...(activeSport?.aliases || [])]
      .filter(Boolean)
      .some((alias) => searchableName.includes(normalize(alias)));
    return sameSubject || sameName;
  }), [classes, activeSport, courseType, classSessions]);

  const handleEnroll = async () => {
    if (!selectedClass || submitting) return;
    setSubmitting(true);
    try {
      if (!Number.isInteger(memberId) || memberId <= 0) {
        throw new Error(isVi ? 'Tài khoản chưa liên kết hồ sơ hội viên; chưa thể đăng ký khóa học.' : 'This account is not linked to a member profile yet.');
      }
      const result = await bookClass(selectedClass.id, memberId);
      if (result?.success === false) throw new Error(result.message || (isVi ? 'Không thể đăng ký khóa học.' : 'Could not enroll.'));
      showToast?.(isVi ? 'Đã gửi đăng ký khóa học.' : 'Enrollment submitted.');
      setSelectedClass(null);
      await refreshClasses();
    } catch (error) {
      showToast?.(getErrorMessage(error, isVi ? 'Không thể đăng ký khóa học.' : 'Could not enroll.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const course = COURSE_TYPES[courseType];
  const selectedPrice = activeSport?.[courseType === 'Normal' ? 'normal' : 'advanced'];

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-7 sm:py-8">
      <header className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">VIBE SPORT · MEMBER</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{isVi ? 'Chọn khóa học của bạn' : 'Choose your course'}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {isVi ? 'Khám phá 9 môn thể thao, xem học phí theo loại khóa và chọn lớp phù hợp.' : 'Explore nine sports, compare course fees and find a class that fits.'}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs text-slate-200">
            <Dumbbell className="h-4 w-4 text-red-300" />
            <span>{isVi ? 'Dữ liệu môn học đồng bộ từ hệ thống' : 'Sports synced from the system'}</span>
          </div>
        </div>
      </header>

      <section aria-label={isVi ? 'Loại khóa học' : 'Course type'} className="grid gap-3 md:grid-cols-2">
        {Object.entries(COURSE_TYPES).map(([type, details]) => {
          const active = courseType === type;
          return (
            <button key={type} type="button" onClick={() => setCourseType(type)} className={`rounded-xl border p-4 text-left transition ${active ? 'border-red-700 bg-red-50 shadow-sm ring-1 ring-red-700' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
              <span className="flex items-center justify-between gap-3">
                <strong className="text-base font-extrabold text-slate-900">{isVi ? details.vi : details.en}</strong>
                {active && <Check className="h-5 w-5 text-red-700" />}
              </span>
              <span className="mt-1 block text-xs text-slate-600">{isVi ? details.detailVi : details.detailEn}</span>
            </button>
          );
        })}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{isVi ? 'Học phí theo môn' : 'Tuition by sport'}</h2>
            <p className="mt-1 text-sm text-slate-500">{isVi ? course.detailVi : course.detailEn}</p>
          </div>
          <button type="button" onClick={refreshSubjects} disabled={loadingSubjects} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${loadingSubjects ? 'animate-spin' : ''}`} />{isVi ? 'Tải lại' : 'Refresh'}
          </button>
        </div>
        {subjectError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{isVi ? 'Không tải được dữ liệu môn học từ API; học phí sẽ hiển thị khi có dữ liệu.' : 'Could not load sports from the API; fees will appear when data is available.'} <span className="block text-xs opacity-80">{subjectError}</span></div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {liveSports.map((sport) => {
            const price = sport[courseType === 'Normal' ? 'normal' : 'advanced'];
            const active = sport.key === selectedSport;
            return (
              <button key={sport.key} type="button" onClick={() => setSelectedSport(sport.key)} className={`rounded-xl border p-4 text-left transition ${active ? 'border-slate-900 bg-slate-950 text-white shadow-md' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400'}`}>
                <span className="flex items-start justify-between gap-3">
                  <span><span className={`block text-[10px] font-bold uppercase tracking-widest ${active ? 'text-red-300' : 'text-slate-400'}`}>{sport.en}</span><strong className="mt-1 block text-base font-extrabold">{sport.name}</strong></span>
                  <Dumbbell className={`h-5 w-5 shrink-0 ${active ? 'text-red-300' : 'text-slate-400'}`} />
                </span>
                <span className={`mt-4 block text-xl font-black tabular-nums ${active ? 'text-red-300' : 'text-red-700'}`}>{money(price, language)}</span>
                <span className={`mt-1 block text-xs ${active ? 'text-slate-300' : 'text-slate-500'}`}>{courseType}</span>
              </button>
            );
          })}
        </div>
        {loadingSubjects && <p className="text-xs text-slate-500">{isVi ? 'Đang đồng bộ danh sách môn...' : 'Syncing sports...'}</p>}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-700">{courseType} · {activeSport?.name}</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">{isVi ? 'Lớp đang mở' : 'Available classes'}</h2>
            <p className="mt-1 text-sm text-slate-500">{isVi ? 'Học phí tham khảo' : 'Listed tuition'}: <strong className="text-slate-800">{money(selectedPrice, language)}</strong></p>
          </div>
          <button type="button" onClick={refreshClasses} disabled={refreshingClasses} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:self-auto">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshingClasses ? 'animate-spin' : ''}`} />{isVi ? 'Cập nhật lớp' : 'Refresh classes'}
          </button>
        </div>
        {sessionError && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{isVi ? 'Không thể xác minh buổi học từ API. Lớp chưa được xác minh sẽ không xuất hiện trong danh sách đăng ký.' : 'Could not verify sessions from the API. Classes without verified sessions are hidden from enrollment.'} <span className="block text-xs opacity-80">{sessionError}</span></div>}
        {matchingClasses.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {matchingClasses.map((item) => {
              const capacity = Number(item.capacity);
              const enrolled = Number(item.enrolledCount || 0);
              const isFull = Number.isFinite(capacity) && capacity > 0 && enrolled >= capacity;
              const itemPrice = item.price ?? selectedPrice;
              return (
                <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div><h3 className="font-bold text-slate-900">{item.name || activeSport?.name}</h3><p className="mt-1 text-xs text-slate-500">{item.coachName || (isVi ? 'HLV chưa phân công' : 'Coach to be assigned')}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isFull ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{isFull ? (isVi ? 'Đã đủ chỗ' : 'Full') : (isVi ? 'Đang mở' : 'Open')}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-red-700" />{item.startDate || (isVi ? 'Chưa có lịch' : 'Schedule pending')}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-red-700" />{item.totalSessions ?? '—'} {isVi ? 'buổi' : 'sessions'}</span>
                    <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-red-700" />{item.enrolledCount ?? '—'}/{item.capacity ?? '—'}</span>
                    <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5 text-red-700" />{courseType === 'Advanced' ? '1:1' : (isVi ? 'Học nhóm' : 'Group')}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <strong className="text-sm font-extrabold text-red-700">{money(itemPrice, language)}</strong>
                    <button type="button" disabled={isFull || submitting || !Number.isInteger(memberId) || memberId <= 0} onClick={() => setSelectedClass(item)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300">{isVi ? 'Chọn khóa' : 'Select course'}</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <Dumbbell className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 text-sm font-bold text-slate-800">{loadingSessions ? (isVi ? 'Đang xác minh lịch buổi học…' : 'Verifying scheduled sessions…') : (isVi ? 'Chưa có lớp đang mở kèm buổi học đã xác nhận' : 'No open class with confirmed sessions yet')}</p>
            <p className="mt-1 text-xs text-slate-500">{isVi ? 'Lớp chỉ xuất hiện sau khi Backend trả về buổi học đã xếp lịch.' : 'Classes appear after the Backend returns scheduled sessions.'}</p>
          </div>
        )}
      </section>

      {selectedClass && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setSelectedClass(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="enroll-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><span className="text-xs font-bold uppercase tracking-widest text-red-700">{courseType}</span><h2 id="enroll-title" className="mt-1 text-lg font-extrabold text-slate-900">{isVi ? 'Xác nhận chọn khóa' : 'Confirm course selection'}</h2></div><button type="button" onClick={() => setSelectedClass(null)} disabled={submitting} aria-label={isVi ? 'Đóng' : 'Close'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
          <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold text-slate-900">{selectedClass.name || activeSport?.name}</p><p className="text-xs text-slate-600">{isVi ? 'Môn' : 'Sport'}: {activeSport?.name}</p><p className="text-xs text-slate-600">{isVi ? 'Học phí' : 'Tuition'}: <strong>{money(selectedClass.price ?? selectedPrice, language)}</strong></p><p className="text-xs text-slate-600">{isVi ? course.detailVi : course.detailEn}</p></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelectedClass(null)} disabled={submitting} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{isVi ? 'Để sau' : 'Cancel'}</button><button type="button" onClick={handleEnroll} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{isVi ? 'Gửi đăng ký' : 'Submit enrollment'}</button></div>
        </section>
      </div>}
    </main>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberSubjectCatalog } from '../../api/subjectCatalogApi';
import { getErrorMessage } from '../../api/apiErrors';
import { COURSE_HERO_MEDIA, SPORT_MEDIA, recommendSports } from '../../data/memberCourseCatalog.js';
import { CalendarDays, Check, Clock3, Dumbbell, LoaderCircle, MapPin, RefreshCw, Search, Users, UserRound, X, ChevronDown, Sparkles, Bell, SlidersHorizontal } from 'lucide-react';

const COURSE_TYPES = {
  Normal: { title: 'Normal · Học nhóm', en: 'Normal · Group', detail: 'Lịch cố định · 12 buổi · Tối đa 15 học viên', detailEn: 'Fixed schedule · 12 sessions · Up to 15 members', fit: 'courseCatalogGroupFit', sessions: 12 },
  Advanced: { title: 'Advanced · Huấn luyện 1:1', en: 'Advanced · Personal 1:1', detail: '12 buổi · 90 phút/buổi · Hạn dùng 45 ngày', detailEn: '12 sessions · 90 minutes each · Valid for 45 days', fit: 'courseCatalogCoachFit', sessions: 12 },
};
const SPORTS = [
  { key: 'tennis', name: 'Quần vợt', en: 'Tennis', normal: 2500000, advanced: 8000000, aliases: ['quan vot', 'tennis'], setting: 'outdoor', type: 'group' },
  { key: 'swimming', name: 'Bơi lội', en: 'Swimming', normal: 1500000, advanced: 4500000, aliases: ['boi loi', 'swimming'], setting: 'indoor', type: 'individual' },
  { key: 'pickleball', name: 'Pickleball', en: 'Pickleball', normal: 1800000, advanced: 5000000, aliases: ['pickleball'], setting: 'outdoor', type: 'group' },
  { key: 'archery', name: 'Bắn cung', en: 'Archery', normal: 2000000, advanced: 6000000, aliases: ['ban cung', 'archery'], setting: 'outdoor', type: 'individual' },
  { key: 'basketball', name: 'Bóng rổ', en: 'Basketball', normal: 1200000, advanced: 3500000, aliases: ['bong ro', 'basketball'], setting: 'indoor', type: 'group' },
  { key: 'football', name: 'Bóng đá', en: 'Football', normal: 1000000, advanced: 3500000, aliases: ['bong da', 'football', 'soccer'], setting: 'outdoor', type: 'group' },
  { key: 'volleyball', name: 'Bóng chuyền', en: 'Volleyball', normal: 1000000, advanced: 3500000, aliases: ['bong chuyen', 'volleyball'], setting: 'indoor', type: 'group' },
  { key: 'badminton', name: 'Cầu lông', en: 'Badminton', normal: 900000, advanced: 3000000, aliases: ['cau long', 'badminton'], setting: 'indoor', type: 'group' },
  { key: 'table-tennis', name: 'Bóng bàn', en: 'Table tennis', normal: 800000, advanced: 2500000, aliases: ['bong ban', 'table tennis', 'ping pong'], setting: 'indoor', type: 'group' },
];
const DEMO_CLASSES = [
  { id: 'demo-tennis', name: 'Tennis · Lớp cơ bản', category: 'Tennis', classType: 'Normal', status: 'published', coachName: 'Minh Anh', startDate: 'Thứ 2 · 18:00', room: 'Sân Tennis A', totalSessions: 12, capacity: 15, enrolledCount: 6 },
  { id: 'demo-pickleball', name: 'Pickleball · Lớp tối', category: 'Pickleball', classType: 'Normal', status: 'published', coachName: 'Quốc Bảo', startDate: 'Thứ 4 · 19:00', room: 'Sân Pickleball 2', totalSessions: 12, capacity: 15, enrolledCount: 13 },
  { id: 'demo-badminton', name: 'Badminton · Lớp cuối tuần', category: 'Badminton', classType: 'Normal', status: 'published', coachName: 'Thu Hà', startDate: 'Thứ 7 · 09:00', room: 'Nhà thi đấu 1', totalSessions: 12, capacity: 15, enrolledCount: 15 },
  { id: 'demo-advanced-tennis', name: 'Tennis · Huấn luyện 1:1', category: 'Tennis', classType: 'Advanced', status: 'published', coachName: 'Minh Anh', startDate: 'Thứ 3 · 17:00', room: 'Sân Tennis B', totalSessions: 12, capacity: 1, enrolledCount: 0 },
];
const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();
const money = (amount) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(Number(amount) || 0))}đ`;
const estimatedPerSession = (amount) => Math.round((Number(amount) || 0) / 12 / 1000) * 1000;
const langSport = (sport, isVi) => isVi ? sport.name : sport.en;
const matchSport = (subject) => {
  const name = normalize(`${subject?.name || ''} ${subject?.slug || ''}`);
  return SPORTS.find((sport) => sport.aliases.some((alias) => name.includes(alias)));
};
const apiClassType = (value) => normalize(value || 'normal').includes('advanced') ? 'Advanced' : 'Normal';
const fill = (value, vars = {}) => String(value).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
let activeSportVideo = null;

function SportCard({ sport, price, perSessionPrice, openClasses, selected, onSelect, toggleNotify, notified, showNoClass, dimUnavailable, isVi, t, reducedMotion }) {
  const rootRef = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const media = SPORT_MEDIA[sport.key] || {};
  const videoAllowed = !reducedMotion && Boolean(media.mp4 || media.webm) && inView && hovered;
  useEffect(() => {
    if (!rootRef.current || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: '80px' });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (videoAllowed) {
      if (activeSportVideo && activeSportVideo !== video) { activeSportVideo.pause(); activeSportVideo.currentTime = 0; }
      activeSportVideo = video;
      video.play().catch(() => {});
    } else { video.pause(); video.currentTime = 0; if (activeSportVideo === video) activeSportVideo = null; }
    return () => { if (activeSportVideo === video) { video.pause(); activeSportVideo = null; } };
  }, [videoAllowed]);
  const scarce = openClasses > 0 && sport.availableSeats != null && sport.availableSeats <= 3;
  return <div ref={rootRef} role="radio" tabIndex={0} aria-checked={selected} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className={`group relative min-h-[250px] cursor-pointer overflow-hidden rounded-2xl border text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl motion-reduce:transform-none motion-reduce:transition-none ${selected ? 'z-10 scale-[1.02] border-red-700 ring-2 ring-red-700 shadow-lg' : 'border-slate-200'} ${dimUnavailable && openClasses === 0 ? 'bg-slate-100' : 'bg-white'}`}>
    <img src={media.poster} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${dimUnavailable && openClasses === 0 ? 'opacity-60 grayscale-[25%]' : 'opacity-100 group-hover:scale-[1.03]'}`} />
    {videoAllowed && <video ref={videoRef} muted loop playsInline preload="none" poster={media.poster} aria-hidden="true" className="absolute inset-0 h-full w-full object-cover"><source src={media.webm || media.mp4} type={media.webm ? 'video/webm' : 'video/mp4'} />{media.webm && media.mp4 && <source src={media.mp4} type="video/mp4" />}</video>}
    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/5" />
    <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
      {showNoClass && openClasses === 0 && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900">{t('courseCatalogNoClasses')}</span>}
      {openClasses > 0 && <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900">{openClasses} {t('courseCatalogOpenClasses')}</span>}
      {selected && <span className="rounded-full bg-red-700 p-1.5 text-white"><Check className="h-4 w-4" /></span>}
      {scarce && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">{fill(t('courseCatalogSeatsLeft'), { count: sport.availableSeats })}</span>}
    </div>
    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
      <strong className="mt-1 block text-lg font-extrabold">{langSport(sport, isVi)}</strong>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div><span className="block text-lg font-black tabular-nums">{money(price)}</span><span className="text-xs text-white">≈ {money(perSessionPrice)}{t('courseCatalogPerSession')}</span></div>
        {showNoClass && openClasses === 0 && <button type="button" aria-label={notified ? t('courseCatalogNotificationOn') : t('courseCatalogNotify')} title={notified ? t('courseCatalogNotificationOn') : t('courseCatalogNotify')} onClick={(event) => { event.stopPropagation(); toggleNotify(); }} className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-2 ${notified ? 'border-white bg-white text-red-700' : 'border-white/80 bg-white/15 text-white hover:bg-white/25'}`}><Bell className={`h-5 w-5 ${notified ? 'fill-current' : ''}`} />{notified && <span className="text-[10px] font-bold">{t('courseCatalogNotificationOn')}</span>}<span className="sr-only">{notified ? t('courseCatalogNotificationOn') : t('courseCatalogNotify')}</span></button>}
      </div>
    </div>
  </div>;
}

export function MemberCourseCatalog() {
  const { classes, currentUser, bookClass, reloadClasses, showToast, language, t } = useSCMS();
  const isVi = language === 'vi';
  const url = new URL(window.location.href);
  const initialTier = url.searchParams.get('tier') === 'advanced' ? 'Advanced' : 'Normal';
  const initialSport = SPORTS.some((item) => item.key === url.searchParams.get('sport')) ? url.searchParams.get('sport') : 'tennis';
  const [courseType, setCourseType] = useState(initialTier);
  const [selectedSport, setSelectedSport] = useState(initialSport);
  const [subjects, setSubjects] = useState([]);
  const [subjectError, setSubjectError] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [refreshingClasses, setRefreshingClasses] = useState(true);
  const [classLoadError, setClassLoadError] = useState(false);
  const [previewState, setPreviewState] = useState('live');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultForm, setConsultForm] = useState({ name: '', phone: '' });
  const [notifiedSports, setNotifiedSports] = useState(() => {
    try { return JSON.parse(localStorage.getItem('member-course-notifications') || '[]'); } catch { return []; }
  });
  const [selectedClass, setSelectedClass] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ type: 'all', setting: 'all', price: 'all' });
  const [sort, setSort] = useState('open');
  const [quizOpen, setQuizOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [quiz, setQuiz] = useState({ goal: 'health', fitness: 'beginner', budget: 'any' });
  const [suggestions, setSuggestions] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const [mobileSheet, setMobileSheet] = useState(false);
  const touchStartY = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const memberId = Number(currentUser?.memberId);
  const tt = useCallback((key) => (typeof t === 'function' ? t(key) : key), [t]);

  const refreshSubjects = useCallback(async () => {
    setLoadingSubjects(true); setSubjectError('');
    try { setSubjects(await getMemberSubjectCatalog()); }
    catch (error) { setSubjectError(getErrorMessage(error, tt('courseCatalogLoadError'))); setSubjects([]); }
    finally { setLoadingSubjects(false); setUpdatedAt(new Date()); }
  }, [tt]);
  const refreshClasses = useCallback(async () => {
    if (typeof reloadClasses !== 'function') return;
    setRefreshingClasses(true);
    try {
      const loaded = await reloadClasses();
      if (loaded === undefined) setClassLoadError(true);
      else setClassLoadError(false);
      setUpdatedAt(new Date());
    }
    catch (error) { setClassLoadError(true); showToast?.(getErrorMessage(error, tt('courseCatalogClassError')), 'error'); }
    finally { setRefreshingClasses(false); }
  }, [reloadClasses, showToast, tt]);
  const refreshSubjectsRef = useRef(refreshSubjects);
  const refreshClassesRef = useRef(refreshClasses);
  refreshSubjectsRef.current = refreshSubjects;
  refreshClassesRef.current = refreshClasses;
  useEffect(() => {
    refreshSubjectsRef.current();
    refreshClassesRef.current();
  }, []);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible') { refreshSubjectsRef.current(); refreshClassesRef.current(); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    query.set('tier', courseType.toLowerCase()); query.set('sport', selectedSport);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${query.toString()}`);
  }, [courseType, selectedSport]);
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      setCourseType(params.get('tier') === 'advanced' ? 'Advanced' : 'Normal');
      if (SPORTS.some((sport) => sport.key === params.get('sport'))) setSelectedSport(params.get('sport'));
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(Boolean(query?.matches || navigator.connection?.saveData));
    update(); query?.addEventListener?.('change', update);
    return () => query?.removeEventListener?.('change', update);
  }, []);

  const catalogClasses = useMemo(() => previewState === 'mixed' ? DEMO_CLASSES : previewState === 'empty' ? [] : (classes || []), [previewState, classes]);
  const liveSports = useMemo(() => {
    const bestBySport = new Map();
    subjects.forEach((subject) => {
      const sport = matchSport(subject); if (!sport) return;
      const old = bestBySport.get(sport.key);
      const score = Number(subject.normalPrice > 0 || subject.advancedPrice > 0) * 4 + Number(Boolean(subject.slug)) * 2 + Number(subject.id || 0) / 1000;
      const oldScore = old ? Number(old.normalPrice > 0 || old.advancedPrice > 0) * 4 + Number(Boolean(old.slug)) * 2 + Number(old.id || 0) / 1000 : -1;
      if (score > oldScore) bestBySport.set(sport.key, subject);
    });
    return SPORTS.map((sport) => {
      const subject = bestBySport.get(sport.key);
      const openClasses = catalogClasses.filter((item) => item.status === 'published' && apiClassType(item.classType) === courseType && ((subject?.id != null && String(item.subjectId) === String(subject.id)) || normalize(`${item.category || ''} ${item.name || ''} ${item.subjectName || ''}`).includes(normalize(sport.en)) || sport.aliases.some((alias) => normalize(`${item.category || ''} ${item.name || ''} ${item.subjectName || ''}`).includes(alias))));
      const capacity = openClasses.reduce((sum, item) => sum + Math.max(0, Number(item.capacity || 0) - Number(item.enrolledCount || 0)), 0);
      // The published fee table is authoritative; the current subject API may contain stale prices.
      return { ...sport, id: subject?.id ?? null, description: subject?.description || '', classes: openClasses, availableSeats: capacity };
    });
  }, [subjects, catalogClasses, courseType]);
  const activeSport = liveSports.find((sport) => sport.key === selectedSport) || liveSports[0];
  const selectedPrice = activeSport?.[courseType === 'Normal' ? 'normal' : 'advanced'] || 0;
  const filteredSports = useMemo(() => {
    const needle = normalize(search);
    let result = liveSports.filter((sport) => (!needle || normalize(`${sport.en} ${sport.name}`).includes(needle)) && (filters.type === 'all' || sport.type === filters.type) && (filters.setting === 'all' || sport.setting === filters.setting) && (filters.price === 'all' || (filters.price === 'low' ? sport[courseType === 'Normal' ? 'normal' : 'advanced'] <= 1200000 : sport[courseType === 'Normal' ? 'normal' : 'advanced'] > 1200000)));
    if (sort === 'price') result = [...result].sort((a, b) => a[courseType === 'Normal' ? 'normal' : 'advanced'] - b[courseType === 'Normal' ? 'normal' : 'advanced']);
    else if (sort === 'popular') result = [...result].sort((a, b) => b.classes.reduce((sum, item) => sum + Number(item.enrolledCount || 0), 0) - a.classes.reduce((sum, item) => sum + Number(item.enrolledCount || 0), 0));
    else result = [...result].sort((a, b) => Number(b.classes.length > 0) - Number(a.classes.length > 0));
    return result;
  }, [liveSports, search, filters, sort, courseType]);
  const activeFilterCount = Number(Boolean(search)) + Number(filters.type !== 'all') + Number(filters.setting !== 'all') + Number(filters.price !== 'all') + Number(sort !== 'open');
  const activeFilters = Boolean(search) || activeFilterCount > 0;
  const matchingClasses = activeSport?.classes || [];
  const allClassesEmpty = liveSports.every((sport) => sport.classes.length === 0);
  const anyClassesOpen = !allClassesEmpty;
  const dimUnavailable = anyClassesOpen && liveSports.some((sport) => sport.classes.length === 0);
  const loadingClasses = refreshingClasses || previewState === 'loading';
  const hasClassError = classLoadError || previewState === 'error';
  const notify = (sportKey) => {
    const key = 'member-course-notifications';
    const subscription = `${courseType}:${sportKey}`;
    let existing = notifiedSports;
    try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch { existing = []; }
    const updated = existing.includes(subscription) ? existing.filter((item) => item !== subscription) : [...existing, subscription];
    localStorage.setItem(key, JSON.stringify(updated)); setNotifiedSports(updated);
    if (updated.includes(subscription)) showToast?.(tt('courseCatalogNotifySaved'), 'success');
  };
  const toggleAllNotifications = () => notify('*');
  const submitConsult = (event) => {
    event.preventDefault();
    if (!consultForm.name.trim() || !consultForm.phone.trim()) return;
    const key = 'member-course-consult-requests';
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch { saved = []; }
    localStorage.setItem(key, JSON.stringify([...saved, { ...consultForm, courseType, sport: selectedSport, createdAt: new Date().toISOString() }]));
    setConsultOpen(false); setConsultForm({ name: '', phone: '' }); showToast?.(tt('courseCatalogConsultSaved'), 'success');
  };
  const saveWaitlist = (item) => {
    const key = 'member-course-waitlist';
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch { saved = []; }
    if (!saved.some((entry) => String(entry.classId) === String(item.id))) localStorage.setItem(key, JSON.stringify([...saved, { classId: item.id, className: item.name, sport: selectedSport, createdAt: new Date().toISOString() }]));
    showToast?.(tt('courseCatalogWaitlistSaved'), 'success');
  };
  const advancedSuggestion = courseType === 'Normal' && catalogClasses.find((item) => item.status === 'published' && apiClassType(item.classType) === 'Advanced' && normalize(`${item.category || ''} ${item.name || ''} ${item.subjectName || ''}`).includes(normalize(activeSport?.en || '')));
  const otherOpenSports = liveSports.filter((sport) => sport.key !== selectedSport && sport.classes.length > 0).map((sport) => langSport(sport, isVi));
  const handleEnroll = async () => {
    if (!selectedClass || submitting) return;
    setSubmitting(true);
    try {
      if (!Number.isInteger(memberId) || memberId <= 0) throw new Error(tt('courseCatalogAccountMissing'));
      const result = await bookClass(selectedClass.id, memberId);
      if (result?.success === false) throw new Error(result.message || tt('courseCatalogLoadError'));
      showToast?.(tt('courseCatalogEnrollmentSuccess'), 'success'); setSelectedClass(null); await refreshClasses();
    } catch (error) { showToast?.(getErrorMessage(error, tt('courseCatalogLoadError')), 'error'); }
    finally { setSubmitting(false); }
  };
  const runQuiz = () => { const choices = recommendSports(quiz); setSuggestions(choices); setQuizOpen(false); };
  const pushChoice = (tier, sportKey) => {
    const query = new URLSearchParams(window.location.search);
    query.set('tier', tier.toLowerCase()); query.set('sport', sportKey);
    window.history.pushState({ courseSelection: true }, '', `${window.location.pathname}?${query.toString()}`);
    setCourseType(tier); setSelectedSport(sportKey);
  };
  const selectSport = (key) => { pushChoice(courseType, key); setMobileSheet(true); };
  const updatedLabel = updatedAt.toLocaleTimeString(isVi ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  const classPanel = <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-live="polite">
    <style>{`@keyframes catalog-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.catalog-shimmer{background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 38%,#f1f5f9 63%);background-size:400% 100%;animation:catalog-shimmer 1.4s ease infinite}@media(prefers-reduced-motion:reduce){.catalog-shimmer{animation:none}}`}</style>
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-red-700">{courseType} · {activeSport?.name}</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">{tt('courseCatalogClassOpened')}</h2><p className="mt-1 text-sm text-slate-500">{tt('courseCatalogIndicativeTuition')}: <strong className="text-slate-800">{money(selectedPrice)}</strong></p></div><button type="button" aria-label={tt('courseCatalogRefresh')} title={tt('courseCatalogRefresh')} onClick={previewState === 'error' ? () => setPreviewState('mixed') : refreshClasses} disabled={loadingClasses} className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loadingClasses ? 'animate-spin' : ''}`} /></button></div>
    {hasClassError ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900"><p className="font-bold">{tt('courseCatalogClassError')}</p><button type="button" onClick={previewState === 'error' ? () => setPreviewState('mixed') : refreshClasses} className="mt-3 min-h-11 rounded-lg bg-white px-4 text-sm font-bold text-red-800 ring-1 ring-red-200">{tt('courseCatalogErrorRetry')}</button></div> : loadingClasses ? <div role="status" className="mt-5 space-y-3"><p className="text-sm font-semibold text-slate-600">{tt('courseCatalogLoadingClasses')}</p>{[0, 1].map((n) => <div key={n} className="overflow-hidden rounded-xl border border-slate-200 p-4"><div className="catalog-shimmer h-4 w-2/5 rounded" /><div className="catalog-shimmer mt-4 h-3 w-1/3 rounded" /><div className="catalog-shimmer mt-5 h-2 rounded" /><div className="catalog-shimmer mt-4 h-8 rounded" /></div>)}</div> : matchingClasses.length ? <div className="mt-4 space-y-3">{matchingClasses.map((item) => {
      const capacity = Number(item.capacity || (courseType === 'Advanced' ? 1 : 15)); const enrolled = Number(item.enrolledCount || 0); const isFull = enrolled >= capacity; const remaining = Math.max(0, capacity - enrolled);
      return <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{item.name || activeSport?.name}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><UserRound className="h-3.5 w-3.5" />{item.coachName || tt('courseCatalogCoachPending')}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isFull ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{isFull ? tt('courseCatalogClassFull') : fill(tt('courseCatalogSeatsLeft'), { count: remaining })}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-700" style={{ width: `${Math.min(100, capacity ? enrolled / capacity * 100 : 0)}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-red-700" />{item.startDate || tt('courseCatalogSchedulePending')}</span><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-red-700" />{item.totalSessions || 12} {isVi ? 'buổi' : 'sessions'}</span><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-red-700" />{item.room || tt('courseCatalogLocationPending')}</span><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-red-700" />{enrolled}/{capacity}</span></div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><strong className="text-sm font-extrabold text-slate-900">{money(selectedPrice)}</strong>{isFull ? <button type="button" onClick={() => saveWaitlist(item)} className="min-h-11 rounded-lg border border-red-700 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">{tt('courseCatalogWaitlist')}</button> : <button type="button" disabled={submitting || !Number.isInteger(memberId) || memberId <= 0} onClick={() => setSelectedClass(item)} className="min-h-11 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-300">{tt('courseCatalogChoose')}</button>}</div></article>;
    })}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center"><Dumbbell className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-bold text-slate-800">{tt('courseCatalogNoClassesTitle')}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-600">{tt('courseCatalogNoClassHelp')}</p>{advancedSuggestion ? <button type="button" onClick={() => pushChoice('Advanced', selectedSport)} className="mt-4 min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">{fill(tt('courseCatalogAdvancedSuggestion'), { sport: activeSport?.name })}</button> : otherOpenSports.length > 0 && <p className="mt-3 text-sm font-semibold text-slate-800">{fill(tt('courseCatalogOtherClassSuggestion'), { sports: otherOpenSports.slice(0, 3).join(', ') })}</p>}<p className="mt-4 text-xs font-semibold text-slate-600">{tt('courseCatalogPolicy')}</p><div className="mt-3 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => notify(activeSport.key)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">{notifiedSports.includes(`${courseType}:${activeSport.key}`) ? tt('courseCatalogNotificationOn') : tt('courseCatalogNotify')}</button><button type="button" onClick={() => setConsultOpen(true)} className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">{tt('courseCatalogConsultTitle')}</button>{otherOpenSports.length > 0 && <button type="button" onClick={() => { const next = liveSports.find((sport) => sport.classes.length > 0); if (next) pushChoice(courseType, next.key); }} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800">{tt('courseCatalogOtherSports')}</button>}</div></div>}
    {matchingClasses.length > 0 && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{tt('courseCatalogPolicy')} · <button type="button" onClick={() => showToast?.(tt('courseCatalogTrialNote'))} className="font-semibold text-red-700 underline">{tt('courseCatalogDetails')}</button></p>}
  </section>;

  return <main className="mx-auto max-w-[1440px] space-y-6 px-4 pb-28 pt-5 sm:px-7 sm:pb-10 sm:pt-7">
    <header className="relative isolate overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-9"><img src={COURSE_HERO_MEDIA.poster} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" />{!reducedMotion && (COURSE_HERO_MEDIA.webm || COURSE_HERO_MEDIA.mp4) && <video muted autoPlay loop playsInline preload="none" poster={COURSE_HERO_MEDIA.poster} aria-hidden="true" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-40"><source src={COURSE_HERO_MEDIA.webm || COURSE_HERO_MEDIA.mp4} type={COURSE_HERO_MEDIA.webm ? 'video/webm' : 'video/mp4'} />{COURSE_HERO_MEDIA.webm && COURSE_HERO_MEDIA.mp4 && <source src={COURSE_HERO_MEDIA.mp4} type="video/mp4" />}</video>}<div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/25" /><div className="max-w-2xl"><span className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">VIBE SPORT · MEMBER</span><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{tt('courseCatalogTitle')}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">{tt('courseCatalogIntro')}</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setConsultOpen(true)} className="rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white shadow hover:bg-red-600">{tt(!loadingClasses && !hasClassError && allClassesEmpty ? 'courseCatalogConsultTitle' : 'courseCatalogTrial')}</button><button type="button" onClick={() => setQuizOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15"><Sparkles className="h-4 w-4" />{tt('courseCatalogQuiz')}</button></div></div></header>

    <div className="sticky top-0 z-20 -mx-4 bg-white/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0"><section aria-label={isVi ? 'Loại khóa học' : 'Course type'} className="grid grid-cols-2 gap-2">{Object.entries(COURSE_TYPES).map(([type, details]) => { const active = courseType === type; const price = Math.min(...SPORTS.map((sport) => sport[type === 'Normal' ? 'normal' : 'advanced'])); return <button key={type} type="button" onClick={() => pushChoice(type, selectedSport)} aria-pressed={active} className={`rounded-xl border p-3 text-left transition sm:p-4 ${active ? 'border-red-700 bg-red-50 ring-1 ring-red-700' : 'border-slate-200 bg-white hover:border-slate-400'}`}><span className="flex items-center justify-between gap-2"><strong className="text-sm font-extrabold text-slate-900 sm:text-base">{isVi ? details.title : details.en}</strong>{active && <Check className="h-4 w-4 shrink-0 text-red-700" />}</span><span className="mt-1 hidden text-xs text-slate-600 sm:block">{isVi ? details.detail : details.detailEn}</span><span className="mt-1 block text-xs font-bold text-red-700">{tt('courseCatalogStartingAt')} {money(price)}</span><span className="mt-1 hidden text-xs text-slate-500 md:block">{tt(details.fit)}</span></button>; })}</section><div className="mt-3 flex justify-center"><button type="button" onClick={() => setCompareOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-slate-400"><SlidersHorizontal className="h-4 w-4" />{tt('courseCatalogCompare')}</button></div></div>
    {!loadingClasses && !hasClassError && allClassesEmpty && <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><p className="font-bold text-slate-900">{fill(tt('courseCatalogNotifyAllTitle'), { tier: courseType })}</p><p className="mt-1 text-sm text-slate-700">{tt('courseCatalogNotifyAllText')}</p></div><button type="button" onClick={toggleAllNotifications} className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">{notifiedSports.includes(`${courseType}:*`) ? tt('courseCatalogNotificationOn') : tt('courseCatalogNotifyAllButton')}</button></section>}
    {import.meta.env.DEV && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2"><span className="text-xs font-bold text-slate-600">{tt('courseCatalogDemo')}</span>{[['live','courseCatalogDemoLive'],['empty','courseCatalogDemoEmpty'],['mixed','courseCatalogDemoMixed'],['loading','courseCatalogDemoLoading'],['error','courseCatalogDemoError']].map(([value,key]) => <button key={value} type="button" onClick={() => { setPreviewState(value); setClassLoadError(false); }} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${previewState === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{tt(key)}</button>)}</div>}

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.9fr)]">
      <section className="space-y-4" aria-labelledby="sport-list-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="sport-list-title" className="text-xl font-extrabold text-slate-900">{isVi ? 'Học phí theo môn' : 'Tuition by sport'}</h2></div><p className="text-xs text-slate-500">{fill(tt('courseCatalogUpdatedAt'), { time: updatedLabel })}</p></div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1"><label className="relative w-52 shrink-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tt('courseCatalogSearch')} className="w-full rounded-full border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-red-600" /></label>
          <span className="shrink-0 text-xs font-semibold text-slate-500">{tt('courseCatalogTrainingForm')}</span>{[['all', tt('courseCatalogAll'), filters.type === 'all' && filters.setting === 'all'], ['group', tt('courseCatalogTeam'), filters.type === 'group'], ['individual', tt('courseCatalogIndividual'), filters.type === 'individual'], ['indoor', tt('courseCatalogIndoor'), filters.setting === 'indoor'], ['outdoor', tt('courseCatalogOutdoor'), filters.setting === 'outdoor']].map(([value, label, active]) => <button key={value} type="button" onClick={() => { if (value === 'all') setFilters({ ...filters, type: 'all', setting: 'all' }); else if (value === 'group' || value === 'individual') setFilters({ ...filters, type: filters.type === value ? 'all' : value }); else setFilters({ ...filters, setting: filters.setting === value ? 'all' : value }); }} className={`min-h-10 shrink-0 rounded-full border px-3 text-xs font-bold ${active ? 'border-red-700 bg-red-50 text-red-800' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}
          <div className="relative shrink-0"><button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><SlidersHorizontal className="h-4 w-4" />{tt('courseCatalogFilterTitle')}{activeFilterCount > 0 && <span className="rounded-full bg-red-700 px-1.5 py-0.5 text-[10px] text-white">{activeFilterCount}</span>}</button>{filtersOpen && <div className="absolute right-0 top-12 z-30 w-64 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl"><label className="block text-xs font-semibold text-slate-700">{tt('courseCatalogPrice')}<select value={filters.price} onChange={(e) => setFilters({ ...filters, price: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="all">{tt('courseCatalogAnyPrice')}</option><option value="low">{tt('courseCatalogPriceUpTo')}</option><option value="high">{tt('courseCatalogPriceOver')}</option></select></label><label className="block text-xs font-semibold text-slate-700">{tt('courseCatalogSort')}<select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="open" disabled={!anyClassesOpen}>{tt('courseCatalogOpenFirst')}</option><option value="price">{tt('courseCatalogPriceLow')}</option><option value="popular">{tt('courseCatalogPopular')}</option></select></label>{activeFilters && <button type="button" onClick={() => { setSearch(''); setFilters({ type: 'all', setting: 'all', price: 'all' }); setSort('open'); }} className="min-h-10 w-full rounded-lg border border-slate-200 text-xs font-bold text-slate-700">{tt('courseCatalogResetFilters')}</button>}</div>}</div>
        </div>
        <div className="sr-only">{tt('courseCatalogTrainingForm')}</div><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-600">{fill(tt('courseCatalogResultCount'), { count: filteredSports.length })}</p>{activeFilters && <button type="button" onClick={() => { setSearch(''); setFilters({ type: 'all', setting: 'all', price: 'all' }); setSort('open'); }} className="text-xs font-bold text-red-700 underline">{tt('courseCatalogResetFilters')}</button>}</div>
        {subjectError && <div role="alert" className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{tt('courseCatalogLoadError')}<button type="button" onClick={refreshSubjects} className="font-bold underline">{tt('courseCatalogErrorRetry')}</button></div>}
        {loadingSubjects && !subjects.length && !subjectError ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{SPORTS.slice(0, 6).map((sport) => <div key={sport.key} className="h-60 animate-pulse rounded-2xl bg-slate-100" />)}</div> : <div role="radiogroup" aria-label={tt('courseCatalogSportGroup')} onKeyDown={(event) => { if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return; event.preventDefault(); const cards = [...event.currentTarget.querySelectorAll('[role="radio"]')]; const index = cards.indexOf(document.activeElement); const next = (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + cards.length) % cards.length; cards[next]?.focus(); cards[next]?.click(); }} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredSports.map((sport) => { const price = sport[courseType === 'Normal' ? 'normal' : 'advanced']; return <SportCard key={sport.key} sport={sport} price={price} perSessionPrice={estimatedPerSession(price)} openClasses={sport.classes.length} selected={sport.key === selectedSport} isVi={isVi} t={tt} reducedMotion={reducedMotion} showNoClass={!allClassesEmpty} dimUnavailable={dimUnavailable} notified={notifiedSports.includes(`${courseType}:${sport.key}`)} onSelect={() => selectSport(sport.key)} toggleNotify={() => notify(sport.key)} />; })}</div>}
        {!filteredSports.length && <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">{tt('courseCatalogNoMatches')}</p>}
      </section>
      <aside className="hidden lg:sticky lg:top-5 lg:block">{classPanel}</aside>
    </div>

    <div className="lg:hidden">{mobileSheet && <div className="fixed inset-0 z-40 bg-slate-950/40" onClick={() => setMobileSheet(false)} role="presentation" />}<div className={`fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl transition-transform duration-200 ${mobileSheet ? 'translate-y-0' : 'translate-y-full'}`} aria-hidden={!mobileSheet} inert={!mobileSheet} onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY; }} onTouchEnd={(event) => { if (touchStartY.current != null && event.changedTouches[0].clientY - touchStartY.current > 70) setMobileSheet(false); touchStartY.current = null; }}><div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300" /><div className="mb-3 flex justify-end"><button type="button" onClick={() => setMobileSheet(false)} aria-label={tt('courseCatalogDismiss')} className="rounded-lg p-2 text-slate-500"><X className="h-5 w-5" /></button></div>{classPanel}</div><div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{activeSport?.name} · {courseType}</p><p className="text-xs text-slate-500">{money(selectedPrice, language)}</p></div><button type="button" onClick={() => setMobileSheet(true)} className="shrink-0 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white">{tt('courseCatalogViewClasses')}</button></div></div></div>

    {consultOpen && <Dialog title={tt('courseCatalogConsultTitle')} onClose={() => setConsultOpen(false)}><form onSubmit={submitConsult} className="space-y-4"><label className="block text-sm font-semibold text-slate-700">{tt('courseCatalogConsultName')}<input required autoComplete="name" value={consultForm.name} onChange={(event) => setConsultForm({ ...consultForm, name: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="block text-sm font-semibold text-slate-700">{tt('courseCatalogConsultPhone')}<input required type="tel" autoComplete="tel" value={consultForm.phone} onChange={(event) => setConsultForm({ ...consultForm, phone: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><p className="text-xs text-slate-500">{tt('courseCatalogConsultLocalNote')}</p><button type="submit" className="min-h-11 w-full rounded-xl bg-red-700 px-4 text-sm font-bold text-white">{tt('courseCatalogConsultSubmit')}</button></form></Dialog>}
    {quizOpen && <Dialog title={tt('courseCatalogQuizTitle')} onClose={() => setQuizOpen(false)}><div className="space-y-4">{[['goal', 'courseCatalogGoal', [['health','courseCatalogHealth'],['weight','courseCatalogWeight'],['competition','courseCatalogCompetition'],['fun','courseCatalogFun']]], ['fitness','courseCatalogFitness',[['beginner','courseCatalogBeginner'],['active','courseCatalogActive']]], ['budget','courseCatalogBudget',[['low','courseCatalogBudgetLow'],['any','courseCatalogBudgetAny']]]].map(([field, label, options]) => <fieldset key={field}><legend className="mb-2 text-sm font-bold text-slate-800">{tt(label)}</legend><div className="flex flex-wrap gap-2">{options.map(([value, key]) => <button key={value} type="button" onClick={() => setQuiz({ ...quiz, [field]: value })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${quiz[field] === value ? 'border-red-700 bg-red-50 text-red-800' : 'border-slate-200 text-slate-700'}`}>{tt(key)}</button>)}</div></fieldset>)}<button type="button" onClick={runQuiz} className="w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white">{tt('courseCatalogGetSuggestion')}</button></div></Dialog>}
    {compareOpen && <Dialog title={tt('courseCatalogCompareTitle')} onClose={() => setCompareOpen(false)}><div className="grid grid-cols-2 gap-3">{Object.entries(COURSE_TYPES).map(([type, detail]) => <div key={type} className="rounded-xl border border-slate-200 p-4"><h3 className="font-extrabold text-slate-900">{isVi ? detail.title : detail.en}</h3><p className="mt-3 text-xs leading-6 text-slate-600">{tt('courseCatalogSessions')}: 12<br />{tt('courseCatalogDuration')}: {type === 'Advanced' ? (isVi ? '90 phút/buổi' : '90 min/session') : (isVi ? 'Theo lịch lớp' : 'Class schedule')}<br />{tt('courseCatalogCapacity')}: {type === 'Advanced' ? '1:1' : '15'}<br />{tt('courseCatalogValidity')}: {type === 'Advanced' ? (isVi ? '45 ngày' : '45 days') : (isVi ? 'Theo lịch khóa' : 'Course schedule')}<br />{tt('courseCatalogStartingAt')} {money(Math.min(...SPORTS.map((sport) => sport[type === 'Normal' ? 'normal' : 'advanced'])), language)}</p></div>)}</div></Dialog>}
    {suggestions.length > 0 && <Dialog title={tt('courseCatalogSuggestion')} onClose={() => setSuggestions([])}><div className="grid gap-3 sm:grid-cols-2">{suggestions.map((key) => { const sport = liveSports.find((item) => item.key === key); if (!sport) return null; return <button key={key} type="button" onClick={() => { setSelectedSport(key); setSuggestions([]); }} className="overflow-hidden rounded-xl border border-slate-200 text-left hover:border-red-700"><img src={SPORT_MEDIA[key].poster} alt="" className="h-28 w-full object-cover" /><span className="block p-3"><strong className="block text-sm">{langSport(sport, isVi)}</strong><span className="text-xs text-slate-500">{isVi ? 'Gợi ý dựa trên mục tiêu và lựa chọn của bạn.' : 'Suggested based on your goals and preferences.'}</span></span></button>; })}</div></Dialog>}
    {selectedClass && <Dialog title={isVi ? 'Xác nhận chọn lớp' : 'Confirm class selection'} onClose={() => !submitting && setSelectedClass(null)}><div className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm"><p className="font-bold">{selectedClass.name || activeSport?.name}</p><p className="text-xs text-slate-600">{langSport(activeSport, isVi)} · {money(selectedPrice, language)}</p><p className="text-xs text-slate-600">{isVi ? COURSE_TYPES[courseType].detail : COURSE_TYPES[courseType].detailEn}</p></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setSelectedClass(null)} disabled={submitting} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700">{isVi ? 'Để sau' : 'Cancel'}</button><button type="button" onClick={handleEnroll} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-60">{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{isVi ? 'Gửi đăng ký' : 'Submit enrollment'}</button></div></Dialog>}
  </main>;
}

function Dialog({ title, onClose, children }) {
  const { t } = useSCMS();
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-extrabold text-slate-900">{title}</h2><button type="button" onClick={onClose} aria-label={typeof t === 'function' ? t('courseCatalogDismiss') : 'Close'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{children}</section></div>;
}

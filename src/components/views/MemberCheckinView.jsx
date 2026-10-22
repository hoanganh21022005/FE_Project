import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Info, QrCode, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { getMemberCheckinCode, getMemberAttendances, getMemberClasses } from '../../api/memberPortalApi';

const getSessions = (enrollment) => {
  const sessions = enrollment.sessions || enrollment.classSessions || enrollment.scheduledSessions;
  return Array.isArray(sessions) ? sessions : [];
};

const toTimestamp = (session) => {
  const date = session.sessionDate || session.date;
  if (!date) return Number.POSITIVE_INFINITY;
  const time = String(session.startTime || '00:00').slice(0, 5);
  const value = new Date(`${String(date).slice(0, 10)}T${time}:00+07:00`).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const getSessionEndTimestamp = (session) => {
  const date = session.sessionDate || session.date;
  if (!date) return toTimestamp(session);
  const time = String(session.endTime || session.startTime || '23:59').slice(0, 5);
  const value = new Date(`${String(date).slice(0, 10)}T${time}:00+07:00`).getTime();
  return Number.isFinite(value) ? value : toTimestamp(session);
};

const isSessionCheckinOpen = (session, now) => {
  return now >= toTimestamp(session) - 30 * 60 * 1000 && now <= getSessionEndTimestamp(session);
};

const getTodayInVietnam = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const attendanceStateLabel = (state, isVi) => {
  const value = String(state || '').toUpperCase();
  if (value.includes('PRESENT') || value.includes('ATTENDED') || value === 'CHECKED_IN') return isVi ? 'Có mặt' : 'Present';
  if (value.includes('ABSENT') || value.includes('NO_SHOW')) return isVi ? 'Vắng mặt' : 'Absent';
  if (value.includes('LATE')) return isVi ? 'Đi trễ' : 'Late';
  if (value.includes('EXCUSED')) return isVi ? 'Có phép' : 'Excused';
  return state || (isVi ? 'Chưa cập nhật' : 'Not updated');
};

const getSessionAttendance = (session, records) => records.find((record) => {
  const sessionId = session.sessionId || session.id;
  const sameSession = sessionId && record.sessionId && String(record.sessionId) === String(sessionId);
  const sameClassDate = session.classId && record.classId
    && String(record.classId) === String(session.classId)
    && String(record.sessionDate || '').slice(0, 10) === String(session.sessionDate || session.date || '').slice(0, 10);
  return sameSession || sameClassDate;
});

const getScheduleStatus = (session, record, now, isVi) => {
  if (record) return attendanceStateLabel(record.state, isVi);
  const start = toTimestamp(session);
  const end = getSessionEndTimestamp(session);
  if (now > end) return isVi ? 'Chưa có ghi nhận' : 'No record yet';
  if (now >= start - 30 * 60 * 1000 && now <= end) return isVi ? 'Trong khung điểm danh' : 'Check-in window';
  return isVi ? 'Sắp diễn ra' : 'Upcoming';
};

const formatSessionDate = (session, isVi) => {
  const date = session.sessionDate || session.date;
  if (!date) return isVi ? 'Chưa có ngày học' : 'Date not set';
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00+07:00`);
  return new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(parsed);
};

const formatAttendanceDate = (value, isVi) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', {
    dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(parsed);
};

const formatTime = (value) => value ? String(value).slice(0, 5) : '—';

const formatDateInput = (value) => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};

function LocalDatePicker({ value, onChange, isVi, label, min, max, error }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  const [view, setView] = useState(() => ({ year: selected.getFullYear(), month: selected.getMonth() }));
  useEffect(() => {
    if (value) {
      const date = new Date(`${value}T12:00:00`);
      if (!Number.isNaN(date.getTime())) setView({ year: date.getFullYear(), month: date.getMonth() });
    }
  }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const days = new Date(view.year, view.month + 1, 0).getDate();
  const monthName = new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(view.year, view.month, 1));
  const bounds = (day) => `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const weekdayNames = isVi ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  return <div className="relative" ref={rootRef}>
    <button type="button" aria-label={label} aria-expanded={open} aria-invalid={Boolean(error)} onClick={() => setOpen((state) => !state)} className={`mt-1.5 inline-flex min-h-10 w-full items-center justify-between rounded-lg border bg-white px-3 py-2.5 text-left text-sm font-normal ${error ? 'border-red-400' : 'border-slate-200'}`}><span className={value ? 'text-slate-900' : 'text-slate-400'}>{formatDateInput(value) || (isVi ? 'dd/MM/yyyy' : 'DD/MM/YYYY')}</span><CalendarDays className="h-4 w-4 text-slate-500"/></button>
    {open && <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><button type="button" aria-label={isVi ? 'Tháng trước' : 'Previous month'} onClick={() => setView((current) => current.month === 0 ? { year: current.year - 1, month: 11 } : { ...current, month: current.month - 1 })} className="rounded-md p-1.5 hover:bg-slate-100"><ChevronLeft className="h-4 w-4"/></button><span className="text-sm font-bold capitalize text-slate-800">{monthName}</span><button type="button" aria-label={isVi ? 'Tháng sau' : 'Next month'} onClick={() => setView((current) => current.month === 11 ? { year: current.year + 1, month: 0 } : { ...current, month: current.month + 1 })} className="rounded-md p-1.5 hover:bg-slate-100"><ChevronRight className="h-4 w-4"/></button></div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-600">{weekdayNames.map((day) => <span key={day} className="py-1">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1">{Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`}/>)}{Array.from({ length: days }, (_, index) => {
        const day = index + 1; const date = bounds(day); const disabled = (min && date < min) || (max && date > max);
        return <button key={date} type="button" disabled={disabled} onClick={() => { onChange(date); setOpen(false); }} className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs ${value === date ? 'bg-red-700 font-bold text-white' : 'text-slate-700 hover:bg-red-50'} disabled:cursor-not-allowed disabled:text-slate-300`}>{day}</button>;
      })}</div>
    </div>}
  </div>;
}

const logAttendanceError = (endpoint, error) => {
  console.error('[member-attendance] API request failed', {
    endpoint,
    status: error?.status ?? 0,
    requestId: error?.requestId || error?.details?.requestId || null,
    error,
  });
};

export function MemberCheckinView() {
  const { currentUser, language, apiEnabled } = useSCMS();
  const isVi = language === 'vi';
  const memberId = Number(currentUser?.memberId);
  const validMember = Number.isInteger(memberId) && memberId > 0;
  const [code, setCode] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [codeDuration, setCodeDuration] = useState(30);
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [codeUpdatedAt, setCodeUpdatedAt] = useState(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshingCode, setRefreshingCode] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [scheduleFailed, setScheduleFailed] = useState(false);
  const [scheduleErrorDismissed, setScheduleErrorDismissed] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [historyErrorDismissed, setHistoryErrorDismissed] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeErrorDismissed, setCodeErrorDismissed] = useState(false);
  const [codeStale, setCodeStale] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState([]);
  const [reviewClassName, setReviewClassName] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [reviewTime, setReviewTime] = useState('');
  const [reviewDetails, setReviewDetails] = useState('');
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewStorageError, setReviewStorageError] = useState('');
  const [reviewErrors, setReviewErrors] = useState({});
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [scheduleTab, setScheduleTab] = useState('today');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showDisputeDrawer, setShowDisputeDrawer] = useState(false);
  const [showQrSpotlight, setShowQrSpotlight] = useState(false);
  const historySearchRef = useRef(null);
  const mountedRef = useRef(true);
  const visibleRef = useRef(typeof document === 'undefined' || document.visibilityState === 'visible');
  const refreshingCodeRef = useRef(false);
  const retryTimerRef = useRef(null);
  const retryResolveRef = useRef(null);

  const openReviewForRow = (row) => {
    setReviewClassName(row.className || '');
    setReviewDate(String(row.sessionDate || row.checkInTime || '').slice(0, 10));
    setReviewTime(String(row.startTime || row.sessionTime || row.classStartTime || '').slice(0, 5));
    setReviewDetails('');
    setReviewNotice('');
    setShowDisputeDrawer(true);
  };

  const reloadAll = () => { refreshPage(); if (activeCheckinSession) refreshCode(); };

  const refreshCode = useCallback(async () => {
    if (!apiEnabled || !validMember || !visibleRef.current || refreshingCodeRef.current) return;
    refreshingCodeRef.current = true;
    setRefreshingCode(true);
    setCodeError('');
    setCodeErrorDismissed(false);
    setCode(null);
    setSecondsLeft(0);
    setCodeStale(true);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!mountedRef.current || !visibleRef.current) return;
        try {
          const result = await getMemberCheckinCode();
          if (!result?.payload) throw new Error('QR payload missing');
          if (!mountedRef.current || !visibleRef.current) return;
          const receivedAt = Date.now();
          const rawExpiresAt = result.expiresAt;
          const parsedExpiresAt = typeof rawExpiresAt === 'number' && rawExpiresAt < 1e12
            ? rawExpiresAt * 1000
            : new Date(rawExpiresAt).getTime();
          const expiresAt = rawExpiresAt ? parsedExpiresAt : NaN;
          const fallbackDuration = Math.max(1, Number(result.expiresInSeconds) || 30);
          const expiry = Number.isFinite(expiresAt) ? expiresAt : receivedAt + fallbackDuration * 1000;
          if (expiry <= receivedAt) throw new Error('QR already expired');
          setCode(String(result.payload));
          setCodeStale(false);
          setCodeDuration(Math.max(1, Math.ceil((expiry - receivedAt) / 1000)));
          setCodeExpiresAt(expiry);
          setCodeUpdatedAt(new Date(receivedAt));
          setSecondsLeft(Math.max(0, Math.ceil((expiry - Date.now()) / 1000)));
          return;
        } catch (err) {
          logAttendanceError('/api/members/me/checkin-code', err);
          const status = Number(err?.status || 0);
          if (attempt >= 2 || (status > 0 && status < 500)) break;
          if (!visibleRef.current) break;
          await new Promise((resolve) => {
            retryResolveRef.current = resolve;
            retryTimerRef.current = window.setTimeout(() => {
              retryTimerRef.current = null;
              retryResolveRef.current = null;
              resolve();
            }, 500 * (2 ** attempt));
          });
        }
      }
      if (mountedRef.current) {
        setCodeError(isVi ? 'Mã hết hạn, không thể tải mã mới. Vui lòng thử lại.' : 'The code expired and a new one could not be loaded. Please retry.');
      }
    } finally {
      refreshingCodeRef.current = false;
      if (mountedRef.current) setRefreshingCode(false);
    }
  }, [apiEnabled, isVi, validMember]);

  const refreshSchedule = useCallback(async () => {
    if (!apiEnabled || !validMember) { setScheduleLoading(false); setScheduleError(''); setScheduleFailed(false); setAllSessions([]); setSessions([]); setClassOptions([]); return; }
    setScheduleLoading(true);
    setScheduleError('');
    setScheduleFailed(false);
    setScheduleErrorDismissed(false);
    try {
      const enrollments = await getMemberClasses(memberId);
      const activeEnrollments = (enrollments || []).filter((row) => !['cancelled', 'canceled', 'dropped', 'rejected'].includes(String(row.status || '').toLowerCase()));
      const options = activeEnrollments.map((row) => ({
        id: row.classId ?? row.id ?? row.enrollmentId ?? row.className ?? row.name,
        name: row.className || row.name || row.subjectName || '',
      })).filter((row) => row.name);
      const scheduled = activeEnrollments
        .flatMap((row) => getSessions(row).map((session) => ({
          ...session,
          classId: session.classId ?? row.classId,
          className: session.className || row.className || row.name,
          subjectName: session.subjectName || row.subjectName,
          coachName: session.coachName || row.coachName,
          roomName: session.roomName || session.room || row.roomName,
          enrollmentStatus: row.status,
        })))
        .sort((a, b) => toTimestamp(a) - toTimestamp(b));
      if (mountedRef.current) {
        setClassOptions(Array.from(new Map(options.map((item) => [String(item.id), item])).values()));
        setAllSessions(scheduled);
        setSessions(scheduled.filter((session) => getSessionEndTimestamp(session) >= Date.now()));
      }
    } catch (err) {
      logAttendanceError(`/api/members/${memberId}/enrollments`, err);
      if (mountedRef.current) { setScheduleError(isVi ? 'Không tải được lịch học. Vui lòng thử lại.' : 'Could not load your schedule. Please try again.'); setScheduleFailed(true); }
    } finally {
      if (mountedRef.current) setScheduleLoading(false);
    }
  }, [apiEnabled, isVi, memberId, validMember]);

  const refreshHistory = useCallback(async () => {
    if (!apiEnabled || !validMember) { setHistoryLoading(false); setHistoryError(''); setHistoryFailed(false); setAttendanceRows([]); return; }
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryFailed(false);
    setHistoryErrorDismissed(false);
    try {
      const records = await getMemberAttendances(memberId);
      if (mountedRef.current) setAttendanceRows((records || []).slice().sort((a, b) => String(b.sessionDate || '').localeCompare(String(a.sessionDate || ''))));
    } catch (err) {
      logAttendanceError(`/api/attendances?memberId=${memberId}`, err);
      if (mountedRef.current) { setHistoryError(isVi ? 'Không tải được lịch sử điểm danh. Vui lòng thử lại.' : 'Could not load attendance history. Please try again.'); setHistoryFailed(true); }
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, [apiEnabled, isVi, memberId, validMember]);

  const refreshPage = useCallback(() => Promise.all([refreshSchedule(), refreshHistory()]), [refreshSchedule, refreshHistory]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const typing = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        historySearchRef.current?.focus();
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        refreshPage();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refreshPage]);

  useEffect(() => { refreshPage(); }, [refreshPage]);
  useEffect(() => { refreshCode(); }, [refreshCode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      retryResolveRef.current?.();
      retryResolveRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!showHelpModal && !showDisputeDrawer && !showQrSpotlight) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowHelpModal(false);
        setShowDisputeDrawer(false);
        setShowQrSpotlight(false);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showHelpModal, showDisputeDrawer, showQrSpotlight]);

  useEffect(() => {
    if (!code) return undefined;
    let timer = null;
    const stopTimer = () => { if (timer) window.clearInterval(timer); timer = null; };
    const startTimer = () => {
      stopTimer();
      if (!visibleRef.current) return;
      timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (!remaining) setCodeStale(true);
      }, 250);
    };
    const onVisibilityChange = () => document.visibilityState === 'visible' ? startTimer() : stopTimer();
    startTimer();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { stopTimer(); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [code, codeExpiresAt]);

  useEffect(() => {
    if (!allSessions.length) return undefined;
    let timer = null;
    const stop = () => { if (timer) window.clearInterval(timer); timer = null; };
    const start = () => {
      stop();
      if (document.visibilityState !== 'visible') return;
      setClockNow(Date.now());
      timer = window.setInterval(() => setClockNow(Date.now()), 5000);
    };
    const onVisibility = () => document.visibilityState === 'visible' ? start() : stop();
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [allSessions]);

  useEffect(() => {
    if (secondsLeft === 0) setShowQrSpotlight(false);
  }, [secondsLeft]);

  const todayKey = getTodayInVietnam();
  const todaySessions = allSessions.filter((session) => String(session.sessionDate || session.date || '').slice(0, 10) === todayKey);
  const upcomingSessions = sessions.filter((session) => String(session.sessionDate || session.date || '').slice(0, 10) > todayKey);
  const now = clockNow;
  const activeCheckinSession = todaySessions.find((session) => isSessionCheckinOpen(session, now));
  const nextCheckinSession = todaySessions.filter((session) => toTimestamp(session) - 30 * 60 * 1000 > now).sort((a, b) => toTimestamp(a) - toTimestamp(b))[0];
  const reviewStorageKey = validMember ? `scms:attendance-review-drafts:${memberId}` : null;
  const filteredAttendance = useMemo(() => attendanceRows.filter((row) => {
    const state = String(row.state || '').toUpperCase();
    const query = historySearch.trim().toLocaleLowerCase(isVi ? 'vi' : 'en');
    const matchesSearch = !query || String(row.className || '').toLocaleLowerCase(isVi ? 'vi' : 'en').includes(query);
    const matchesStatus = historyStatus === 'all'
      || (historyStatus === 'present' && (state.includes('PRESENT') || state.includes('ATTENDED') || state === 'CHECKED_IN' || state.includes('LATE')))
      || (historyStatus === 'absent' && !(state.includes('PRESENT') || state.includes('ATTENDED') || state === 'CHECKED_IN' || state.includes('LATE')));
    const date = String(row.sessionDate || row.checkInTime || '').slice(0, 10);
    return matchesSearch && matchesStatus && (!historyDateFrom || date >= historyDateFrom) && (!historyDateTo || date <= historyDateTo);
  }), [attendanceRows, historyDateFrom, historyDateTo, historySearch, historyStatus, isVi]);

  const historyStats = useMemo(() => {
    const present = attendanceRows.filter((row) => {
      const state = String(row.state || '').toUpperCase();
      return state.includes('PRESENT') || state.includes('ATTENDED') || state === 'CHECKED_IN' || state.includes('LATE');
    }).length;
    return { all: attendanceRows.length, present, absentOther: attendanceRows.length - present };
  }, [attendanceRows]);
  const hasHistoryFilters = Boolean(historySearch || historyStatus !== 'all' || historyDateFrom || historyDateTo);

  useEffect(() => { if (!activeCheckinSession) setShowQrSpotlight(false); }, [activeCheckinSession]);

  useEffect(() => {
    if (activeCheckinSession && !scheduleFailed && !scheduleLoading && !code && !refreshingCode && !codeError) refreshCode();
  }, [activeCheckinSession, scheduleFailed, scheduleLoading, code, refreshingCode, codeError, refreshCode]);

  useEffect(() => {
    if (activeCheckinSession && code && secondsLeft === 0 && !refreshingCode) refreshCode();
  }, [activeCheckinSession, code, secondsLeft, refreshingCode, refreshCode]);

  useEffect(() => {
    const onVisibilityChange = () => {
      visibleRef.current = document.visibilityState === 'visible';
      if (!visibleRef.current) return;
      if (activeCheckinSession && (!code || Date.now() >= codeExpiresAt)) refreshCode();
      else setSecondsLeft(code ? Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 1000)) : 0);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [activeCheckinSession, code, codeExpiresAt, refreshCode]);

  useEffect(() => {
    if (!reviewStorageKey) { setReviewDrafts([]); return; }
    try {
      const saved = window.localStorage.getItem(reviewStorageKey);
      const drafts = saved ? JSON.parse(saved) : [];
      setReviewDrafts(Array.isArray(drafts) ? drafts : []);
      setReviewStorageError('');
    } catch {
      setReviewDrafts([]);
      setReviewStorageError(isVi ? 'Không đọc được bản nháp trên thiết bị này.' : 'Could not read drafts on this device.');
    }
  }, [isVi, reviewStorageKey]);

  useEffect(() => {
    if (!reviewNotice) return undefined;
    const timer = window.setTimeout(() => setReviewNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [reviewNotice]);

  const saveReviewDrafts = (next) => {
    try {
      if (reviewStorageKey) window.localStorage.setItem(reviewStorageKey, JSON.stringify(next));
      setReviewDrafts(next);
      setReviewStorageError('');
      return true;
    } catch {
      setReviewStorageError(isVi ? 'Không lưu được bản nháp. Hãy kiểm tra dung lượng lưu trữ của trình duyệt.' : 'Could not save the draft. Check your browser storage.');
      return false;
    }
  };

  const handleReviewDraftSubmit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!reviewClassName) nextErrors.className = isVi ? 'Vui lòng chọn lớp hoặc môn học.' : 'Choose a class or sport.';
    if (!reviewDate) nextErrors.sessionDate = isVi ? 'Vui lòng chọn ngày học.' : 'Choose the class date.';
    else if (reviewDate > getTodayInVietnam()) nextErrors.sessionDate = isVi ? 'Ngày học không thể ở tương lai.' : 'The class date cannot be in the future.';
    if (!reviewDetails.trim()) nextErrors.details = isVi ? 'Vui lòng nhập thông tin cần đối soát.' : 'Enter the details to review.';
    if (reviewTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reviewTime)) nextErrors.sessionTime = isVi ? 'Nhập giờ theo định dạng 24 giờ HH:mm.' : 'Enter time in 24-hour HH:mm format.';
    setReviewErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const draft = {
      id: editingDraftId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
      className: reviewClassName.trim(), sessionDate: reviewDate, sessionTime: reviewTime,
      details: reviewDetails.trim(), createdAt: new Date().toISOString(), status: 'draft',
    };
    const nextDrafts = editingDraftId
      ? reviewDrafts.map((item) => item.id === editingDraftId ? draft : item)
      : [draft, ...reviewDrafts];
    if (saveReviewDrafts(nextDrafts)) {
      setReviewNotice(isVi ? 'Đã lưu bản nháp trên thiết bị.' : 'Draft saved on this device.');
      setReviewDetails('');
      setEditingDraftId(null);
      setReviewErrors({});
    }
  };

  const renderScheduleRows = (rows, emptyText) => (
    scheduleLoading ? <div className="flex flex-1 flex-col justify-center gap-3 py-5" aria-label={isVi ? 'Đang tải lịch học' : 'Loading schedule'}>{[0, 1, 2].map((key) => <div key={key} className="animate-pulse rounded-lg bg-slate-100 p-4"><div className="h-3 w-1/3 rounded bg-slate-200"/><div className="mt-3 h-4 w-2/3 rounded bg-slate-200"/><div className="mt-2 h-3 w-1/2 rounded bg-slate-200"/></div>)}</div>
      : scheduleFailed ? <div role={scheduleErrorDismissed ? 'status' : 'alert'} className="my-auto rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{scheduleErrorDismissed ? (isVi ? 'Lịch học chưa tải được.' : 'Schedule is unavailable.') : scheduleError}</p><div className="mt-3 flex items-center gap-3"><button type="button" onClick={refreshSchedule} className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800">{isVi ? 'Thử lại' : 'Retry'}</button>{!scheduleErrorDismissed && <button type="button" aria-label={isVi ? 'Đóng' : 'Close'} onClick={() => setScheduleErrorDismissed(true)} className="rounded-md p-1 hover:bg-red-100"><X className="h-4 w-4"/></button>}</div></div>
      : rows.length ? <div className="divide-y divide-slate-100">{rows.map((session, index) => {
        const record = getSessionAttendance(session, attendanceRows);
        const status = getScheduleStatus(session, record, Date.now(), isVi);
        const active = status === 'Trong khung điểm danh' || status === 'Check-in window';
        const absent = /ABSENT|NO_SHOW/.test(String(record?.state || '').toUpperCase());
        const present = /PRESENT|ATTENDED|CHECKED_IN|LATE/.test(String(record?.state || '').toUpperCase());
        return <article key={session.sessionId || session.id || `${session.className}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-red-700">{session.subjectName || 'VIBE SPORT'}</p><h3 className="mt-1 font-bold text-slate-900">{session.className || (isVi ? 'Buổi tập' : 'Training session')}</h3><p className="mt-1 text-sm text-slate-600">{formatSessionDate(session, isVi)} · {formatTime(session.startTime)}{session.endTime ? `–${formatTime(session.endTime)}` : ''}</p><p className="mt-1 text-xs text-slate-500">{session.roomName || session.room || (isVi ? 'Chưa có sân' : 'Room pending')}{session.coachName ? ` · ${session.coachName}` : ''}</p></div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${active ? 'bg-amber-100 text-amber-900' : absent ? 'bg-red-50 text-red-700' : present ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{status}</span>
        </article>;
      })}</div>
      : <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-600"><CalendarDays className="mb-3 h-8 w-8 text-slate-400"/><p>{emptyText}</p><Link to="/member/enrollments" className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">{isVi ? 'Đăng ký khóa học' : 'Browse courses'}</Link></div>
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      <AnimatePresence>{reviewNotice && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xl"><CheckCircle2 className="h-5 w-5"/>{reviewNotice}</motion.div>}</AnimatePresence>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">VIBE SPORT · MEMBER</p><h1 className="mt-1 text-3xl font-black text-slate-950">{isVi ? 'Điểm danh' : 'Check-in'}</h1><p className="mt-1 text-sm text-slate-500">{isVi ? 'Mở mã QR để Coach hoặc lễ tân quét khi đến buổi tập.' : 'Show your QR code to your coach or reception when you arrive.'}</p></div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setShowDisputeDrawer(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"><ClipboardCheck className="h-4 w-4"/>{isVi ? 'Yêu cầu đối soát' : 'Attendance review'}<span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">{isVi ? 'Bản nháp' : 'Draft'}</span></button><div className="group relative"><button type="button" onClick={reloadAll} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${refreshingCode || scheduleLoading || historyLoading ? 'animate-spin' : ''}`} />{isVi ? 'Tải lại' : 'Refresh'}</button><span role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{isVi ? 'Làm mới dữ liệu (Phím R)' : 'Refresh data (R)'}</span></div></div>
      </header>

      {!validMember && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{isVi ? 'Tài khoản chưa được liên kết với hồ sơ hội viên. Vui lòng liên hệ lễ tân để cập nhật hồ sơ.' : 'This account is not linked to a member profile. Please contact reception.'}</div>}
      {!apiEnabled && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{isVi ? 'Chế độ xem thử không phát mã TOTP thật. Kết nối API để sử dụng điểm danh QR.' : 'Demo mode does not issue real TOTP codes. Connect to the API to use QR check-in.'}</div>}

      <section className="grid items-stretch gap-5 lg:auto-rows-fr lg:grid-cols-12">
        <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><QrCode className="h-5 w-5 text-red-700" /><h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Mã QR điểm danh' : 'Check-in QR code'}</h2></div><div className="group relative z-20 shrink-0"><button type="button" onClick={() => setShowHelpModal(true)} className="text-xs font-semibold text-slate-600 hover:text-slate-800"><Info className="mr-1 inline h-3.5 w-3.5"/>{isVi ? 'Gặp sự cố?' : 'Need help?'}</button><div className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-[320px] origin-top-right translate-y-1 rounded-2xl bg-white p-4 text-left text-sm leading-6 text-slate-600 opacity-0 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15)] transition duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100"><p className="font-bold text-slate-900">{isVi ? 'Gặp sự cố khi điểm danh?' : 'Having trouble checking in?'}</p><p className="mt-1">{isVi ? 'Xem hướng dẫn xử lý lỗi QR, mã hết hạn hoặc buổi học chưa được ghi nhận.' : 'Get help with QR errors, expired codes, or missing attendance records.'}</p><span className="mt-2 inline-block text-xs font-semibold text-red-700">{isVi ? 'Nhấn để xem hướng dẫn chi tiết' : 'Click for detailed help'} →</span></div></div></div>
          <p className="mt-1 text-sm text-slate-500">{isVi ? 'Mã bảo mật tự đổi theo thời hạn do máy chủ cấp.' : 'The secure code refreshes according to the server timer.'}</p>
          <div className="mx-auto mt-4 flex min-h-[250px] w-full max-w-[330px] flex-1 flex-col items-center justify-center rounded-2xl bg-slate-50 p-4 text-center">
            {code && secondsLeft > 0 ? <>
              <button type="button" disabled={!activeCheckinSession || scheduleLoading || scheduleFailed} onClick={() => setShowQrSpotlight(true)} aria-label={isVi ? 'Phóng to mã QR' : 'Enlarge QR code'} className={`group relative overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 ${activeCheckinSession && !scheduleFailed && !scheduleLoading ? '' : 'cursor-not-allowed opacity-40 blur-[1px]'}`}><QRCodeSVG value={code} size={188} level="M" includeMargin /><motion.span aria-hidden="true" className="pointer-events-none absolute left-3 right-3 h-1 rounded-full bg-gradient-to-r from-transparent via-red-400/70 to-transparent" animate={{ top: ['8%', '92%', '8%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}/><span className="absolute inset-x-0 bottom-0 bg-slate-950/65 px-2 py-1.5 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">🔍 {isVi ? 'Nhấn để phóng to' : 'Click to enlarge'}</span></button>
              <p className={`mt-3 font-mono text-2xl font-bold tracking-[.28em] text-slate-900 ${activeCheckinSession && !scheduleFailed && !scheduleLoading ? '' : 'blur-[3px] opacity-50'}`}>{code}</p>
              <p className={`mt-1 text-sm ${secondsLeft <= 3 ? 'text-red-700' : 'text-slate-600'}`}>{refreshingCode ? (isVi ? 'Đang kiểm tra mã mới…' : 'Checking for a new code…') : (isVi ? 'Mã mới sau' : 'New code in')} <strong className="tabular-nums text-red-700">{secondsLeft}s</strong></p>
              <div className="mt-2 h-1 w-full max-w-[230px] overflow-hidden rounded-full bg-slate-200"><div className={`h-full transition-[width] duration-300 ${secondsLeft <= 3 ? 'bg-red-600' : 'bg-red-700'}`} style={{ width: `${Math.min(100, Math.max(0, (secondsLeft / codeDuration) * 100))}%` }}/></div>
            </> : code && (codeStale || secondsLeft === 0) ? <>
              <div className="relative"><div className="rounded-xl bg-white p-3 opacity-60 blur-[3px]"><QRCodeSVG value={code} size={188} level="M" includeMargin /></div>{(activeCheckinSession || codeError) && <button type="button" onClick={refreshCode} disabled={refreshingCode} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-red-800 disabled:opacity-60">↻ {isVi ? 'Thử lại ngay' : 'Retry now'}</button>}</div><p className="mt-3 font-mono text-xl font-bold tracking-[.2em] text-slate-500 blur-[2px]">{code}</p><p className="mt-1 text-sm text-slate-600">{refreshingCode ? (isVi ? 'Mã hết hạn, đang thử lại...' : 'Code expired, retrying...') : (isVi ? 'Mã hết hạn. Hãy thử tải mã mới.' : 'Code expired. Retry to load a new code.')}</p>
            </> : <>
              <ShieldCheck className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-600">{refreshingCode ? (isVi ? 'Mã hết hạn, đang thử lại...' : 'Code expired, retrying...') : codeError || (scheduleLoading ? (isVi ? 'Đang kiểm tra lịch học…' : 'Checking your schedule…') : scheduleFailed ? (isVi ? 'Chưa thể xác định khung giờ quét.' : 'Could not verify the check-in window.') : activeCheckinSession ? (isVi ? 'Mã QR chưa sẵn sàng.' : 'QR code is not available yet.') : (isVi ? 'Mã QR sẽ hiển thị trong khung giờ điểm danh.' : 'The QR code appears during the check-in window.'))}</p>
              {apiEnabled && validMember && (activeCheckinSession || codeError) && <button type="button" onClick={refreshCode} className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800">{isVi ? 'Thử lại' : 'Try again'}</button>}
            </>}
          </div>
          <p className="mt-2 text-center text-xs leading-5 text-slate-600">{isVi ? 'Chỉ ghi nhận điểm danh trong vòng 30 phút trước hoặc trong giờ học. Đưa mã cho Coach/lễ tân quét.' : 'Attendance is recorded only within 30 minutes before or during class. Show the code to your coach or reception.'}</p>
          <div className="mt-2 flex min-h-6 items-center justify-center">{scheduleLoading ? <span className="h-5 w-32 animate-pulse rounded-full bg-slate-200"/> : scheduleFailed ? <span className="text-xs font-semibold text-amber-800">{isVi ? 'Chưa thể xác định khung giờ quét.' : 'Could not verify the check-in window.'}</span> : activeCheckinSession ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5"/>{isVi ? 'Đang mở điểm danh' : 'Check-in is open'}</span> : nextCheckinSession ? <span className="text-center text-xs font-medium text-slate-700">{isVi ? `Chưa đến giờ quét. Buổi tiếp theo: ${nextCheckinSession.className || 'Buổi tập'} ${formatTime(nextCheckinSession.startTime)}, quét được từ ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(toTimestamp(nextCheckinSession) - 30 * 60 * 1000))}.` : `Not time to check in yet. Next: ${nextCheckinSession.className || 'Class'} at ${formatTime(nextCheckinSession.startTime)}; scanning opens 30 minutes earlier.`}</span> : <span className="text-xs font-medium text-slate-600">{todaySessions.length ? (isVi ? 'Các buổi học hôm nay đã kết thúc.' : 'Today’s classes have ended.') : (isVi ? 'Hôm nay bạn không có buổi học.' : 'You have no class today.')}</span>}</div>
          {codeUpdatedAt && <p className="mt-1 text-center text-xs text-slate-600">{isVi ? 'Cập nhật lúc' : 'Updated at'} {new Intl.DateTimeFormat(isVi ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(codeUpdatedAt)}</p>}
          {codeError && !codeErrorDismissed && <div role="alert" className="mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/><div className="flex-1"><p className="font-bold">{isVi ? 'Mã chưa sẵn sàng' : 'Code unavailable'}</p><p className="mt-1">{codeError}</p><p className="mt-2">{isVi ? 'Kiểm tra kết nối rồi thử tải lại. Nếu vẫn lỗi, vui lòng nhờ lễ tân kiểm tra trạng thái tài khoản.' : 'Check your connection and retry. If it still fails, ask reception to check your account.'}</p></div><button type="button" aria-label={isVi ? 'Đóng' : 'Close'} onClick={() => setCodeErrorDismissed(true)} className="rounded-md p-1 hover:bg-red-100"><X className="h-4 w-4"/></button></div>}
        </article>

        <article className="flex h-full min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-red-700"/><h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Lịch trình học tập' : 'Your schedule'}</h2></div><div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label={isVi ? 'Lịch học' : 'Class schedule'}>
            <button type="button" role="tab" aria-selected={scheduleTab === 'today'} onClick={() => setScheduleTab('today')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${scheduleTab === 'today' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{isVi ? 'Hôm nay' : 'Today'} <span className="ml-1 text-xs text-slate-700">{scheduleLoading || scheduleFailed ? '–' : todaySessions.length}</span></button>
            <button type="button" role="tab" aria-selected={scheduleTab === 'upcoming'} onClick={() => setScheduleTab('upcoming')} className={`rounded-md px-3 py-1.5 text-xs font-bold ${scheduleTab === 'upcoming' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{isVi ? 'Sắp tới' : 'Upcoming'} <span className="ml-1 text-xs text-slate-700">{scheduleLoading || scheduleFailed ? '–' : upcomingSessions.length}</span></button>
          </div></div>
          <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto">{scheduleTab === 'today' ? renderScheduleRows(todaySessions, isVi ? 'Hôm nay bạn không có buổi học nào trong lịch đăng ký.' : 'You have no classes scheduled today.') : renderScheduleRows(upcomingSessions, isVi ? 'Chưa có buổi học sắp tới trong lịch đăng ký.' : 'No upcoming classes in your schedule.')}</div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-red-700"/><h2 className="text-lg font-extrabold text-slate-900">{isVi ? 'Lịch sử điểm danh' : 'Attendance history'}</h2></div><button type="button" onClick={() => setShowDisputeDrawer(true)} className="text-sm font-semibold text-red-700 hover:text-red-900">{isVi ? 'Thiếu buổi tập? Gửi đối soát' : 'Missing a class? Request review'} <ChevronRight className="inline h-4 w-4"/></button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(180px,1fr)_170px_170px]">
          <label className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input ref={historySearchRef} value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder={isVi ? 'Tìm theo tên lớp' : 'Search class'} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-12 text-sm outline-none focus:border-red-400"/><span className="pointer-events-none absolute right-2.5 top-2 inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400">/</span></label>
          <label className="text-xs font-semibold text-slate-600">{isVi ? 'Từ ngày' : 'From'}<LocalDatePicker value={historyDateFrom} onChange={setHistoryDateFrom} isVi={isVi} label={isVi ? 'Ngày bắt đầu' : 'Start date'} max={historyDateTo || getTodayInVietnam()}/></label>
          <label className="text-xs font-semibold text-slate-600">{isVi ? 'Đến ngày' : 'To'}<LocalDatePicker value={historyDateTo} onChange={setHistoryDateTo} isVi={isVi} label={isVi ? 'Ngày kết thúc' : 'End date'} min={historyDateFrom || undefined} max={getTodayInVietnam()}/></label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={isVi ? 'Lọc nhanh lịch sử điểm danh' : 'Quick attendance filters'}>
          <button type="button" onClick={() => setHistoryStatus('all')} aria-pressed={historyStatus === 'all'} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${historyStatus === 'all' ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{isVi ? 'Tất cả' : 'All'} ({historyLoading || historyFailed ? '–' : historyStats.all})</button>
          <button type="button" onClick={() => setHistoryStatus('present')} aria-pressed={historyStatus === 'present'} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${historyStatus === 'present' ? 'border-emerald-400 bg-emerald-100 text-emerald-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'}`}>✓ {isVi ? 'Có mặt' : 'Present'} ({historyLoading || historyFailed ? '–' : historyStats.present})</button>
          <button type="button" onClick={() => setHistoryStatus('absent')} aria-pressed={historyStatus === 'absent'} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${historyStatus === 'absent' ? 'border-red-300 bg-red-100 text-red-900' : 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100'}`}>• {isVi ? 'Vắng mặt / Khác' : 'Absent / Other'} ({historyLoading || historyFailed ? '–' : historyStats.absentOther})</button>
          {hasHistoryFilters && <button type="button" onClick={() => { setHistorySearch(''); setHistoryStatus('all'); setHistoryDateFrom(''); setHistoryDateTo(''); }} className="ml-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 underline hover:text-slate-950">{isVi ? 'Xóa bộ lọc' : 'Clear filters'}</button>}
        </div>
        {historyFailed ? <div role={historyErrorDismissed ? 'status' : 'alert'} className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{historyErrorDismissed ? (isVi ? 'Lịch sử chưa tải được.' : 'Attendance history is unavailable.') : historyError}</span><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={refreshHistory} className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800">{isVi ? 'Thử lại' : 'Retry'}</button>{!historyErrorDismissed && <button type="button" aria-label={isVi ? 'Đóng' : 'Close'} onClick={() => setHistoryErrorDismissed(true)} className="rounded-md p-1 hover:bg-red-100"><X className="h-4 w-4"/></button>}</div></div> : historyLoading ? <div className="mt-4 space-y-3" aria-label={isVi ? 'Đang tải lịch sử điểm danh' : 'Loading attendance history'}>{[0, 1, 2].map((key) => <div key={key} className="animate-pulse border-b border-slate-100 py-4"><div className="h-4 w-1/3 rounded bg-slate-200"/><div className="mt-2 h-3 w-1/4 rounded bg-slate-100"/></div>)}</div> : filteredAttendance.length ? <div className="mt-4 divide-y divide-slate-100">{filteredAttendance.map((row, index) => {
          const state = String(row.state || '').toUpperCase();
          const present = state.includes('PRESENT') || state.includes('ATTENDED') || state === 'CHECKED_IN' || state.includes('LATE');
          return <article key={row.attendanceId || `${row.sessionId || 'attendance'}-${index}`} className="group flex flex-wrap items-center justify-between gap-3 py-4">
            <div><h3 className="font-bold text-slate-900">{row.className || (isVi ? 'Buổi tập' : 'Training session')}</h3><p className="mt-1 text-xs text-slate-500">{formatAttendanceDate(row.sessionDate || row.checkInTime, isVi)}{row.checkInTime ? ` · ${String(row.checkInTime).slice(11, 16)}` : ''}</p></div>
            <div className="flex items-center gap-3"><button type="button" onClick={() => openReviewForRow(row)} className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 opacity-100 transition hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">{isVi ? 'Đối soát buổi này →' : 'Review this class →'}</button>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${present ? 'bg-emerald-50 text-emerald-800' : state.includes('ABSENT') ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{attendanceStateLabel(row.state, isVi)}</span>
            </div>
          </article>;
        })}</div> : <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">{attendanceRows.length ? <p>{isVi ? 'Không có bản ghi khớp với bộ lọc.' : 'No records match these filters.'}</p> : <><ClipboardList className="mb-2 h-7 w-7 opacity-40"/><p>{isVi ? 'Chưa có dữ liệu điểm danh.' : 'No attendance records yet.'}</p></>}</div>}
      </section>

      <AnimatePresence>
      {showQrSpotlight && code && secondsLeft > 0 && activeCheckinSession && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center bg-white p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQrSpotlight(false); }}>
        <motion.section initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }} role="dialog" aria-modal="true" aria-labelledby="qr-spotlight-title" className="relative flex w-full max-w-md flex-col items-center rounded-3xl bg-white p-4 text-center sm:p-8">
          <button type="button" onClick={() => setShowQrSpotlight(false)} aria-label={isVi ? 'Đóng mã QR phóng to' : 'Close enlarged QR'} className="absolute right-3 top-3 rounded-full p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button>
          <p id="qr-spotlight-title" className="text-sm font-bold uppercase tracking-wider text-red-700">{isVi ? 'Mã QR điểm danh' : 'Check-in QR code'}</p>
          <div className="mt-5 rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200"><QRCodeSVG value={code} size={typeof window === 'undefined' ? 280 : Math.min(320, window.innerWidth - 72)} level="M" includeMargin /></div>
          <p className="mt-5 font-mono text-4xl font-black tracking-[.3em] text-slate-950">{code}</p>
          <p className="mt-2 text-sm text-slate-600">{isVi ? 'Mã mới sau' : 'New code in'} <strong className="tabular-nums text-red-700">{secondsLeft}s</strong></p>
        </motion.section>
      </motion.div>}
      {showHelpModal && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHelpModal(false); }}>
        <motion.section initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }} transition={{ duration: 0.16 }} role="dialog" aria-modal="true" aria-labelledby="attendance-help-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-red-700">VIBE SPORT · MEMBER</p><h2 id="attendance-help-title" className="mt-1 text-xl font-extrabold text-slate-900">{isVi ? 'Gặp sự cố khi điểm danh?' : 'Having trouble checking in?'}</h2></div><button type="button" aria-label={isVi ? 'Đóng' : 'Close'} onClick={() => setShowHelpModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
          <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600"><p><strong className="text-slate-900">{isVi ? 'QR không tải hoặc hết hạn:' : 'QR does not load or has expired:'}</strong> {isVi ? 'Kiểm tra mạng, nhấn Tải lại và dùng mã mới nhất trên màn hình.' : 'Check your connection, refresh, and use the latest code on screen.'}</p><p><strong className="text-slate-900">{isVi ? 'Không quét được:' : 'QR will not scan:'}</strong> {isVi ? 'Tăng độ sáng màn hình, phóng to QR và nhờ Coach/lễ tân nhập mã 6 số hiển thị bên dưới QR.' : 'Increase screen brightness, enlarge the QR, and ask staff to enter the six-digit code shown below it.'}</p><p><strong className="text-slate-900">{isVi ? 'Đã quét nhưng chưa ghi nhận:' : 'Scanned but not recorded:'}</strong> {isVi ? 'Tải lại lịch sử sau ít phút. Nếu vẫn thiếu, ghi lại tên lớp, ngày và giờ buổi học rồi liên hệ lễ tân để đối soát.' : 'Refresh your history after a few minutes. If the record is still missing, note the class, date, and time and contact reception.'}</p><p className="rounded-lg bg-slate-100 p-3 text-xs leading-5">{isVi ? 'Điểm danh chỉ hợp lệ trong vòng 30 phút trước hoặc trong giờ buổi học. Lỗi đăng nhập hoặc tài khoản chưa liên kết hồ sơ cần được lễ tân kiểm tra.' : 'Check-in is available within 30 minutes before or during class. Reception can help with sign-in or member profile issues.'}</p></div>
          <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowHelpModal(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{isVi ? 'Đóng' : 'Close'}</button><button type="button" onClick={() => { setShowHelpModal(false); setShowDisputeDrawer(true); }} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800">{isVi ? 'Mở form đối soát' : 'Open review form'}</button></div>
        </motion.section>
      </motion.div>}

      {showDisputeDrawer && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDisputeDrawer(false); }}>
        <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.22 }} role="dialog" aria-modal="true" aria-labelledby="attendance-dispute-title" className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
          <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-wider text-red-700">VIBE SPORT · MEMBER</p><h2 id="attendance-dispute-title" className="mt-1 text-xl font-extrabold text-slate-900">{isVi ? 'Yêu cầu đối soát điểm danh' : 'Attendance review request'}</h2></div><button type="button" aria-label={isVi ? 'Đóng' : 'Close'} onClick={() => setShowDisputeDrawer(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button></header>
          <div className="flex-1 p-5"><p className="text-sm leading-6 text-slate-600">{isVi ? 'Ghi lại thông tin buổi học cần kiểm tra để trao đổi với lễ tân. Bản nháp chỉ lưu trên trình duyệt của thiết bị này.' : 'Record the session details to discuss with reception. Drafts are stored only in this device’s browser.'}</p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{isVi ? 'Bản nháp chưa được gửi đến trung tâm. API hiện chưa hỗ trợ Member gửi yêu cầu đối soát; vui lòng liên hệ lễ tân để xử lý.' : 'Drafts are not sent to the center. The API does not yet support Member review requests; please contact reception for help.'}</div>
            <form onSubmit={handleReviewDraftSubmit} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">{isVi ? 'Lớp / môn học' : 'Class / sport'}<select required value={reviewClassName} onChange={(event) => { setReviewClassName(event.target.value); setReviewErrors((errors) => ({ ...errors, className: '' })); }} className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal ${reviewErrors.className ? 'border-red-400' : 'border-slate-200'}`}><option value="">{isVi ? 'Chọn lớp đã đăng ký' : 'Choose an enrolled class'}</option>{reviewClassName && !classOptions.some((option) => option.name === reviewClassName) && <option value={reviewClassName}>{reviewClassName}</option>}{classOptions.map((option) => <option key={String(option.id)} value={option.name}>{option.name}</option>)}</select>{reviewErrors.className && <span className="mt-1 block text-xs text-red-700">{reviewErrors.className}</span>}</label>
              <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-slate-700">{isVi ? 'Ngày học' : 'Class date'}<LocalDatePicker value={reviewDate} onChange={(date) => { setReviewDate(date); setReviewErrors((errors) => ({ ...errors, sessionDate: '' })); }} isVi={isVi} label={isVi ? 'Chọn ngày học' : 'Choose class date'} max={getTodayInVietnam()} error={reviewErrors.sessionDate}/>{reviewErrors.sessionDate && <span className="mt-1 block text-xs text-red-700">{reviewErrors.sessionDate}</span>}</label><label className="block text-sm font-semibold text-slate-700">{isVi ? 'Giờ học' : 'Class time'}<input inputMode="numeric" value={reviewTime} onChange={(event) => { const value = event.target.value.replace(/[^\d:]/g, '').slice(0, 5); setReviewTime(value); setReviewErrors((errors) => ({ ...errors, sessionTime: '' })); }} className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-sm font-normal ${reviewErrors.sessionTime ? 'border-red-400' : 'border-slate-200'}`} placeholder="HH:mm" aria-label={isVi ? 'Giờ học 24 giờ' : 'Class time in 24-hour format'}/>{reviewErrors.sessionTime && <span className="mt-1 block text-xs text-red-700">{reviewErrors.sessionTime}</span>}</label></div>
              <label className="block text-sm font-semibold text-slate-700">{isVi ? 'Thông tin cần đối soát' : 'What needs review'}<textarea maxLength={1000} rows={4} value={reviewDetails} onChange={(event) => { setReviewDetails(event.target.value); setReviewErrors((errors) => ({ ...errors, details: '' })); }} className={`mt-1.5 w-full resize-y rounded-lg border px-3 py-2.5 text-sm font-normal ${reviewErrors.details ? 'border-red-400' : 'border-slate-200'}`} placeholder={isVi ? 'Mô tả ngắn sự việc, ví dụ đã có mặt nhưng chưa thấy ghi nhận...' : 'Briefly describe the issue, such as attending but not seeing a record...'}/><span className="mt-1 flex justify-between text-xs font-normal text-slate-500"><span>{reviewErrors.details || ''}</span><span>{reviewDetails.length}/1000</span></span></label>
              <div className="flex gap-2"><button type="submit" disabled={!validMember} className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{editingDraftId ? (isVi ? 'Cập nhật bản nháp' : 'Update draft') : (isVi ? 'Lưu bản nháp trên thiết bị' : 'Save draft on this device')}</button>{editingDraftId && <button type="button" onClick={() => { setEditingDraftId(null); setReviewClassName(''); setReviewDate(''); setReviewTime(''); setReviewDetails(''); setReviewErrors({}); }} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700">{isVi ? 'Hủy sửa' : 'Cancel edit'}</button>}</div>
            </form>
            {reviewStorageError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{reviewStorageError}</p>}
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5"><h3 className="text-sm font-bold text-slate-900">{isVi ? 'Nháp đã lưu' : 'Saved drafts'}</h3>{reviewDrafts.length ? reviewDrafts.map((draft) => <article key={draft.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-bold text-slate-900">{draft.className}</p><p className="mt-1 text-xs text-slate-600">{formatDateInput(draft.sessionDate)}{draft.sessionTime ? ` · ${draft.sessionTime}` : ''}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{draft.details}</p><span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">{isVi ? 'Bản nháp · Chưa gửi' : 'Draft · Not sent'}</span></div><div className="flex shrink-0 gap-1"><button type="button" onClick={() => { setEditingDraftId(draft.id); setReviewClassName(draft.className); setReviewDate(draft.sessionDate); setReviewTime(draft.sessionTime || ''); setReviewDetails(draft.details); setReviewErrors({}); setReviewNotice(''); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white">{isVi ? 'Sửa' : 'Edit'}</button><button type="button" aria-label={isVi ? 'Xóa bản nháp' : 'Delete draft'} onClick={() => { saveReviewDrafts(reviewDrafts.filter((item) => item.id !== draft.id)); if (editingDraftId === draft.id) setEditingDraftId(null); }} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-red-700"><Trash2 className="h-4 w-4"/></button></div></div></article>) : <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-600">{isVi ? 'Chưa có bản nháp nào được lưu.' : 'No drafts saved yet.'}</p>}</div>
          </div>
        </motion.aside>
      </motion.div>}
      </AnimatePresence>
    </main>
  );
}

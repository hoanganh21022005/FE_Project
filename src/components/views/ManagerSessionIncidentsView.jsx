import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, Clock3, Loader2, MapPin, RefreshCw, UserRound, UserRoundCog, X } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext'
import { getErrorMessage } from '../../api/apiErrors.js'
import {
  getCoaches,
  getHolidays,
  getSessions,
  getSessionTimeSlots,
  rescheduleSession,
  substituteSessionCoach,
} from '../../api/managerApi.js'
import {
  addDays,
  coachesForSession,
  findSessionConflict,
  localDateString,
  makeMockSessions,
  MOCK_TIME_SLOTS,
  normalizeTime,
  validateRescheduleForm,
} from '../../api/sessionIncidentUtils.js'
import { canManageClasses } from '../../api/holidayUtils.js'

function SessionIncidentsView() {
  const {
    apiEnabled,
    currentUser,
    classes,
    rooms,
    subjects,
    coaches: contextCoaches,
    language,
    showToast,
  } = useSCMS()
  const canManage = canManageClasses(apiEnabled, currentUser?.authorities)
  const [filters, setFilters] = useState(() => {
    const today = localDateString()
    return { classId: '', coachId: '', roomId: '', startDate: today, endDate: addDays(today, 30), status: 'Scheduled' }
  })
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(apiEnabled)
  const [listError, setListError] = useState('')
  const [coachList, setCoachList] = useState([])
  const [lookupsError, setLookupsError] = useState('')
  const [holidays, setHolidays] = useState([])
  const [rescheduleSessionItem, setRescheduleSessionItem] = useState(null)
  const [substituteSessionItem, setSubstituteSessionItem] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', slot: '', newRoomId: '', reason: '' })
  const [substituteForm, setSubstituteForm] = useState({ newCoachId: '', reason: '' })
  const [timeSlots, setTimeSlots] = useState([])
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestId = useRef(0)
  const mutationLock = useRef(false)
  const mockSessions = useRef(null)

  const loadSessions = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setListError('')
    try {
      if (apiEnabled) {
        const data = await getSessions(filters, { notifyForbidden: false })
        if (currentRequest === requestId.current) setSessions(data)
      } else {
        if (!mockSessions.current) mockSessions.current = makeMockSessions({ classes, rooms, coaches: contextCoaches })
        const data = mockSessions.current
        const filtered = data.filter((session) => (
          (!filters.classId || String(session.classId) === String(filters.classId))
          && (!filters.coachId || String(session.coachId) === String(filters.coachId))
          && (!filters.roomId || String(session.roomId) === String(filters.roomId))
          && (!filters.startDate || session.sessionDate >= filters.startDate)
          && (!filters.endDate || session.sessionDate <= filters.endDate)
          && (!filters.status || session.status === filters.status)
        ))
        if (currentRequest === requestId.current) setSessions(filtered)
      }
    } catch (err) {
      if (currentRequest === requestId.current) setListError(getErrorMessage(err, language === 'vi' ? 'Không thể tải lịch học.' : 'Could not load sessions.'))
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [apiEnabled, filters, classes, rooms, contextCoaches, language])

  useEffect(() => { loadSessions() }, [loadSessions])

  useEffect(() => {
    if (!apiEnabled) {
      setCoachList(contextCoaches.map((coach) => ({
        ...coach,
        specializations: coach.specializations || [coach.specialization || coach.specialty].filter(Boolean),
      })))
      return undefined
    }
    let active = true
    Promise.allSettled([
      getCoaches({ notifyForbidden: false }),
      getHolidays({ notifyForbidden: false }),
    ]).then(([coachesResult, holidaysResult]) => {
      if (active) {
        const lookupErrors = []
        if (coachesResult.status === 'fulfilled') setCoachList(coachesResult.value)
        else lookupErrors.push(getErrorMessage(coachesResult.reason, language === 'vi' ? 'Không thể tải Coach.' : 'Could not load coaches.'))
        if (holidaysResult.status === 'fulfilled') setHolidays(holidaysResult.value)
        else lookupErrors.push(getErrorMessage(holidaysResult.reason, language === 'vi' ? 'Không thể tải ngày nghỉ.' : 'Could not load holidays.'))
        setLookupsError(lookupErrors.join(' '))
      }
    })
    return () => { active = false }
  }, [apiEnabled, contextCoaches, language])

  const filteredSessions = apiEnabled ? sessions : sessions.filter((session) => (
    (!filters.classId || String(session.classId) === String(filters.classId))
    && (!filters.coachId || String(session.coachId) === String(filters.coachId))
    && (!filters.roomId || String(session.roomId) === String(filters.roomId))
    && (!filters.startDate || session.sessionDate >= filters.startDate)
    && (!filters.endDate || session.sessionDate <= filters.endDate)
    && (!filters.status || session.status === filters.status)
  ))

  const isOutdoorSession = useCallback((session, targetRoomId) => {
    const room = rooms.find((item) => String(item.id) === String(targetRoomId || session?.roomId))
    const subject = subjects.find((item) => String(item.id) === String(session?.subjectId))
    return room?.outdoor === true || subject?.outdoor === true
  }, [rooms, subjects])

  useEffect(() => {
    if (!rescheduleSessionItem) return undefined
    const outdoor = isOutdoorSession(rescheduleSessionItem, rescheduleForm.newRoomId)
    if (!apiEnabled) {
      setTimeSlots(MOCK_TIME_SLOTS.filter((slot) => !outdoor || slot.outdoorAllowed))
      return undefined
    }
    let active = true
    getSessionTimeSlots(outdoor, { notifyForbidden: false }).then((slots) => {
      if (active) setTimeSlots(slots)
    }).catch((err) => {
      if (active) setFormError(getErrorMessage(err, language === 'vi' ? 'Không thể tải các ca học.' : 'Could not load time slots.'))
    })
    return () => { active = false }
  }, [rescheduleSessionItem, rescheduleForm.newRoomId, apiEnabled, isOutdoorSession, language])

  const selectedSlot = useMemo(() => {
    const [startTime, endTime] = rescheduleForm.slot.split('|')
    return timeSlots.find((slot) => normalizeTime(slot.startTime) === normalizeTime(startTime)
      && normalizeTime(slot.endTime) === normalizeTime(endTime)) || null
  }, [rescheduleForm.slot, timeSlots])

  const openReschedule = (session) => {
    setFormError('')
    setRescheduleSessionItem(session)
    setRescheduleForm({
      newDate: session.sessionDate || '',
      slot: `${normalizeTime(session.startTime) || ''}|${normalizeTime(session.endTime) || ''}`,
      newRoomId: '',
      reason: '',
    })
  }

  const submitReschedule = async (event) => {
    event.preventDefault()
    if (mutationLock.current || busy || !rescheduleSessionItem) return
    const validation = validateRescheduleForm({
      session: rescheduleSessionItem,
      form: { ...rescheduleForm, newStartTime: selectedSlot?.startTime, newEndTime: selectedSlot?.endTime },
      timeSlots,
      holidays,
    })
    if (validation) {
      setFormError(validation)
      return
    }
    if (!canManage) {
      setFormError(language === 'vi' ? 'Tài khoản không có quyền MANAGE_CLASSES.' : 'This account does not have MANAGE_CLASSES permission.')
      return
    }
    const targetRoomId = rescheduleForm.newRoomId || rescheduleSessionItem.roomId
    const targetRoom = rooms.find((room) => String(room.id) === String(targetRoomId))
    if (targetRoom && targetRoom.status !== 'available') {
      setFormError(language === 'vi' ? 'Phòng được chọn không ở trạng thái Available.' : 'The selected room is not Available.')
      return
    }
    if (targetRoom && rescheduleSessionItem.maxCapacity != null && targetRoom.capacity != null
      && rescheduleSessionItem.maxCapacity > targetRoom.capacity) {
      setFormError(language === 'vi' ? 'Sức chứa phòng nhỏ hơn sức chứa tối đa của lớp.' : 'Room capacity is below the class capacity.')
      return
    }
    const newRoomId = rescheduleForm.newRoomId && String(rescheduleForm.newRoomId) !== String(rescheduleSessionItem.roomId)
      ? Number(rescheduleForm.newRoomId)
      : null

    const confirmText = language === 'vi'
      ? `Xác nhận dời buổi ${rescheduleSessionItem.className || `#${rescheduleSessionItem.id}`} sang ${rescheduleForm.newDate}, ${selectedSlot.displayName || `${selectedSlot.startTime}–${selectedSlot.endTime}`}?`
      : `Reschedule ${rescheduleSessionItem.className || `#${rescheduleSessionItem.id}`} to ${rescheduleForm.newDate}, ${selectedSlot.displayName || `${selectedSlot.startTime}–${selectedSlot.endTime}`}?`
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) return

    mutationLock.current = true
    setBusy(true)
    setFormError('')
    try {
      if (apiEnabled) {
        const daySessions = await getSessions({ startDate: rescheduleForm.newDate, endDate: rescheduleForm.newDate }, { notifyForbidden: false })
        const conflict = findSessionConflict(daySessions, {
          sessionId: rescheduleSessionItem.id,
          date: rescheduleForm.newDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          roomId: targetRoomId,
          coachId: rescheduleSessionItem.coachId,
        })
        if (conflict) {
          const conflictName = conflict.session.className || `#${conflict.session.id}`
          throw new Error(conflict.type === 'room'
            ? `${language === 'vi' ? 'Phòng' : 'Room'} ${conflict.session.roomName || targetRoom?.name || ''} ${language === 'vi' ? 'bị trùng lịch với' : 'conflicts with'} ${conflictName}.`
            : `${language === 'vi' ? 'Coach' : 'Coach'} ${conflict.session.coachName || ''} ${language === 'vi' ? 'bị trùng lịch với' : 'conflicts with'} ${conflictName}.`)
        }
      } else {
        const conflict = findSessionConflict(sessions, {
          sessionId: rescheduleSessionItem.id,
          date: rescheduleForm.newDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          roomId: targetRoomId,
          coachId: rescheduleSessionItem.coachId,
        })
        if (conflict) throw new Error(language === 'vi' ? 'Phòng hoặc Coach đã có buổi học trùng giờ.' : 'The room or coach already has a session at that time.')
      }

      const payload = {
        newDate: rescheduleForm.newDate,
        newStartTime: selectedSlot.startTime,
        newEndTime: selectedSlot.endTime,
        newRoomId,
        reason: rescheduleForm.reason.trim(),
      }
      const updated = apiEnabled
        ? await rescheduleSession(rescheduleSessionItem.id, payload, { notifyForbidden: false })
        : { ...rescheduleSessionItem, sessionDate: payload.newDate, startTime: payload.newStartTime, endTime: payload.newEndTime, ...(newRoomId ? { roomId: newRoomId, roomName: targetRoom?.name || null } : {}) }
      if (!apiEnabled && mockSessions.current) {
        mockSessions.current = mockSessions.current.map((item) => String(item.id) === String(updated.id) ? updated : item)
      }
      setSessions((previous) => previous.map((item) => String(item.id) === String(updated.id) ? updated : item))
      showToast?.(language === 'vi' ? 'Đã dời lịch buổi học.' : 'Session rescheduled.', 'success')
      setRescheduleSessionItem(null)
      if (apiEnabled) await loadSessions()
    } catch (err) {
      setFormError(getErrorMessage(err, language === 'vi' ? 'Không thể dời lịch buổi học.' : 'Could not reschedule session.'))
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const openSubstitute = (session) => {
    setFormError('')
    setSubstituteSessionItem(session)
    const candidates = coachesForSession(coachList, session).coaches
    setSubstituteForm({ newCoachId: candidates[0] ? String(candidates[0].id) : '', reason: '' })
  }

  const submitSubstitute = async (event) => {
    event.preventDefault()
    if (mutationLock.current || busy || !substituteSessionItem) return
    if (!canManage) {
      setFormError(language === 'vi' ? 'Tài khoản không có quyền MANAGE_CLASSES.' : 'This account does not have MANAGE_CLASSES permission.')
      return
    }
    if (!substituteForm.newCoachId || String(substituteForm.newCoachId) === String(substituteSessionItem.coachId)) {
      setFormError(language === 'vi' ? 'Chọn một Coach khác.' : 'Choose a different coach.')
      return
    }
    if (!substituteForm.reason.trim()) {
      setFormError(language === 'vi' ? 'Vui lòng nhập lý do thay Coach.' : 'Enter a reason for the coach change.')
      return
    }
    const chosenCoach = coachList.find((coach) => String(coach.id) === String(substituteForm.newCoachId))
    if (!chosenCoach) {
      setFormError(language === 'vi' ? 'Coach được chọn không còn trong danh sách khả dụng.' : 'The selected coach is no longer available.')
      return
    }
    const confirmText = language === 'vi'
      ? `Xác nhận thay Coach ${substituteSessionItem.coachName || ''} bằng ${chosenCoach.name}?`
      : `Replace ${substituteSessionItem.coachName || 'the current coach'} with ${chosenCoach.name}?`
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) return

    mutationLock.current = true
    setBusy(true)
    setFormError('')
    try {
      if (apiEnabled) {
        const daySessions = await getSessions({ startDate: substituteSessionItem.sessionDate, endDate: substituteSessionItem.sessionDate }, { notifyForbidden: false })
        const conflict = findSessionConflict(daySessions, {
          sessionId: substituteSessionItem.id,
          date: substituteSessionItem.sessionDate,
          startTime: substituteSessionItem.startTime,
          endTime: substituteSessionItem.endTime,
          coachId: chosenCoach.id,
        })
        if (conflict?.type === 'coach') {
          throw new Error(`${chosenCoach.name} ${language === 'vi' ? 'đã có lịch trong khung giờ này.' : 'already has a session at this time.'}`)
        }
      } else {
        const conflict = findSessionConflict(sessions, {
          sessionId: substituteSessionItem.id,
          date: substituteSessionItem.sessionDate,
          startTime: substituteSessionItem.startTime,
          endTime: substituteSessionItem.endTime,
          coachId: chosenCoach.id,
        })
        if (conflict?.type === 'coach') throw new Error(language === 'vi' ? 'Coach đã có lịch trong khung giờ này.' : 'The coach already has a session at this time.')
      }

      const updated = apiEnabled
        ? await substituteSessionCoach(substituteSessionItem.id, { newCoachId: Number(chosenCoach.id), reason: substituteForm.reason }, { notifyForbidden: false })
        : { ...substituteSessionItem, coachId: chosenCoach.id, coachName: chosenCoach.name }
      if (!apiEnabled && mockSessions.current) {
        mockSessions.current = mockSessions.current.map((item) => String(item.id) === String(updated.id) ? updated : item)
      }
      setSessions((previous) => previous.map((item) => String(item.id) === String(updated.id) ? updated : item))
      showToast?.(language === 'vi' ? 'Đã thay Coach cho buổi học.' : 'Session coach updated.', 'success')
      setSubstituteSessionItem(null)
      if (apiEnabled) await loadSessions()
    } catch (err) {
      setFormError(getErrorMessage(err, language === 'vi' ? 'Không thể thay Coach.' : 'Could not substitute coach.'))
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const vi = language === 'vi'
  const rescheduleOutdoor = rescheduleSessionItem ? isOutdoorSession(rescheduleSessionItem, rescheduleForm.newRoomId) : false
  const rescheduleCoachCandidates = substituteSessionItem ? coachesForSession(coachList, substituteSessionItem) : { coaches: [], specializationMatched: null }

  return (
    <div className="space-y-6 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3"><div className="rounded border border-blue-200 bg-blue-50 p-2.5 text-blue-800"><CalendarClock className="h-5 w-5" /></div><div><h1 className="text-base font-bold">{vi ? 'Sự cố lịch học' : 'Session incidents'}</h1><p className="mt-1 text-xs text-slate-500">{vi ? 'Xử lý dời lịch và thay Coach cho từng buổi.' : 'Reschedule or substitute the coach for an individual session.'}</p></div></div>
        <button type="button" onClick={loadSessions} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{vi ? 'Tải lại' : 'Refresh'}</button>
      </header>

      {!canManage && <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{vi ? 'Bạn có thể xem lịch; thao tác dời lịch/thay Coach yêu cầu MANAGE_CLASSES.' : 'You can view the schedule; rescheduling and coach changes require MANAGE_CLASSES.'}</p>}
      {lookupsError && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{lookupsError}</p>}
      {listError && <div role="alert" className="flex items-center gap-2 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0" />{listError}</div>}

      <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-700">{vi ? 'Lớp' : 'Class'}<select value={filters.classId} onChange={(event) => setFilters((old) => ({ ...old, classId: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-2"><option value="">{vi ? 'Tất cả lớp' : 'All classes'}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name || `#${item.id}`}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">Coach<select value={filters.coachId} onChange={(event) => setFilters((old) => ({ ...old, coachId: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-2"><option value="">{vi ? 'Tất cả Coach' : 'All coaches'}</option>{coachList.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">{vi ? 'Phòng' : 'Room'}<select value={filters.roomId} onChange={(event) => setFilters((old) => ({ ...old, roomId: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-2"><option value="">{vi ? 'Tất cả phòng' : 'All rooms'}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">{vi ? 'Trạng thái' : 'Status'}<select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-2"><option value="">{vi ? 'Tất cả' : 'All'}</option><option value="Scheduled">Scheduled</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select></label>
        <label className="text-xs font-semibold text-slate-700">{vi ? 'Từ ngày' : 'From'}<input type="date" value={filters.startDate} onChange={(event) => setFilters((old) => ({ ...old, startDate: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-2" /></label>
        <label className="text-xs font-semibold text-slate-700">{vi ? 'Đến ngày' : 'To'}<input type="date" value={filters.endDate} onChange={(event) => setFilters((old) => ({ ...old, endDate: event.target.value }))} className="mt-1 min-h-11 w-full rounded border border-slate-300 bg-slate-50 px-2" /></label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-bold">{vi ? 'Buổi học' : 'Sessions'}</h2><span className="text-xs text-slate-500">{filteredSessions.length}</span></div>
        {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{vi ? 'Đang tải lịch…' : 'Loading sessions…'}</div>}
        {!loading && listError && filteredSessions.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{vi ? 'Không có dữ liệu mới; lịch cũ nếu đã tải vẫn được giữ.' : 'No new data; previously loaded sessions are retained when available.'}</p>}
        {!loading && !listError && filteredSessions.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{vi ? 'Không có buổi học trong bộ lọc này.' : 'No sessions match these filters.'}</p>}
        {!loading && filteredSessions.map((session) => {
          const completed = String(session.status).toLowerCase() === 'completed'
          const cancelled = String(session.status).toLowerCase() === 'cancelled'
          return <article key={session.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{session.className || (vi ? 'Buổi học' : 'Session')}</h3>{session.subjectName && <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">{session.subjectName}</span>}<span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{session.status || '—'}</span></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{session.sessionDate || '—'}</span><span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{String(session.startTime || '').slice(0, 5) || '—'}–{String(session.endTime || '').slice(0, 5) || '—'}</span><span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{session.coachName || '—'}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{session.roomName || '—'}</span></div></div><div className="flex flex-wrap gap-2">{canManage && !completed && <button type="button" onClick={() => openReschedule(session)} className="inline-flex min-h-10 items-center gap-2 rounded border border-slate-300 px-3 text-xs font-bold hover:bg-slate-50"><CalendarClock className="h-4 w-4" />{vi ? 'Dời lịch' : 'Reschedule'}</button>}{canManage && !completed && !cancelled && <button type="button" onClick={() => openSubstitute(session)} disabled={apiEnabled && !coachList.length} className="inline-flex min-h-10 items-center gap-2 rounded border border-slate-300 px-3 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"><UserRoundCog className="h-4 w-4" />{vi ? 'Thay Coach' : 'Substitute coach'}</button>}</div></div>{session.enrolledCount != null && session.maxCapacity != null && <p className="mt-3 text-xs text-slate-500">{vi ? 'Số học viên' : 'Enrolled'}: {session.enrolledCount}/{session.maxCapacity}</p>}</article>
        })}
      </section>

      {rescheduleSessionItem && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"><section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl"><header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div><h2 className="font-bold">{vi ? 'Dời lịch buổi học' : 'Reschedule session'}</h2><p className="mt-1 text-xs text-slate-500">{rescheduleSessionItem.className} · {rescheduleSessionItem.sessionDate} · {String(rescheduleSessionItem.startTime || '').slice(0, 5)}–{String(rescheduleSessionItem.endTime || '').slice(0, 5)}</p></div><button type="button" onClick={() => !busy && setRescheduleSessionItem(null)} disabled={busy} aria-label="Close" className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></header><form onSubmit={submitReschedule} className="space-y-3"><label className="block text-xs font-semibold">{vi ? 'Ngày mới' : 'New date'}<input type="date" required min={localDateString()} value={rescheduleForm.newDate} onChange={(event) => { setRescheduleForm((old) => ({ ...old, newDate: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label><label className="block text-xs font-semibold">{vi ? 'Ca học chuẩn' : 'Standard time slot'}<select required value={rescheduleForm.slot} onChange={(event) => { setRescheduleForm((old) => ({ ...old, slot: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="">{vi ? 'Chọn ca' : 'Select a slot'}</option>{timeSlots.map((slot) => <option key={slot.slotNumber} value={`${slot.startTime}|${slot.endTime}`}>{slot.displayName || `${slot.name} (${String(slot.startTime).slice(0, 5)}–${String(slot.endTime).slice(0, 5)})`}</option>)}</select>{rescheduleOutdoor && <span className="mt-1 block text-[11px] text-slate-500">{vi ? 'Các ca bị khóa đối với Outdoor đã được loại theo danh sách Backend.' : 'Backend time slots blocked for outdoor sessions are excluded.'}</span>}</label><label className="block text-xs font-semibold">{vi ? 'Phòng mới (không bắt buộc)' : 'New room (optional)'}<select value={rescheduleForm.newRoomId} onChange={(event) => { setRescheduleForm((old) => ({ ...old, newRoomId: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="">{vi ? `Giữ phòng hiện tại: ${rescheduleSessionItem.roomName || '—'}` : `Keep current room: ${rescheduleSessionItem.roomName || '—'}`}</option>{rooms.filter((room) => room.status === 'available' && String(room.id) !== String(rescheduleSessionItem.roomId)).map((room) => <option key={room.id} value={room.id}>{room.name}{room.location ? ` · ${room.location}` : ''}</option>)}</select></label><label className="block text-xs font-semibold">{vi ? 'Lý do sự cố' : 'Incident reason'}<textarea required maxLength={500} value={rescheduleForm.reason} onChange={(event) => { setRescheduleForm((old) => ({ ...old, reason: event.target.value })); setFormError('') }} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3" /></label>{rescheduleSessionItem.isPrivate && <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{vi ? 'Backend có thể tự gia hạn gói private khi ngày mới vượt hạn gói. Frontend không gửi extendValidityDays.' : 'Backend may extend a private package when the new date exceeds its expiry. The frontend will not send extendValidityDays.'}</p>}{formError && <p role="alert" className="rounded bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" disabled={busy} onClick={() => setRescheduleSessionItem(null)} className="min-h-11 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Hủy' : 'Cancel'}</button><button type="submit" disabled={busy || !timeSlots.length || !canManage} className="inline-flex min-h-11 items-center gap-2 rounded bg-[#BA0000] px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Xác nhận dời lịch' : 'Confirm reschedule'}</button></footer></form></section></div>}

      {substituteSessionItem && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"><section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"><header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div><h2 className="font-bold">{vi ? 'Thay Coach' : 'Substitute coach'}</h2><p className="mt-1 text-xs text-slate-500">{substituteSessionItem.className} · {substituteSessionItem.sessionDate} · {substituteSessionItem.coachName || '—'}</p></div><button type="button" onClick={() => !busy && setSubstituteSessionItem(null)} disabled={busy} aria-label="Close" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><form onSubmit={submitSubstitute} className="space-y-3"><label className="block text-xs font-semibold">{vi ? 'Coach thay thế' : 'Replacement coach'}<select required value={substituteForm.newCoachId} onChange={(event) => { setSubstituteForm((old) => ({ ...old, newCoachId: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="">{vi ? 'Chọn Coach' : 'Select coach'}</option>{rescheduleCoachCandidates.coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}{coach.specializations?.length ? ` · ${coach.specializations.join(', ')}` : ''}</option>)}</select></label>{rescheduleCoachCandidates.specializationMatched === false && <p className="text-xs text-amber-800">{vi ? 'API Coach không trả về chuyên môn khớp chính xác với môn học; không có Coach nào được đề xuất.' : 'The Coach API returned no exact specialization match for this subject; no coach is suggested.'}</p>}<label className="block text-xs font-semibold">{vi ? 'Lý do thay Coach' : 'Reason'}<textarea required maxLength={500} value={substituteForm.reason} onChange={(event) => { setSubstituteForm((old) => ({ ...old, reason: event.target.value })); setFormError('') }} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3" /></label>{formError && <p role="alert" className="rounded bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" disabled={busy} onClick={() => setSubstituteSessionItem(null)} className="min-h-11 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Hủy' : 'Cancel'}</button><button type="submit" disabled={busy || !substituteForm.newCoachId || !canManage} className="inline-flex min-h-11 items-center gap-2 rounded bg-[#BA0000] px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Xác nhận thay Coach' : 'Confirm coach change'}</button></footer></form></section></div>}
    </div>
  )
}

export default SessionIncidentsView

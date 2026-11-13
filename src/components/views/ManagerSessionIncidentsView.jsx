import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserRound,
  UserRoundCog,
  X,
} from 'lucide-react'
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
  createRescheduleRequestKey,
  validateRescheduleForm,
} from '../../api/sessionIncidentUtils.js'
import { canManageClasses } from '../../api/holidayUtils.js'
import CenterIncidentsPanel from './CenterIncidentsPanel.jsx'

const localizeSessionActionError = (error, fallback, isVi) => {
  const message = getErrorMessage(error, fallback)
  if (!isVi) return message
  const code = String(error?.code || error?.details?.code || '')
  if (code === 'REASON_REQUIRED' || /REASON_REQUIRED/i.test(message)) return 'Vui lòng nhập lý do chi tiết.'
  if (code === 'INVALID_RESCHEDULE_CAUSE' || /INVALID_RESCHEDULE_CAUSE/i.test(message)) return 'Vui lòng chọn nguyên nhân dời lịch hợp lệ.'
  if (/ROOM_CONFLICT/i.test(code) || (/room/i.test(message) && /(conflict|overlap|already booked|occupied)/i.test(message))) return 'Phòng đã có buổi học khác trong khung giờ đã chọn.'
  if (/COACH_CONFLICT/i.test(code) || (/coach/i.test(message) && /(conflict|overlap|already has a session|already booked)/i.test(message))) return 'Coach đã có buổi học khác trong khung giờ đã chọn.'
  if (/RESCHEDULE.*(CUTOFF|DEADLINE|WINDOW)|cutoff.*reschedul|reschedul.*(cutoff|deadline|too late|after|before|window)/i.test(`${code} ${message}`)) return 'Đã quá thời hạn cho phép dời lịch buổi học.'
  if (/supply a key of 1-80 safe characters/i.test(message)) return 'Khóa yêu cầu phải có từ 1 đến 80 ký tự an toàn.'
  if (/room.*(unavailable|not available)|room.*not found/i.test(message)) return 'Phòng được chọn không còn khả dụng hoặc không tồn tại.'
  if (/session.*not found/i.test(message)) return 'Không tìm thấy buổi học.'
  if (/forbidden|access denied|not authorized/i.test(message)) return 'Tài khoản không có quyền thực hiện thao tác này.'
  return fallback
}

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
  const [rescheduleForm, setRescheduleForm] = useState({ newDate: '', slot: '', newRoomId: '', cause: 'CENTER_INCIDENT', reason: '' })
  const [substituteForm, setSubstituteForm] = useState({ newCoachId: '', reason: '' })
  const [timeSlots, setTimeSlots] = useState([])
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('sessions')
  const [incidentStats, setIncidentStats] = useState({ total: 0, pending: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const requestId = useRef(0)
  const mutationLock = useRef(false)
  const mockSessions = useRef(null)
  const rescheduleRequestsRef = useRef(new Map())

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
      if (active) setFormError(localizeSessionActionError(err, language === 'vi' ? 'Không thể tải các ca học.' : 'Could not load time slots.', language === 'vi'))
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
      cause: 'CENTER_INCIDENT',
      reason: '',
    })
  }

  const submitReschedule = async (event) => {
    event.preventDefault()
    if (mutationLock.current || busy || !rescheduleSessionItem) return
    if (!rescheduleForm.reason.trim()) {
      setFormError(language === 'vi' ? 'Vui lòng nhập lý do chi tiết.' : 'Please enter a detailed reason.')
      return
    }
    const validation = validateRescheduleForm({
      session: rescheduleSessionItem,
      form: { ...rescheduleForm, reason: rescheduleForm.reason || rescheduleForm.cause, newStartTime: selectedSlot?.startTime, newEndTime: selectedSlot?.endTime },
      timeSlots,
      holidays,
    })
    if (validation) {
      setFormError(language === 'vi' && /^[\x00-\x7F]*$/.test(validation)
        ? 'Thông tin dời lịch chưa hợp lệ. Vui lòng kiểm tra lại ngày, ca học và phòng.'
        : validation)
      return
    }
    if (!canManage) {
      setFormError(language === 'vi' ? 'Tài khoản không có quyền MANAGE_CLASSES.' : 'This account does not have MANAGE_CLASSES permission.')
      return
    }
    if (rescheduleForm.newRoomId) {
      const selectedNewRoom = rooms.find((room) => String(room.id) === String(rescheduleForm.newRoomId))
      if (!selectedNewRoom || String(selectedNewRoom.status || '').trim().toLowerCase() !== 'available') {
        setFormError(language === 'vi' ? 'Phòng mới được chọn không còn khả dụng hoặc không tồn tại.' : 'The selected new room is not available.')
        return
      }
    }
    const targetRoomId = rescheduleForm.newRoomId || rescheduleSessionItem.roomId
    const targetRoom = rooms.find((room) => String(room.id) === String(targetRoomId))
    if (targetRoom && String(targetRoom.status || '').trim().toLowerCase() !== 'available') {
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
        cause: rescheduleForm.cause,
        reason: rescheduleForm.reason.trim(),
      }
      let requestPayload = payload
      if (apiEnabled) {
        const fingerprint = JSON.stringify({ sessionId: rescheduleSessionItem.id, ...payload })
        let requestKey = rescheduleRequestsRef.current.get(fingerprint)
        if (!requestKey) {
          requestKey = createRescheduleRequestKey(rescheduleSessionItem.id)
          rescheduleRequestsRef.current.set(fingerprint, requestKey)
        }
        requestPayload = { ...payload, requestKey }
      }
      const updated = apiEnabled
        ? await rescheduleSession(rescheduleSessionItem.id, requestPayload, { notifyForbidden: false })
        : { ...rescheduleSessionItem, sessionDate: payload.newDate, startTime: payload.newStartTime, endTime: payload.newEndTime, ...(newRoomId ? { roomId: newRoomId, roomName: targetRoom?.name || null } : {}) }
      rescheduleRequestsRef.current.clear()
      if (!apiEnabled && mockSessions.current) {
        mockSessions.current = mockSessions.current.map((item) => String(item.id) === String(updated.id) ? updated : item)
      }
      setSessions((previous) => previous.map((item) => String(item.id) === String(updated.id) ? updated : item))
      showToast?.(language === 'vi' ? 'Đã dời lịch buổi học.' : 'Session rescheduled.', 'success')
      setRescheduleSessionItem(null)
      if (apiEnabled) await loadSessions()
    } catch (err) {
      setFormError(localizeSessionActionError(err, language === 'vi' ? 'Không thể dời lịch buổi học.' : 'Could not reschedule session.', language === 'vi'))
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
      setFormError(localizeSessionActionError(err, language === 'vi' ? 'Không thể thay Coach.' : 'Could not substitute coach.', language === 'vi'))
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const vi = language === 'vi'
  const rescheduleOutdoor = rescheduleSessionItem ? isOutdoorSession(rescheduleSessionItem, rescheduleForm.newRoomId) : false
  const rescheduleCoachCandidates = substituteSessionItem ? coachesForSession(coachList, substituteSessionItem) : { coaches: [], specializationMatched: null }

  const defaultStartDate = useMemo(() => localDateString(), [])
  const defaultEndDate = useMemo(() => addDays(localDateString(), 30), [])
  const isFiltered = Boolean(
    filters.classId ||
    filters.coachId ||
    filters.roomId ||
    filters.status !== 'Scheduled' ||
    filters.startDate !== defaultStartDate ||
    filters.endDate !== defaultEndDate
  )

  const handleResetFilters = () => {
    setFilters({
      classId: '',
      coachId: '',
      roomId: '',
      startDate: defaultStartDate,
      endDate: defaultEndDate,
      status: 'Scheduled',
    })
    setCurrentPage(1)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [filters])

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize))
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredSessions.slice(start, start + pageSize)
  }, [filteredSessions, currentPage, pageSize])

  return (
    <div className="space-y-5 text-slate-900">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-brand-primary shadow-2xs">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              {vi ? 'Sự cố & Điều phối lịch học' : 'Session Incidents & Scheduling'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {vi ? 'Xử lý dời lịch, thay thế HLV và giải quyết các sự cố vận hành của trung tâm.' : 'Reschedule sessions, substitute coaches, and manage center incidents.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadSessions}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          {vi ? 'Tải lại' : 'Refresh'}
        </button>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'sessions'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <CalendarClock className="h-4 w-4" />
          <span>{vi ? 'Điều phối & Dời lịch buổi học' : 'Session Scheduling'}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            activeTab === 'sessions' ? 'bg-brand-blue-soft text-brand-primary' : 'bg-slate-100 text-slate-600'
          }`}>
            {filteredSessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('center-incidents')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'center-incidents'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span>{vi ? 'Sự cố cấp trung tâm' : 'Center Incidents'}</span>
          {incidentStats.total > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              incidentStats.pending > 0
                ? 'border border-amber-200 bg-amber-100 text-amber-800'
                : activeTab === 'center-incidents'
                  ? 'bg-brand-blue-soft text-brand-primary'
                  : 'bg-slate-100 text-slate-600'
            }`}>
              {incidentStats.total}
            </span>
          )}
          {incidentStats.pending > 0 && (
            <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" title={vi ? 'Có sự cố chờ xử lý' : 'Pending incidents'} />
          )}
        </button>
      </div>

      {activeTab === 'center-incidents' ? (
        <CenterIncidentsPanel
          apiEnabled={apiEnabled}
          currentUser={currentUser}
          language={language}
          showToast={showToast}
          onIncidentsChange={setIncidentStats}
        />
      ) : (
        <div className="space-y-4">
          {!canManage && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{vi ? 'Tài khoản của bạn có quyền xem lịch; các thao tác dời lịch hoặc thay Coach yêu cầu quyền quản lý lớp học.' : 'You can view the schedule; rescheduling and coach substitution require class management permissions.'}</span>
            </div>
          )}
          {lookupsError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{lookupsError}</p>}
          {listError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{listError}</span>
            </div>
          )}

          {/* Filter Bar */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <span>{vi ? 'Bộ lọc tìm kiếm buổi học' : 'Filter sessions'}</span>
              </div>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:text-brand-primary/80 transition"
                >
                  <RotateCcw className="h-3 w-3" />
                  {vi ? 'Đặt lại bộ lọc' : 'Reset filters'}
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label className="text-xs font-semibold text-slate-700">
                {vi ? 'Lớp học' : 'Class'}
                <select
                  value={filters.classId}
                  onChange={(event) => setFilters((old) => ({ ...old, classId: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-800 focus:border-brand-primary focus:bg-white focus:outline-hidden"
                >
                  <option value="">{vi ? 'Tất cả lớp' : 'All classes'}</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.name || `#${item.id}`}</option>)}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                Coach
                <select
                  value={filters.coachId}
                  onChange={(event) => setFilters((old) => ({ ...old, coachId: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-800 focus:border-brand-primary focus:bg-white focus:outline-hidden"
                >
                  <option value="">{vi ? 'Tất cả Coach' : 'All coaches'}</option>
                  {coachList.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {vi ? 'Phòng / Sân' : 'Room'}
                <select
                  value={filters.roomId}
                  onChange={(event) => setFilters((old) => ({ ...old, roomId: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-800 focus:border-brand-primary focus:bg-white focus:outline-hidden"
                >
                  <option value="">{vi ? 'Tất cả phòng' : 'All rooms'}</option>
                  {rooms.map((room) => <option key={room.id} value={room.id}>{room.roomCode ? `${String(room.roomCode).trim()} - ${room.name}` : room.name}</option>)}
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {vi ? 'Trạng thái' : 'Status'}
                <select
                  value={filters.status}
                  onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-800 focus:border-brand-primary focus:bg-white focus:outline-hidden"
                >
                  <option value="">{vi ? 'Tất cả' : 'All'}</option>
                  <option value="Scheduled">{vi ? 'Đã lên lịch (Scheduled)' : 'Scheduled'}</option>
                  <option value="Completed">{vi ? 'Hoàn thành (Completed)' : 'Completed'}</option>
                  <option value="Cancelled">{vi ? 'Đã hủy (Cancelled)' : 'Cancelled'}</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {vi ? 'Từ ngày' : 'From'}
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters((old) => ({ ...old, startDate: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 text-xs text-slate-800 focus:border-brand-primary focus:bg-white focus:outline-hidden"
                />
              </label>

              <label className="text-xs font-semibold text-slate-700">
                {vi ? 'Đến ngày' : 'To'}
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters((old) => ({ ...old, endDate: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 text-xs text-slate-800 focus:border-brand-primary focus:bg-white focus:outline-hidden"
                />
              </label>
            </div>
          </section>

          {/* Sessions List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {vi ? 'Danh sách buổi học' : 'Sessions list'}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {vi ? `Tổng số: ${filteredSessions.length} buổi` : `Total: ${filteredSessions.length} sessions`}
              </span>
            </div>

            {loading && (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand-primary" />
                {vi ? 'Đang tải danh sách lịch học…' : 'Loading sessions…'}
              </div>
            )}
            {!loading && listError && filteredSessions.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-xs">
                {vi ? 'Không có dữ liệu mới; lịch cũ nếu đã tải vẫn được giữ.' : 'No new data; previously loaded sessions are retained when available.'}
              </div>
            )}
            {!loading && !listError && filteredSessions.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-xs">
                <p className="font-semibold text-slate-700">{vi ? 'Không tìm thấy buổi học phù hợp' : 'No sessions match these filters'}</p>
                <p className="mt-1 text-slate-400">{vi ? 'Hãy thử điều chỉnh lại bộ lọc thời gian hoặc lớp học.' : 'Try adjusting the date range or filters.'}</p>
              </div>
            )}

            {!loading && paginatedSessions.map((session) => {
              const status = String(session.status || '').toLowerCase()
              const completed = status === 'completed'
              const cancelled = status === 'cancelled' || status === 'canceled'

              return (
                <article
                  key={session.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">
                          {session.className || (vi ? 'Buổi học' : 'Session')}
                        </h3>
                        {session.subjectName && (
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                            {session.subjectName}
                          </span>
                        )}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          completed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : cancelled
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-brand-blue-soft text-brand-primary border-blue-200'
                        }`}>
                          {session.status || '—'}
                        </span>
                        {session.enrolledCount != null && session.maxCapacity != null && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                            {vi ? `Học viên: ${session.enrolledCount}/${session.maxCapacity}` : `Enrolled: ${session.enrolledCount}/${session.maxCapacity}`}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                          {session.sessionDate || '—'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                          {String(session.startTime || '').slice(0, 5) || '—'} – {String(session.endTime || '').slice(0, 5) || '—'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <UserRound className="h-3.5 w-3.5 text-slate-400" />
                          {session.coachName || (vi ? 'Chưa phân công Coach' : 'No Coach assigned')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {session.roomName || (vi ? 'Chưa xếp phòng' : 'No room assigned')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                      {canManage && !completed && (
                        <button
                          type="button"
                          onClick={() => openReschedule(session)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                        >
                          <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                          {vi ? 'Dời lịch' : 'Reschedule'}
                        </button>
                      )}
                      {canManage && !completed && !cancelled && (
                        <button
                          type="button"
                          onClick={() => openSubstitute(session)}
                          disabled={apiEnabled && !coachList.length}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 transition"
                        >
                          <UserRoundCog className="h-3.5 w-3.5 text-slate-500" />
                          {vi ? 'Thay Coach' : 'Substitute coach'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}

            {/* Pagination Controls */}
            {!loading && filteredSessions.length > pageSize && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
                <span className="text-xs text-slate-500">
                  {vi
                    ? `Hiển thị ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredSessions.length)} trên tổng số ${filteredSessions.length} buổi`
                    : `Showing ${(currentPage - 1) * pageSize + 1} - ${Math.min(currentPage * pageSize, filteredSessions.length)} of ${filteredSessions.length} sessions`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>{vi ? 'Trước' : 'Prev'}</span>
                  </button>
                  <span className="px-2 text-xs font-semibold text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>{vi ? 'Sau' : 'Next'}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {rescheduleSessionItem && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"><section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl"><header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div><h2 className="font-bold">{vi ? 'Dời lịch buổi học' : 'Reschedule session'}</h2><p className="mt-1 text-xs text-slate-500">{rescheduleSessionItem.className} · {rescheduleSessionItem.sessionDate} · {String(rescheduleSessionItem.startTime || '').slice(0, 5)}–{String(rescheduleSessionItem.endTime || '').slice(0, 5)}</p></div><button type="button" onClick={() => !busy && setRescheduleSessionItem(null)} disabled={busy} aria-label="Close" className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></header><form onSubmit={submitReschedule} className="space-y-3"><label className="block text-xs font-semibold">{vi ? 'Ngày mới' : 'New date'}<input type="date" required min={localDateString()} value={rescheduleForm.newDate} onChange={(event) => { setRescheduleForm((old) => ({ ...old, newDate: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3" /></label><label className="block text-xs font-semibold">{vi ? 'Ca học chuẩn' : 'Standard time slot'}<select required value={rescheduleForm.slot} onChange={(event) => { setRescheduleForm((old) => ({ ...old, slot: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="">{vi ? 'Chọn ca' : 'Select a slot'}</option>{timeSlots.map((slot) => <option key={slot.slotNumber} value={`${slot.startTime}|${slot.endTime}`}>{slot.displayName || `${slot.name} (${String(slot.startTime).slice(0, 5)}–${String(slot.endTime).slice(0, 5)})`}</option>)}</select>{rescheduleOutdoor && <span className="mt-1 block text-xs text-slate-500">{vi ? 'Các ca học ngoài trời đã được tự động giới hạn khung giờ phù hợp.' : 'Time slots for outdoor sessions have been automatically adjusted.'}</span>}</label><label className="block text-xs font-semibold">{vi ? 'Phòng mới (không bắt buộc)' : 'New room (optional)'}<select value={rescheduleForm.newRoomId} onChange={(event) => { setRescheduleForm((old) => ({ ...old, newRoomId: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="">{vi ? `Giữ phòng hiện tại: ${rescheduleSessionItem.roomName || '—'}` : `Keep current room: ${rescheduleSessionItem.roomName || '—'}`}</option>{rescheduleForm.newRoomId && !rooms.some((r) => String(r.id) === String(rescheduleForm.newRoomId) && String(r.status || '').trim().toLowerCase() === 'available') && <option key={rescheduleForm.newRoomId} value={rescheduleForm.newRoomId} disabled>{vi ? `Phòng #${rescheduleForm.newRoomId} (không còn khả dụng)` : `Room #${rescheduleForm.newRoomId} (not available)`}</option>}{rooms.filter((room) => String(room.status || '').trim().toLowerCase() === 'available' && String(room.id) !== String(rescheduleSessionItem.roomId)).map((room) => { const roomLabel = room.roomCode ? `${String(room.roomCode).trim()} - ${room.name}` : room.name; return <option key={room.id} value={room.id}>{roomLabel}{room.location ? ` · ${room.location}` : ''}</option> })}</select></label><label className="block text-xs font-semibold">{vi ? 'Phân loại nguyên nhân' : 'Reason category'}<select required value={rescheduleForm.cause} onChange={(event) => { setRescheduleForm((old) => ({ ...old, cause: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="CENTER_INCIDENT">{vi ? 'Sự cố từ trung tâm / HLV' : 'Center / Coach incident'}</option><option value="MEMBER_EARLY">{vi ? 'Học viên báo sớm' : 'Member gave early notice'}</option><option value="MEMBER_EMERGENCY">{vi ? 'Học viên có việc khẩn cấp' : 'Member emergency'}</option></select></label><label className="block text-xs font-semibold">{vi ? 'Lý do chi tiết *' : 'Detailed reason *'}<textarea required maxLength={2000} value={rescheduleForm.reason} onChange={(event) => { setRescheduleForm((old) => ({ ...old, reason: event.target.value })); setFormError('') }} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3" /></label>{rescheduleSessionItem.isPrivate && <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{vi ? 'Đối với gói kèm riêng, thời hạn gói có thể được hệ thống tự động gia hạn nếu ngày học mới vượt quá hạn dùng hiện tại.' : 'For private packages, package validity may be automatically extended by the system if the new date exceeds the current package expiry.'}</p>}{formError && <p role="alert" className="rounded bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" disabled={busy} onClick={() => setRescheduleSessionItem(null)} className="min-h-11 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Hủy' : 'Cancel'}</button><button type="submit" disabled={busy || !timeSlots.length || !canManage} className="inline-flex min-h-11 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Xác nhận dời lịch' : 'Confirm reschedule'}</button></footer></form></section></div>}

      {substituteSessionItem && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4"><section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"><header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><div><h2 className="font-bold">{vi ? 'Thay Coach' : 'Substitute coach'}</h2><p className="mt-1 text-xs text-slate-500">{substituteSessionItem.className} · {substituteSessionItem.sessionDate} · {substituteSessionItem.coachName || '—'}</p></div><button type="button" onClick={() => !busy && setSubstituteSessionItem(null)} disabled={busy} aria-label="Close" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><form onSubmit={submitSubstitute} className="space-y-3"><label className="block text-xs font-semibold">{vi ? 'Coach thay thế' : 'Replacement coach'}<select required value={substituteForm.newCoachId} onChange={(event) => { setSubstituteForm((old) => ({ ...old, newCoachId: event.target.value })); setFormError('') }} className="mt-1 min-h-11 w-full rounded border border-slate-300 px-3"><option value="">{vi ? 'Chọn Coach' : 'Select coach'}</option>{rescheduleCoachCandidates.coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.name}{coach.specializations?.length ? ` · ${coach.specializations.join(', ')}` : ''}</option>)}</select></label>{rescheduleCoachCandidates.specializationMatched === false && <p className="text-xs text-amber-800">{vi ? 'Chưa tìm thấy huấn luyện viên có chuyên môn tương ứng với môn học này.' : 'No coach with matching specialization was found for this subject.'}</p>}<label className="block text-xs font-semibold">{vi ? 'Lý do thay Coach' : 'Reason'}<textarea required maxLength={500} value={substituteForm.reason} onChange={(event) => { setSubstituteForm((old) => ({ ...old, reason: event.target.value })); setFormError('') }} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3" /></label>{formError && <p role="alert" className="rounded bg-rose-50 p-3 text-xs text-rose-800">{formError}</p>}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" disabled={busy} onClick={() => setSubstituteSessionItem(null)} className="min-h-11 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Hủy' : 'Cancel'}</button><button type="submit" disabled={busy || !substituteForm.newCoachId || !canManage} className="inline-flex min-h-11 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Xác nhận thay Coach' : 'Confirm coach change'}</button></footer></form></section></div>}
    </div>
  )
}

export default SessionIncidentsView

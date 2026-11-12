import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react'
import { getErrorMessage } from '../../api/apiErrors.js'
import { getCoaches, getRooms, getSessions, getSubjects } from '../../api/managerApi.js'
import {
  canManageCenterIncident,
  compensateCenterIncident,
  createCenterIncidentRequestKey,
  createNormalMakeup,
  getCenterIncidentError,
  getCenterIncidentSessionType,
  listCenterIncidents,
  openCenterIncident,
  resolveCenterIncident,
} from '../../api/centerIncidentApi.js'

const cardClass = 'rounded-lg border border-slate-200 bg-white p-4 shadow-xs'
const fieldClass = 'mt-1 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm'
const localDateTime = (value) => typeof value === 'string' ? value.replace('T', ' ').slice(0, 19) : '—'
const present = (value) => value === null || value === undefined || value === '' ? 'Chưa có thông tin' : String(value)
const memberCount = (ids) => Array.isArray(ids) && ids.every((id) => Number.isInteger(id) && id > 0) ? ids.length : null
const knownIncidentStatus = (status) => status === 'WaitingForRecovery' || status === 'Resolved'
const hcmToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const fingerprint = (value) => JSON.stringify(value)

export const incidentFieldText = (value) => present(value)
export const incidentMemberCount = (ids) => memberCount(ids)

function CenterIncidentsPanel({ apiEnabled, currentUser, language, showToast, onIncidentsChange }) {
  const vi = language === 'vi'
  const actorActive = String(currentUser?.status || '').trim().toLowerCase() === 'active'
  const validCenter = Number.isInteger(currentUser?.centerId) && currentUser.centerId > 0
  const hasManagerPermission = apiEnabled && actorActive && validCenter && canManageCenterIncident(currentUser)
  const [incidents, setIncidents] = useState([])
  const [incidentsLoading, setIncidentsLoading] = useState(apiEnabled)
  const [incidentsLoaded, setIncidentsLoaded] = useState(false)
  const [incidentsError, setIncidentsError] = useState('')
  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(apiEnabled)
  const [sessionsError, setSessionsError] = useState('')
  const [rooms, setRooms] = useState([])
  const [coaches, setCoaches] = useState([])
  const [resourcesLoading, setResourcesLoading] = useState(apiEnabled)
  const [resourcesError, setResourcesError] = useState('')
  const [action, setAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [openForm, setOpenForm] = useState({ sessionId: '', startedAt: '', reason: '', evidence: '' })
  const [resolveForm, setResolveForm] = useState({ endedAt: '' })
  const [compensateForm, setCompensateForm] = useState({ reason: '', verifiedNotHeld: false })
  const [makeupForm, setMakeupForm] = useState({ date: '', startTime: '', endTime: '', roomId: '', coachId: '', reason: '' })
  const openRequestRef = useRef(null)
  const mutationLock = useRef(false)

  const loadIncidents = useCallback(async () => {
    if (!apiEnabled) return false
    setIncidentsLoading(true)
    setIncidentsError('')
    try {
      const data = await listCenterIncidents({ notifyForbidden: false })
      setIncidents(data)
      setIncidentsLoaded(true)
      const pendingOpen = openRequestRef.current
      if (pendingOpen) {
        const found = data.some((item) => (
          String(item.sessionId) === String(pendingOpen.payload.sessionId)
          && String(item.startedAt || '').startsWith(pendingOpen.payload.startedAt)
          && item.reason === pendingOpen.payload.reason
          && item.evidence === pendingOpen.payload.evidence
        ))
        if (found && pendingOpen.uncertain) {
          setFeedback({ type: 'success', message: vi ? 'Đã tìm thấy sự cố trong dữ liệu mới tải. Không gửi lại yêu cầu.' : 'The incident is present in the refreshed list. No request was resubmitted.' })
          setAction(null)
          openRequestRef.current = null
        }
      }
      return true
    } catch (error) {
      setIncidentsError(getErrorMessage(error, vi ? 'Không thể tải danh sách sự cố trung tâm.' : 'Could not load center incidents.'))
      setIncidentsLoaded(false)
      return false
    } finally {
      setIncidentsLoading(false)
    }
  }, [apiEnabled, vi])

  const loadSessions = useCallback(async () => {
    if (!apiEnabled) return false
    setSessionsLoading(true)
    setSessionsError('')
    try {
      const [sessionResult, subjectResult] = await Promise.allSettled([
        getSessions({}, { notifyForbidden: false }),
        getSubjects({ notifyForbidden: false }),
      ])
      if (sessionResult.status === 'rejected') throw sessionResult.reason
      setSessions(sessionResult.value)
      setSubjects(subjectResult.status === 'fulfilled' ? subjectResult.value : [])
      return true
    } catch (error) {
      setSessionsError(getErrorMessage(error, vi ? 'Không thể tải danh sách buổi học.' : 'Could not load sessions.'))
      return false
    } finally {
      setSessionsLoading(false)
    }
  }, [apiEnabled, vi])

  const loadResources = useCallback(async () => {
    if (!apiEnabled || !hasManagerPermission) return false
    setResourcesLoading(true)
    setResourcesError('')
    const [roomResult, coachResult] = await Promise.allSettled([
      getRooms({ notifyForbidden: false }),
      getCoaches({ notifyForbidden: false }),
    ])
    const errors = []
    if (roomResult.status === 'fulfilled') setRooms(roomResult.value)
    else errors.push(getErrorMessage(roomResult.reason, vi ? 'Không thể tải danh sách phòng.' : 'Could not load rooms.'))
    if (coachResult.status === 'fulfilled') setCoaches(coachResult.value)
    else errors.push(getErrorMessage(coachResult.reason, vi ? 'Không thể tải danh sách Coach.' : 'Could not load coaches.'))
    setResourcesError(errors.join(' '))
    setResourcesLoading(false)
    return errors.length === 0
  }, [apiEnabled, hasManagerPermission, vi])

  useEffect(() => {
    if (!apiEnabled) return
    void loadIncidents()
    void loadSessions()
  }, [apiEnabled, loadIncidents, loadSessions])

  useEffect(() => {
    if (!apiEnabled || !hasManagerPermission) return
    void loadResources()
  }, [apiEnabled, hasManagerPermission, loadResources])

  useEffect(() => {
    onIncidentsChange?.({
      total: incidents.length,
      pending: incidents.filter((i) => i.status === 'WaitingForRecovery').length,
    })
  }, [incidents, onIncidentsChange])

  const sessionById = useMemo(() => new Map(sessions.map((session) => [String(session.id), session])), [sessions])
  const sessionsBySubject = useMemo(() => {
    const normalize = (value) => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    const subjectList = subjects.length
      ? subjects
      : [...new Map(sessions
          .filter((session) => session.subjectName)
          .map((session) => [normalize(session.subjectName), { id: session.subjectId || session.subjectName, name: session.subjectName }]))
          .values()]
    const groups = subjectList.map((subject) => ({ subject, sessions: [] }))
    const matchByName = [...groups].sort((a, b) => normalize(b.subject.name).length - normalize(a.subject.name).length)

    sessions.forEach((session) => {
      let group = session.subjectId == null
        ? null
        : groups.find(({ subject }) => subject.id != null && String(subject.id) === String(session.subjectId))
      const sessionSubjectName = normalize(session.subjectName)
      if (!group && sessionSubjectName) {
        group = groups.find(({ subject }) => normalize(subject.name) === sessionSubjectName)
      }
      if (!group) {
        const sessionLabel = normalize(`${session.subjectName || ''} ${session.className || ''}`)
        group = matchByName.find(({ subject }) => {
          const subjectName = normalize(subject.name)
          const subjectSlug = normalize(subject.slug)
          return (subjectName && sessionLabel.includes(subjectName)) || (subjectSlug && sessionLabel.includes(subjectSlug))
        })
      }
      if (group) group.sessions.push(session)
    })

    return groups
  }, [sessions, subjects])
  const canOpenIncident = hasManagerPermission && incidentsLoaded && !incidentsError && !sessionsLoading && !sessionsError && sessions.length > 0 && !needsRefresh
  const selectedActionIncident = action?.incident || null
  const selectedSession = selectedActionIncident ? sessionById.get(String(selectedActionIncident.sessionId)) : null
  const selectedType = selectedActionIncident && !sessionsLoading && !sessionsError
    ? getCenterIncidentSessionType(selectedActionIncident, selectedSession)
    : 'Unverified'

  const refreshAll = useCallback(async () => {
    if (!apiEnabled || refreshing) return
    const hadPendingResult = needsRefresh
    setRefreshing(true)
    setFeedback(null)
    const [listOk, sessionsOk] = await Promise.all([loadIncidents(), loadSessions()])
    if (hasManagerPermission) void loadResources()
    if (listOk && sessionsOk) {
      setNeedsRefresh(false)
      if (hadPendingResult) setAction(null)
    }
    else setFeedback({ type: 'error', message: vi ? 'Không tải đủ dữ liệu mới. Các thao tác ghi tiếp tục bị khóa.' : 'Fresh data could not be fully loaded. Write actions remain locked.' })
    setRefreshing(false)
  }, [apiEnabled, hasManagerPermission, loadIncidents, loadResources, loadSessions, needsRefresh, refreshing, vi])

  const closeAction = () => {
    if (busy) return
    setAction(null)
    setFeedback(null)
  }

  const startAction = (kind, incident = null) => {
    if (!hasManagerPermission || busy || needsRefresh) return
    setFeedback(null)
    setAction({ kind, incident })
    if (kind === 'resolve') setResolveForm({ endedAt: '' })
    if (kind === 'compensate') setCompensateForm({ reason: '', verifiedNotHeld: false })
    if (kind === 'makeup') setMakeupForm({ date: '', startTime: '', endTime: '', roomId: '', coachId: '', reason: '' })
  }

  const markUncertain = (error, message) => {
    const normalized = getCenterIncidentError(error)
    const uncertain = error?.name !== 'CenterIncidentValidationError'
      && (normalized.status === 0 || normalized.status >= 500)
    const needsRead = uncertain || normalized.status === 409 || normalized.code === 'IDEMPOTENCY_CONFLICT'
    if (needsRead) setNeedsRefresh(true)
    setFeedback({
      type: needsRead ? 'warning' : 'error',
      message: needsRead
        ? `${message} ${vi ? 'Kết quả chưa chắc chắn; hãy tải lại dữ liệu trước thao tác ghi tiếp theo.' : 'The result may be uncertain; reload data before another write.'}`
        : message,
      status: normalized.status,
      code: normalized.code,
      details: normalized.details,
    })
    return needsRead
  }

  const runMutation = async ({ execute, successMessage, reloadSessionsAfter = false, onUncertain }) => {
    if (mutationLock.current || busy || !hasManagerPermission || needsRefresh) return false
    mutationLock.current = true
    setBusy(true)
    setFeedback(null)
    try {
      await execute()
      setAction(null)
      showToast?.(successMessage, 'success')
      const listOk = await loadIncidents()
      const sessionsOk = reloadSessionsAfter ? await loadSessions() : true
      if (!listOk || !sessionsOk) {
        setNeedsRefresh(true)
        setFeedback({ type: 'warning', message: vi ? 'Thao tác thành công. Vui lòng tải lại trang để cập nhật dữ liệu mới nhất.' : 'Action completed. Please refresh to load latest data.' })
      }
      return true
    } catch (error) {
      const message = getErrorMessage(error, vi ? 'Không thể hoàn tất thao tác.' : 'Could not complete the action.')
      const needsRead = markUncertain(error, message)
      onUncertain?.(needsRead)
      return false
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }

  const submitOpen = async (event) => {
    event.preventDefault()
    if (!canOpenIncident || busy || needsRefresh || !openForm.sessionId) return
    const payload = {
      sessionId: Number(openForm.sessionId),
      startedAt: openForm.startedAt,
      reason: openForm.reason.trim(),
      evidence: openForm.evidence.trim(),
    }
    const currentFingerprint = fingerprint(payload)
    if (!openRequestRef.current || openRequestRef.current.fingerprint !== currentFingerprint) {
      try {
        openRequestRef.current = { fingerprint: currentFingerprint, payload, key: createCenterIncidentRequestKey(), uncertain: false }
      } catch (error) {
        setFeedback({ type: 'error', message: getErrorMessage(error, vi ? 'Không tạo được mã yêu cầu an toàn.' : 'Could not create a secure request key.') })
        return
      }
    }
    const operation = openRequestRef.current
    const ok = await runMutation({
      execute: () => openCenterIncident({ ...payload, requestKey: operation.key }, { actor: currentUser }),
      successMessage: vi ? 'Đã ghi nhận sự cố trung tâm.' : 'Center incident recorded.',
      onUncertain: (uncertain) => { if (uncertain) operation.uncertain = true },
    })
    if (ok) {
      openRequestRef.current = null
      setOpenForm({ sessionId: '', startedAt: '', reason: '', evidence: '' })
    }
  }

  const submitResolve = (event) => {
    event.preventDefault()
    if (!action?.incident) return
    void runMutation({
      execute: () => resolveCenterIncident(action.incident.id, { endedAt: resolveForm.endedAt }, { actor: currentUser }),
      successMessage: vi ? 'Đã xác nhận khắc phục sự cố.' : 'Recovery confirmed.',
    })
  }

  const submitCompensate = (event) => {
    event.preventDefault()
    if (!action?.incident || !compensateForm.verifiedNotHeld) return
    void runMutation({
      execute: () => compensateCenterIncident(action.incident.id, {
        reason: compensateForm.reason.trim(), verifiedNotHeld: compensateForm.verifiedNotHeld,
      }, { actor: currentUser }),
      successMessage: vi ? 'Đã xác nhận buổi học không được tổ chức.' : 'Session confirmed as not held.',
    })
  }

  const submitMakeup = (event) => {
    event.preventDefault()
    if (!action?.incident || selectedType !== 'Normal' || action.incident.sessionCompensated !== true) return
    void runMutation({
      execute: () => createNormalMakeup(action.incident.id, {
        date: makeupForm.date,
        startTime: makeupForm.startTime,
        endTime: makeupForm.endTime,
        roomId: Number(makeupForm.roomId),
        coachId: Number(makeupForm.coachId),
        reason: makeupForm.reason.trim(),
      }, { actor: currentUser }),
      successMessage: vi ? 'Đã tạo buổi học bù Normal thành công.' : 'Normal makeup session created.',
      reloadSessionsAfter: true,
    })
  }

  const getIncidentType = (incident) => sessionsLoading || sessionsError
    ? 'Unverified'
    : getCenterIncidentSessionType(incident, sessionById.get(String(incident.sessionId)))
  const currentMakeup = (incident) => sessions.find((session) => String(session.makeupForSessionId) === String(incident.sessionId))
  const errorBlock = (message) => message && <p role="alert" className="mt-2 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</p>

  return (
    <section className="space-y-4" aria-labelledby="center-incidents-heading">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div>
          <h2 id="center-incidents-heading" className="text-base font-bold text-slate-900">{vi ? 'Sự cố cấp trung tâm' : 'Center incidents'}</h2>
          <p className="mt-1 text-xs text-slate-500">{vi ? 'Theo dõi sự cố ảnh hưởng đến buổi học, xác nhận giải quyết và xếp lịch bù.' : 'Track center incidents, confirm recovery, and schedule makeup sessions.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasManagerPermission && (
            <button
              type="button"
              onClick={() => { setOpenForm({ sessionId: '', startedAt: '', reason: '', evidence: '' }); setAction({ kind: 'open', incident: null }); setFeedback(null) }}
              disabled={!canOpenIncident || refreshing || busy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-primary px-3 text-xs font-semibold text-white shadow-2xs hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {vi ? 'Báo cáo sự cố mới' : 'Report new incident'}
            </button>
          )}
          <button
            type="button"
            onClick={refreshAll}
            disabled={!apiEnabled || refreshing || incidentsLoading}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing || incidentsLoading ? 'animate-spin' : ''}`} />
            {vi ? 'Tải lại' : 'Refresh'}
          </button>
        </div>
      </header>

      {!apiEnabled && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <p>{vi ? 'Quản lý sự cố trung tâm cần kết nối API Backend.' : 'Center incident management requires the Backend API.'}</p>
        </div>
      )}
      {apiEnabled && !hasManagerPermission && (
        <div role="status" className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <p>{vi ? 'Chế độ xem: Bạn có quyền xem thông tin các sự cố của trung tâm.' : 'View mode: You have read-only access to center incidents.'}</p>
        </div>
      )}
      {needsRefresh && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
          <span>{vi ? 'Kết quả thao tác trước chưa được xác minh. Hãy tải lại danh sách trước khi thực hiện tiếp.' : 'The previous action result has not been verified. Please reload before continuing.'}</span>
          <button type="button" onClick={refreshAll} disabled={refreshing} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-amber-400 bg-white px-2.5 text-xs font-bold shadow-2xs disabled:opacity-50">
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {vi ? 'Kiểm tra lại' : 'Check again'}
          </button>
        </div>
      )}
      {feedback && (
        <div role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-xs ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : feedback.type === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          <p className="font-medium">{feedback.message}</p>
          {(feedback.status || feedback.code) && <p className="mt-1 text-[11px] text-slate-500">{feedback.status ? `HTTP ${feedback.status}` : ''}{feedback.code ? ` · ${feedback.code}` : ''}</p>}
          {feedback.details && <details className="mt-2 text-[11px]"><summary>{vi ? 'Chi tiết' : 'Details'}</summary><pre className="mt-1 whitespace-pre-wrap">{typeof feedback.details === 'string' ? feedback.details : JSON.stringify(feedback.details, null, 2)}</pre></details>}
        </div>
      )}

      {sessionsError && errorBlock(sessionsError)}
      {resourcesError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{resourcesError}</p>}
      {incidentsLoading && <div role="status" className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-500 shadow-xs"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-brand-primary" />{vi ? 'Đang tải sự cố trung tâm…' : 'Loading center incidents…'}</div>}
      {!incidentsLoading && incidentsError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{incidentsError}</span>
          <button type="button" onClick={loadIncidents} className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold shadow-2xs">{vi ? 'Thử lại' : 'Retry'}</button>
        </div>
      )}
      {!incidentsLoading && !incidentsError && incidentsLoaded && incidents.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-500 shadow-xs">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/80" />
          <p className="font-semibold text-slate-700">{vi ? 'Không có sự cố nào cần xử lý' : 'No center incidents recorded'}</p>
          <p className="mt-1 text-slate-400">{vi ? 'Tất cả các buổi học của trung tâm hiện đang hoạt động bình thường.' : 'All sessions are running as scheduled.'}</p>
        </div>
      )}

      {!incidentsLoading && !incidentsError && incidents.map((incident) => {
        const type = getIncidentType(incident)
        const affectedCount = memberCount(incident.affectedMemberIds)
        const existingMakeup = type === 'Normal' ? currentMakeup(incident) : null
        const isResolved = incident.status === 'Resolved'
        const isWaiting = incident.status === 'WaitingForRecovery'

        return (
          <article
            key={incident.id ?? `${incident.sessionId}-${incident.startedAt}`}
            className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs transition hover:shadow-sm"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <AlertTriangle className={`h-4 w-4 ${isWaiting ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <span className="text-sm">{vi ? `Sự cố #${present(incident.id)}` : `Incident #${present(incident.id)}`}</span>
                </div>

                {isResolved ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <Check className="h-3 w-3" />
                    {vi ? 'Đã khắc phục' : 'Resolved'}
                  </span>
                ) : isWaiting ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <Clock3 className="h-3 w-3" />
                    {vi ? 'Chờ khắc phục' : 'Waiting for recovery'}
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {present(incident.status)}
                  </span>
                )}

                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {vi ? `Buổi học #${present(incident.sessionId)}` : `Session #${present(incident.sessionId)}`}
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {type === 'Normal' ? 'Gói Normal' : type === 'Advanced' ? 'Gói Advanced' : (vi ? 'Chưa phân loại' : 'Unverified')}
                </span>
              </div>

              {hasManagerPermission && !needsRefresh && (
                <div className="flex flex-wrap items-center gap-2">
                  {isWaiting && (
                    <button
                      type="button"
                      onClick={() => startAction('resolve', incident)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {vi ? 'Xác nhận khắc phục' : 'Confirm recovery'}
                    </button>
                  )}
                  {isWaiting && incident.sessionCompensated === false && (
                    <button
                      type="button"
                      onClick={() => startAction('compensate', incident)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      {vi ? 'Xác nhận buổi không tổ chức' : 'Confirm not held'}
                    </button>
                  )}
                  {knownIncidentStatus(incident.status) && type === 'Normal' && incident.sessionCompensated === true && (
                    <button
                      type="button"
                      onClick={() => startAction('makeup', incident)}
                      disabled={busy || resourcesLoading || Boolean(resourcesError) || Boolean(existingMakeup)}
                      title={existingMakeup ? (vi ? 'Đã có buổi bù.' : 'Makeup session already exists.') : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition disabled:opacity-50 ${
                        existingMakeup
                          ? 'border border-slate-200 bg-slate-100 text-slate-500 cursor-default'
                          : 'bg-brand-primary text-white hover:bg-brand-primary/90'
                      }`}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      {existingMakeup ? (vi ? 'Đã có buổi bù' : 'Makeup exists') : (vi ? 'Tạo buổi bù Normal' : 'Create Normal makeup')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 space-y-3.5">
              {/* Stat Chips Grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{vi ? 'Thời gian diễn ra' : 'Timeline'}</span>
                  <div className="mt-1 text-xs font-semibold text-slate-800">
                    <div>{localDateTime(incident.startedAt)}</div>
                    {incident.endedAt && <div className="text-[11px] text-slate-500 font-normal">đến {localDateTime(incident.endedAt)}</div>}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{vi ? 'Học viên bị ảnh hưởng' : 'Affected Members'}</span>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span>{affectedCount != null ? `${affectedCount} ${vi ? 'học viên' : 'members'}` : '—'}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{vi ? 'Buổi gốc đã bù' : 'Compensated'}</span>
                  <div className="mt-1">
                    {incident.sessionCompensated === true ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <Check className="h-3.5 w-3.5" />
                        {vi ? 'Đã xác nhận bù' : 'Compensated'}
                      </span>
                    ) : incident.sessionCompensated === false ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                        <Clock3 className="h-3.5 w-3.5" />
                        {vi ? 'Chưa xác nhận' : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{vi ? 'Buổi học bù' : 'Makeup Session'}</span>
                  <div className="mt-1">
                    {existingMakeup ? (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                        #{existingMakeup.id} · {existingMakeup.sessionDate || '—'}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{vi ? 'Chưa xếp lịch bù' : 'No makeup'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Deadline & credit chips only when present */}
              {(incident.originalDeadline || incident.deadlineBefore || incident.deadlineAfter || (incident.recoveredCredits != null && incident.recoveredCredits > 0)) && (
                <div className="flex flex-wrap gap-4 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-100">
                  {incident.originalDeadline && <div><span className="text-slate-500">{vi ? 'Hạn gốc: ' : 'Original: '}</span><span className="font-semibold">{localDateTime(incident.originalDeadline)}</span></div>}
                  {incident.deadlineBefore && <div><span className="text-slate-500">{vi ? 'Hạn trước: ' : 'Before: '}</span><span className="font-semibold">{localDateTime(incident.deadlineBefore)}</span></div>}
                  {incident.deadlineAfter && <div><span className="text-slate-500">{vi ? 'Hạn sau: ' : 'After: '}</span><span className="font-semibold text-emerald-700">{localDateTime(incident.deadlineAfter)}</span></div>}
                  {incident.recoveredCredits != null && incident.recoveredCredits > 0 && <div><span className="text-slate-500">{vi ? 'Credit phục hồi: ' : 'Credits: '}</span><span className="font-bold text-brand-primary">+{incident.recoveredCredits}</span></div>}
                </div>
              )}

              {/* Reason & Evidence Cards */}
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <FileText className="h-3.5 w-3.5 text-slate-500" />
                    <span>{vi ? 'Lý do sự cố' : 'Reason'}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{present(incident.reason)}</p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
                    <span>{vi ? 'Bằng chứng xác minh' : 'Evidence'}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{present(incident.evidence)}</p>
                </div>
              </div>
            </div>
          </article>
        )
      })}

      {action && <div role="dialog" aria-modal="true" aria-labelledby="center-incident-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
        <section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
          <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3"><div><h2 id="center-incident-dialog-title" className="font-bold">{action.kind === 'open' ? (vi ? 'Mở sự cố trung tâm' : 'Open center incident') : action.kind === 'resolve' ? (vi ? 'Xác nhận khắc phục' : 'Confirm recovery') : action.kind === 'compensate' ? (vi ? 'Xác nhận buổi không tổ chức' : 'Confirm session not held') : (vi ? 'Tạo buổi học bù Normal' : 'Create Normal makeup')}</h2>{action.incident && <p className="mt-1 text-xs text-slate-500">#{action.incident.id} · Session #{action.incident.sessionId}</p>}</div><button type="button" aria-label="Close" onClick={closeAction} disabled={busy} className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></header>
          {action.kind === 'open' && <form onSubmit={submitOpen} className="space-y-3">
            {sessionsError && errorBlock(sessionsError)}
            <label className="block text-xs font-semibold">{vi ? 'Buổi học' : 'Session'}
  <select required value={openForm.sessionId} onChange={(event) => { setOpenForm((old) => ({ ...old, sessionId: event.target.value })); setFeedback(null) }} disabled={sessionsLoading || !sessions.length || needsRefresh} className={fieldClass}>
    <option value="">{sessionsLoading ? (vi ? 'Đang tải buổi học…' : 'Loading sessions…') : (vi ? 'Chọn buổi học' : 'Select a session')}</option>
    {sessionsBySubject.map(({ subject, sessions: subjectSessions }) => {
      const validSessions = subjectSessions.filter((session) => Number.isInteger(session.id) && session.id > 0)
      return (
        <optgroup key={subject.id} label={subject.name}>
          {validSessions.length > 0
            ? validSessions.map((session) => (
              <option key={session.id} value={session.id}>
                #{session.id} · {session.className || (vi ? 'Lớp chưa có tên' : 'Unnamed class')} · {session.sessionDate || '—'} {String(session.startTime || '').slice(0, 5)}{session.isPrivate === false ? ' · Normal' : session.isPrivate === true ? ' · Advanced' : ''}
              </option>
            ))
            : <option disabled>{vi ? 'Chưa có buổi học' : 'No sessions'}</option>}
        </optgroup>
      )
    })}
  </select>
</label>
            <label className="block text-xs font-semibold">{vi ? 'Thời điểm bắt đầu (giờ Việt Nam)' : 'Started at (Vietnam local time)'}<input type="datetime-local" required value={openForm.startedAt} onChange={(event) => setOpenForm((old) => ({ ...old, startedAt: event.target.value }))} className={fieldClass} /></label>
            <label className="block text-xs font-semibold">{vi ? 'Lý do' : 'Reason'}<textarea required maxLength={2000} value={openForm.reason} onChange={(event) => setOpenForm((old) => ({ ...old, reason: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3 text-sm" /></label>
            <label className="block text-xs font-semibold">{vi ? 'Bằng chứng' : 'Evidence'}<textarea required maxLength={2000} value={openForm.evidence} onChange={(event) => setOpenForm((old) => ({ ...old, evidence: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3 text-sm" /></label>
            <p className="text-xs text-slate-500">{vi ? 'Nhập bằng chứng thực tế. Mã yêu cầu được tạo tự động và không hiển thị.' : 'Enter real evidence. The request key is generated automatically and is not displayed.'}</p>
            {needsRefresh && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{vi ? 'Hãy tải lại dữ liệu để kiểm tra kết quả trước khi gửi lại.' : 'Reload data and check the result before another submission.'}</p>}
            {feedback?.type === 'error' && errorBlock(feedback.message)}
            <footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={closeAction} disabled={busy} className="min-h-10 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Đóng' : 'Close'}</button><button type="submit" disabled={!canOpenIncident || busy || needsRefresh || !openForm.sessionId || !openForm.startedAt || !openForm.reason.trim() || !openForm.evidence.trim()} className="inline-flex min-h-10 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Gửi mở sự cố' : 'Open incident'}</button></footer>
          </form>}

          {action.kind === 'resolve' && <form onSubmit={submitResolve} className="space-y-3"><p className="text-sm text-slate-600">{vi ? 'Hệ thống sẽ cập nhật trạng thái sau khi xác nhận thời điểm khắc phục.' : 'The system will update status once recovery time is confirmed.'}</p><label className="block text-xs font-semibold">{vi ? 'Thời điểm khắc phục (giờ Việt Nam)' : 'Recovered at (Vietnam local time)'}<input type="datetime-local" required min={String(action.incident.startedAt || '').slice(0, 16)} max={`${hcmToday()}T23:59`} value={resolveForm.endedAt} onChange={(event) => setResolveForm({ endedAt: event.target.value })} className={fieldClass} /></label>{feedback?.type === 'error' && errorBlock(feedback.message)}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={closeAction} disabled={busy} className="min-h-10 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Đóng' : 'Close'}</button><button type="submit" disabled={busy || needsRefresh || !resolveForm.endedAt} className="inline-flex min-h-10 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Xác nhận khắc phục' : 'Confirm recovery'}</button></footer></form>}

          {action.kind === 'compensate' && <form onSubmit={submitCompensate} className="space-y-3"><p className="text-sm text-slate-600">{vi ? 'Chỉ xác nhận nếu Manager đã kiểm tra và chắc chắn buổi học thực tế hoàn toàn không được tổ chức.' : 'Confirm only after personally verifying that the session was not held at all.'}</p><label className="block text-xs font-semibold">{vi ? 'Lý do xác nhận' : 'Reason'}<textarea required value={compensateForm.reason} onChange={(event) => setCompensateForm((old) => ({ ...old, reason: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3 text-sm" /></label><label className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" checked={compensateForm.verifiedNotHeld} onChange={(event) => setCompensateForm((old) => ({ ...old, verifiedNotHeld: event.target.checked }))} className="mt-1 h-4 w-4" /><span>{vi ? 'Tôi đã xác minh buổi học thực tế hoàn toàn không được tổ chức.' : 'I verified that this session was not held at all.'}</span></label>{feedback?.type === 'error' && errorBlock(feedback.message)}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={closeAction} disabled={busy} className="min-h-10 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Đóng' : 'Close'}</button><button type="submit" disabled={busy || needsRefresh || !compensateForm.reason.trim() || !compensateForm.verifiedNotHeld} className="inline-flex min-h-10 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Gửi xác nhận' : 'Confirm not held'}</button></footer></form>}

          {action.kind === 'makeup' && <form onSubmit={submitMakeup} className="space-y-3"><p className="text-sm text-slate-600">{vi ? 'Hệ thống sẽ kiểm tra ngày nghỉ, phòng tập và lịch của huấn luyện viên khi tạo buổi bù.' : 'The system validates holidays, room conflicts, and coach availability for the makeup session.'}</p><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold">{vi ? 'Ngày' : 'Date'}<input type="date" required min={hcmToday()} value={makeupForm.date} onChange={(event) => setMakeupForm((old) => ({ ...old, date: event.target.value }))} className={fieldClass} /></label><label className="block text-xs font-semibold">{vi ? 'Phòng' : 'Room'}<select required value={makeupForm.roomId} onChange={(event) => setMakeupForm((old) => ({ ...old, roomId: event.target.value }))} disabled={resourcesLoading || Boolean(resourcesError)} className={fieldClass}><option value="">{vi ? 'Chọn phòng' : 'Select room'}</option>{rooms.filter((room) => Number.isInteger(Number(room.id)) && Number(room.id) > 0).map((room) => <option key={room.id} value={room.id}>{room.roomCode ? `${room.roomCode} · ` : ''}{room.name || `#${room.id}`}{room.status ? ` · ${room.status}` : ''}</option>)}</select></label><label className="block text-xs font-semibold">{vi ? 'Giờ bắt đầu' : 'Start time'}<input type="time" required value={makeupForm.startTime} onChange={(event) => setMakeupForm((old) => ({ ...old, startTime: event.target.value }))} className={fieldClass} /></label><label className="block text-xs font-semibold">{vi ? 'Giờ kết thúc' : 'End time'}<input type="time" required value={makeupForm.endTime} onChange={(event) => setMakeupForm((old) => ({ ...old, endTime: event.target.value }))} className={fieldClass} /></label><label className="block text-xs font-semibold sm:col-span-2">Coach<select required value={makeupForm.coachId} onChange={(event) => setMakeupForm((old) => ({ ...old, coachId: event.target.value }))} disabled={resourcesLoading || Boolean(resourcesError)} className={fieldClass}><option value="">{vi ? 'Chọn Coach' : 'Select coach'}</option>{coaches.filter((coach) => Number.isInteger(Number(coach.id)) && Number(coach.id) > 0).map((coach) => <option key={coach.id} value={coach.id}>{coach.name || `#${coach.id}`}</option>)}</select></label></div><label className="block text-xs font-semibold">{vi ? 'Lý do học bù' : 'Makeup reason'}<textarea required value={makeupForm.reason} onChange={(event) => setMakeupForm((old) => ({ ...old, reason: event.target.value }))} className="mt-1 min-h-20 w-full rounded border border-slate-300 p-3 text-sm" /></label>{resourcesError && errorBlock(resourcesError)}{feedback?.type === 'error' && errorBlock(feedback.message)}<footer className="flex justify-end gap-2 border-t border-slate-200 pt-3"><button type="button" onClick={closeAction} disabled={busy} className="min-h-10 rounded border border-slate-300 px-4 text-xs font-bold">{vi ? 'Đóng' : 'Close'}</button><button type="submit" disabled={busy || needsRefresh || resourcesLoading || Boolean(resourcesError) || selectedType !== 'Normal' || action.incident.sessionCompensated !== true || !makeupForm.date || !makeupForm.startTime || !makeupForm.endTime || !makeupForm.roomId || !makeupForm.coachId || !makeupForm.reason.trim()} className="inline-flex min-h-10 items-center gap-2 rounded bg-brand-primary px-4 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{vi ? 'Tạo buổi bù' : 'Create makeup'}</button></footer></form>}
        </section>
      </div>}
    </section>
  )
}

export default CenterIncidentsPanel

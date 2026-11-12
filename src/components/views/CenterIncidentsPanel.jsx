import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Loader2, Plus, RefreshCw, RotateCw, ShieldAlert, X } from 'lucide-react'
import { getErrorMessage } from '../../api/apiErrors.js'
import { getCoaches, getRooms, getSessions } from '../../api/managerApi.js'
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

function CenterIncidentsPanel({ apiEnabled, currentUser, language, showToast }) {
  const vi = language === 'vi'
  const actorActive = String(currentUser?.status || '').trim().toLowerCase() === 'active'
  const validCenter = Number.isInteger(currentUser?.centerId) && currentUser.centerId > 0
  const hasManagerPermission = apiEnabled && actorActive && validCenter && canManageCenterIncident(currentUser)
  const [incidents, setIncidents] = useState([])
  const [incidentsLoading, setIncidentsLoading] = useState(apiEnabled)
  const [incidentsLoaded, setIncidentsLoaded] = useState(false)
  const [incidentsError, setIncidentsError] = useState('')
  const [sessions, setSessions] = useState([])
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
      setSessions(await getSessions({}, { notifyForbidden: false }))
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

  const sessionById = useMemo(() => new Map(sessions.map((session) => [String(session.id), session])), [sessions])
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
      <header className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 id="center-incidents-heading" className="text-base font-bold">{vi ? 'Sự cố trung tâm' : 'Center incidents'}</h2>
          <p className="mt-1 text-xs text-slate-500">{vi ? 'Theo dõi sự cố ảnh hưởng đến buổi học và phương án xử lý.' : 'Track center incidents and recovery actions.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasManagerPermission && <button type="button" onClick={() => { setOpenForm({ sessionId: '', startedAt: '', reason: '', evidence: '' }); setAction({ kind: 'open', incident: null }); setFeedback(null) }} disabled={!canOpenIncident || refreshing || busy} className="inline-flex min-h-10 items-center gap-2 rounded bg-brand-primary px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{vi ? 'Mở sự cố' : 'Open incident'}</button>}
          <button type="button" onClick={refreshAll} disabled={!apiEnabled || refreshing || incidentsLoading} className="inline-flex min-h-10 items-center gap-2 rounded border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing || incidentsLoading ? 'animate-spin' : ''}`} />{vi ? 'Tải lại' : 'Refresh'}</button>
        </div>
      </header>

      {!apiEnabled && <div role="status" className={`${cardClass} flex gap-3 text-sm text-amber-900`}><ShieldAlert className="h-5 w-5 shrink-0" /><p>{vi ? 'Quản lý sự cố trung tâm cần API Backend; không hiển thị dữ liệu demo trong chế độ này.' : 'Center incident management requires the Backend API; demo data is not shown in this mode.'}</p></div>}
      {apiEnabled && !hasManagerPermission && <div role="status" className={`${cardClass} flex gap-3 text-sm text-amber-900`}><ShieldAlert className="h-5 w-5 shrink-0" /><p>{vi ? 'Bạn có thể xem sự cố. Thao tác ghi yêu cầu Center Manager, MANAGE_CLASSES, tài khoản Active và centerId hợp lệ.' : 'You can view incidents. Write actions require a Center Manager with MANAGE_CLASSES, an Active account, and a valid centerId.'}</p></div>}
      {needsRefresh && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><span>{vi ? 'Kết quả thao tác trước chưa được xác minh. Tải lại danh sách trước khi thực hiện thao tác ghi khác.' : 'The previous action result has not been verified. Reload before another write.'}</span><button type="button" onClick={refreshAll} disabled={refreshing} className="inline-flex min-h-9 items-center gap-2 rounded border border-amber-400 px-3 text-xs font-bold disabled:opacity-50"><RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{vi ? 'Kiểm tra lại' : 'Check again'}</button></div>}
      {feedback && <div role={feedback.type === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : feedback.type === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
        <p>{feedback.message}</p>
        {(feedback.status || feedback.code) && <p className="mt-1 text-xs">{feedback.status ? `HTTP ${feedback.status}` : ''}{feedback.code ? ` · ${feedback.code}` : ''}</p>}
        {feedback.details && <details className="mt-2 text-xs"><summary>{vi ? 'Chi tiết lỗi' : 'Error details'}</summary><pre className="mt-1 whitespace-pre-wrap">{typeof feedback.details === 'string' ? feedback.details : JSON.stringify(feedback.details, null, 2)}</pre></details>}
      </div>}

      {sessionsError && errorBlock(sessionsError)}
      {resourcesError && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{resourcesError}</p>}
      {incidentsLoading && <div role="status" className={`${cardClass} py-8 text-center text-sm text-slate-500`}><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{vi ? 'Đang tải sự cố trung tâm…' : 'Loading center incidents…'}</div>}
      {!incidentsLoading && incidentsError && <div role="alert" className={`${cardClass} flex flex-wrap items-center justify-between gap-3 text-sm text-rose-800`}><span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{incidentsError}</span><button type="button" onClick={loadIncidents} className="min-h-9 rounded border border-rose-300 px-3 text-xs font-bold">{vi ? 'Thử lại' : 'Retry'}</button></div>}
      {!incidentsLoading && !incidentsError && incidentsLoaded && incidents.length === 0 && <div className={`${cardClass} py-8 text-center text-sm text-slate-500`}>{vi ? 'Chưa có sự cố trung tâm.' : 'No center incidents have been recorded.'}</div>}

      {!incidentsLoading && !incidentsError && incidents.map((incident) => {
        const type = getIncidentType(incident)
        const affectedCount = memberCount(incident.affectedMemberIds)
        const existingMakeup = type === 'Normal' ? currentMakeup(incident) : null
        return <article key={incident.id ?? `${incident.sessionId}-${incident.startedAt}`} className={`${cardClass} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{vi ? `Sự cố #${present(incident.id)}` : `Incident #${present(incident.id)}`}</h3><span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold">{present(incident.status)}</span><span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{vi ? `Buổi #${present(incident.sessionId)}` : `Session #${present(incident.sessionId)}`}</span><span className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{type === 'Normal' ? 'Normal' : type === 'Advanced' ? 'Advanced' : (vi ? 'Chưa xác minh loại lớp' : 'Class type unverified')}</span></div>
              <p className="mt-1 text-xs text-slate-500">{vi ? 'Bắt đầu' : 'Started'}: {localDateTime(incident.startedAt)} · {vi ? 'Kết thúc' : 'Ended'}: {localDateTime(incident.endedAt)}</p>
            </div>
            {hasManagerPermission && !needsRefresh && <div className="flex flex-wrap gap-2">
              {incident.status === 'WaitingForRecovery' && <button type="button" onClick={() => startAction('resolve', incident)} disabled={busy} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-bold disabled:opacity-50">{vi ? 'Xác nhận khắc phục' : 'Confirm recovery'}</button>}
              {incident.status === 'WaitingForRecovery' && incident.sessionCompensated === false && <button type="button" onClick={() => startAction('compensate', incident)} disabled={busy} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-bold disabled:opacity-50">{vi ? 'Xác nhận buổi không tổ chức' : 'Confirm not held'}</button>}
              {knownIncidentStatus(incident.status) && type === 'Normal' && incident.sessionCompensated === true && <button type="button" onClick={() => startAction('makeup', incident)} disabled={busy || resourcesLoading || Boolean(resourcesError) || Boolean(existingMakeup)} title={existingMakeup ? (vi ? 'Đã có buổi bù.' : 'Makeup session already exists.') : undefined} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-bold disabled:opacity-50">{existingMakeup ? (vi ? 'Đã có buổi bù' : 'Makeup exists') : (vi ? 'Tạo buổi bù Normal' : 'Create Normal makeup')}</button>}
            </div>}
          </div>
          <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-slate-500">{vi ? 'Hạn gốc' : 'Original deadline'}</dt><dd className="mt-1 font-medium">{localDateTime(incident.originalDeadline)}</dd></div>
            <div><dt className="text-xs text-slate-500">{vi ? 'Hạn trước' : 'Deadline before'}</dt><dd className="mt-1 font-medium">{localDateTime(incident.deadlineBefore)}</dd></div>
            <div><dt className="text-xs text-slate-500">{vi ? 'Hạn sau' : 'Deadline after'}</dt><dd className="mt-1 font-medium">{localDateTime(incident.deadlineAfter)}</dd></div>
            <div><dt className="text-xs text-slate-500">{vi ? 'Credit phục hồi' : 'Recovered credits'}</dt><dd className="mt-1 font-medium">{incident.recoveredCredits === null || incident.recoveredCredits === undefined ? 'Chưa có thông tin' : incident.recoveredCredits}</dd></div>
            <div><dt className="text-xs text-slate-500">{vi ? 'Buổi gốc đã bù' : 'Original session compensated'}</dt><dd className="mt-1 font-medium">{incident.sessionCompensated === true ? (vi ? 'Có' : 'Yes') : incident.sessionCompensated === false ? (vi ? 'Chưa' : 'No') : 'Chưa có thông tin'}</dd></div>
            <div><dt className="text-xs text-slate-500">{vi ? 'Member bị ảnh hưởng' : 'Affected members'}</dt><dd className="mt-1 font-medium">{affectedCount === null ? 'Chưa có thông tin' : affectedCount}</dd></div>
            {existingMakeup && <div><dt className="text-xs text-slate-500">{vi ? 'Buổi bù' : 'Makeup session'}</dt><dd className="mt-1 font-medium">#{existingMakeup.id} · {existingMakeup.sessionDate || '—'}</dd></div>}
          </dl>
          <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2"><div><p className="text-xs font-semibold text-slate-500">{vi ? 'Lý do' : 'Reason'}</p><p className="mt-1 whitespace-pre-wrap text-sm">{present(incident.reason)}</p></div><div><p className="text-xs font-semibold text-slate-500">{vi ? 'Bằng chứng' : 'Evidence'}</p><p className="mt-1 whitespace-pre-wrap text-sm">{present(incident.evidence)}</p></div></div>
          {type === 'Unverified' && incident.sessionCompensated === true && <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{vi ? 'Chưa xác định được loại buổi học để tạo lịch bù.' : 'Session type could not be established to create makeup.'}</p>}
        </article>
      })}

      {action && <div role="dialog" aria-modal="true" aria-labelledby="center-incident-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
        <section className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
          <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3"><div><h2 id="center-incident-dialog-title" className="font-bold">{action.kind === 'open' ? (vi ? 'Mở sự cố trung tâm' : 'Open center incident') : action.kind === 'resolve' ? (vi ? 'Xác nhận khắc phục' : 'Confirm recovery') : action.kind === 'compensate' ? (vi ? 'Xác nhận buổi không tổ chức' : 'Confirm session not held') : (vi ? 'Tạo buổi học bù Normal' : 'Create Normal makeup')}</h2>{action.incident && <p className="mt-1 text-xs text-slate-500">#{action.incident.id} · Session #{action.incident.sessionId}</p>}</div><button type="button" aria-label="Close" onClick={closeAction} disabled={busy} className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></header>
          {action.kind === 'open' && <form onSubmit={submitOpen} className="space-y-3">
            {sessionsError && errorBlock(sessionsError)}
            <label className="block text-xs font-semibold">{vi ? 'Buổi học' : 'Session'}<select required value={openForm.sessionId} onChange={(event) => { setOpenForm((old) => ({ ...old, sessionId: event.target.value })); setFeedback(null) }} disabled={sessionsLoading || !sessions.length || needsRefresh} className={fieldClass}><option value="">{sessionsLoading ? (vi ? 'Đang tải buổi học…' : 'Loading sessions…') : (vi ? 'Chọn buổi học' : 'Select a session')}</option>{sessions.filter((session) => Number.isInteger(session.id) && session.id > 0).map((session) => <option key={session.id} value={session.id}>#{session.id} · {session.className || (vi ? 'Lớp chưa có tên' : 'Unnamed class')} · {session.sessionDate || '—'} {String(session.startTime || '').slice(0, 5)}{session.isPrivate === false ? ' · Normal' : session.isPrivate === true ? ' · Advanced' : ''}</option>)}</select></label>
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

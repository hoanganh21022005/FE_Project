import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, CalendarClock, RefreshCw } from 'lucide-react'
import { getErrorMessage } from '../../api/apiErrors.js'
import * as managerApi from '../../api/managerApi.js'
import { getSessions } from '../../api/managerApi.js'
import {
  canManageNormalClassLifecycle,
  applyNormalClassProposal,
  cancelNormalClassBeforeOpening,
  createNormalClassProposal,
  evaluateNormalClassLifecycle,
  evaluateNormalProposalApply,
  evaluateNormalTransferTargetCutoff,
  getNormalClassProposals,
  getNormalLifecycleError,
  inspectNormalClassProposal,
  isNormalLifecycleStaleError,
} from '../../api/normalClassLifecycleApi.js'
import {
  filterNormalTransferTargetsForUi,
  getNormalTransferRemainingSeats,
  summarizeNormalProposalChoices,
} from '../../utils/normalClassMergeUi.js'
import { useSCMS } from '../../context/SCMSContext.jsx'
import { formatDate } from '../../locales/translations'
import { NORMAL_CLASS_TIME_SLOTS } from '../modals/new-class/classFormConstants.js'

const text = (value, fallback = 'Chưa xác minh') =>
  typeof value === 'string' && value.trim() ? value : fallback
const copy = (isVi, vi, en) => isVi ? vi : en

const localDateTime = (value) => {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

const sessionDate = (session) => {
  const date = session?.sessionDate ?? session?.date
  if (!date) return 'Chưa xác minh'
  const start = session?.startTime ? String(session.startTime).slice(0, 5) : ''
  const end = session?.endTime ? String(session.endTime).slice(0, 5) : ''
  return `${formatDate(date)}${start ? ` · ${start}` : ''}${end ? `–${end}` : ''}`
}

const formatSessionSlotLabel = (session, isVi) => {
  const slotNum = Number(session?.slotNumber)
  if (Number.isInteger(slotNum) && slotNum > 0) {
    return isVi ? `Ca ${slotNum}` : `Slot ${slotNum}`
  }
  const start = session?.startTime ? String(session.startTime).slice(0, 5) : ''
  const end = session?.endTime ? String(session.endTime).slice(0, 5) : ''
  const matched = NORMAL_CLASS_TIME_SLOTS.find(
    (slot) => slot.startTime === start && (!end || slot.endTime === end),
  )
  if (matched) {
    return isVi ? matched.name : `Slot ${matched.slotNumber}`
  }
  return start ? `${start}${end ? `–${end}` : ''}` : ''
}

const hasCompleteSchedule = (sessions, expectedCount = 12) => {
  if (!Array.isArray(sessions) || !Number.isInteger(expectedCount) || expectedCount <= 0) return false
  const active = sessions.filter((session) => session && session.centerInvalidated !== true &&
    String(session.status ?? '').trim().toLowerCase() !== 'cancelled')
  const ids = new Set(active.map((session) => session.id).filter((id) => id != null).map(String))
  return active.length === expectedCount && ids.size === expectedCount && active.every((session) =>
    session.sessionDate && session.startTime && session.endTime &&
    String(session.status ?? '').trim().toLowerCase() === 'scheduled' &&
    (session.coachId != null || session.coachName) && (session.roomId != null || session.roomName),
  )
}

function proposalStatusMeta(status, isVi) {
  const s = String(status ?? '').trim().toLowerCase()
  if (s === 'pending' || s === 'waiting') {
    return { label: copy(isVi, 'Đang chờ phản hồi', 'Pending'), badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (s === 'ready' || s === 'approved' || s === 'readytoapply') {
    return { label: copy(isVi, 'Sẵn sàng áp dụng', 'Ready to apply'), badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  }
  if (s === 'applied' || s === 'completed') {
    return { label: copy(isVi, 'Đã áp dụng', 'Applied'), badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  }
  if (s === 'rejected' || s === 'cancelled' || s === 'canceled' || s === 'expired') {
    return { label: copy(isVi, 'Đã đóng / Hủy', 'Closed'), badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' }
  }
  return { label: text(status), badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' }
}

function memberChoiceMeta(choice, isVi) {
  const c = String(choice ?? '').trim().toLowerCase()
  if (c === 'waiting' || c === 'pending') {
    return { label: copy(isVi, 'Đang chờ', 'Waiting'), badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (c === 'accept' || c === 'accepted' || c === 'transfer' || c === 'agree') {
    return { label: copy(isVi, 'Đồng ý', 'Accepted'), badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  }
  if (c === 'refund' || c === 'requestrefund') {
    return { label: copy(isVi, 'Yêu cầu hoàn tiền', 'Refund requested'), badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' }
  }
  return { label: text(choice), badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' }
}

function ProposalChoices({ proposal, isVi }) {
  const inspected = inspectNormalClassProposal(proposal)
  if (!Array.isArray(inspected.choices)) {
    return <p className="mt-2 text-xs text-amber-800">{copy(isVi, 'Phản hồi hội viên: Chưa có danh sách lựa chọn.', 'Member responses: Choice details are unavailable.')}</p>
  }
  if (!inspected.memberChoicesVerified) {
    return <p className="mt-2 text-xs text-amber-800">{copy(isVi, 'Phản hồi hội viên: Có thông tin cần xác nhận thêm.', 'Member responses: Some details need verification.')}</p>
  }
  if (inspected.choices.length === 0) {
    return <p className="mt-2 text-xs text-amber-800">{copy(isVi, 'Phản hồi hội viên: Chưa có phản hồi đồng ý.', 'Member responses: No choices have been recorded.')}</p>
  }

  const summary = summarizeNormalProposalChoices(proposal)

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-stone-800">{copy(isVi, 'Phản hồi hội viên', 'Member responses')}</span>
        {summary.verified ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">
              {copy(isVi, `${summary.total} hội viên`, `${summary.total} total`)}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-200">
              {copy(isVi, `${summary.waiting} đang chờ`, `${summary.waiting} waiting`)}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200">
              {copy(isVi, `${summary.accepted} đồng ý`, `${summary.accepted} accepted`)}
            </span>
            {summary.refunds > 0 && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 border border-rose-200">
                {copy(isVi, `${summary.refunds} hoàn tiền`, `${summary.refunds} refunds`)}
              </span>
            )}
          </div>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
            {copy(isVi, 'Số liệu phản hồi chưa xác minh', 'Response totals are unverified')}
          </span>
        )}
      </div>
      <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200/80 bg-stone-50/50">
        {inspected.choices.map((choice, index) => {
          const choiceBadge = memberChoiceMeta(choice.choice, isVi)
          return (
            <li key={`${choice.memberId ?? 'member'}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="font-medium text-stone-800">
                {choice.memberName || `${copy(isVi, 'Hội viên', 'Member')} ${choice.memberId == null ? copy(isVi, 'chưa xác minh', 'unverified') : `#${choice.memberId}`}`}
              </span>
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${choiceBadge.badgeClass}`}>
                  {choiceBadge.label}
                </span>
                <span className="text-[11px] text-stone-500 tabular-nums">{localDateTime(choice.respondedAt)}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const formatFee = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount) : 'Chưa xác minh'
}

function TransferClassComparison({ source, target, sourceSessions, targetSessions, isVi }) {
  const sideTitles = [copy(isVi, 'Lớp hiện tại', 'Current class'), copy(isVi, 'Lớp đề xuất', 'Proposed class')]
  const rows = [
    { label: copy(isVi, 'Ngày khai giảng', 'First session'), source: sourceSessions?.[0]?.sessionDate ?? source?.startDate, target: targetSessions?.[0]?.sessionDate ?? target?.startDate },
    { label: copy(isVi, 'Môn học', 'Subject'), source: source?.subjectName ?? source?.category, target: target?.subjectName ?? target?.category },
    { label: copy(isVi, 'HLV', 'Coach'), source: sourceSessions?.[0]?.coachName ?? source?.coachName, target: targetSessions?.[0]?.coachName ?? target?.coachName },
    { label: copy(isVi, 'Sân / phòng', 'Court / room'), source: sourceSessions?.[0]?.roomName ?? sourceSessions?.[0]?.room?.name, target: targetSessions?.[0]?.roomName ?? targetSessions?.[0]?.room?.name },
    { label: copy(isVi, 'Học phí', 'Tuition'), source: formatFee(source?.tuitionFee), target: formatFee(target?.tuitionFee) },
    { label: copy(isVi, 'Sĩ số / tối đa', 'Enrollment / capacity'), source: `${source?.enrolledCount ?? '—'} / ${source?.maxCapacity ?? source?.capacity ?? '—'}`, target: `${target?.enrolledCount ?? '—'} / ${target?.maxCapacity ?? target?.capacity ?? '—'}` },
  ]
  const scheduleText = (item) => item ? `${sessionDate(item)}${item.coachName ? ` · ${item.coachName}` : ''}${item.roomName ? ` · ${item.roomName}` : ''}` : copy(isVi, 'Chưa có dữ liệu lịch', 'Schedule unavailable')
  return <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label={copy(isVi, 'So sánh lớp nguồn và lớp đề xuất', 'Compare source and proposed classes')}>
    {[{ title: sideTitles[0], item: source, sessions: sourceSessions, tone: 'border-stone-200 bg-white' }, { title: sideTitles[1], item: target, sessions: targetSessions, tone: 'border-indigo-200 bg-indigo-50/50' }].map((side) => <section key={side.title} className={`rounded-lg border p-3 ${side.tone}`}>
      <h4 className="text-xs font-semibold text-stone-800">{side.title}: {side.item?.name ?? copy(isVi, 'Chưa xác minh', 'Unverified')}</h4>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] text-stone-600">{rows.map((row) => <div key={row.label} className="contents"><dt>{row.label}</dt><dd className="font-medium text-stone-800">{row[side.title === sideTitles[0] ? 'source' : 'target'] ?? copy(isVi, 'Chưa xác minh', 'Unverified')}</dd></div>)}</dl>
      <details className="mt-2"><summary className="cursor-pointer text-[11px] font-semibold text-indigo-700">{copy(isVi, 'Lịch học', 'Schedule')} ({Array.isArray(side.sessions) ? side.sessions.length : 0})</summary><ol className="mt-1 max-h-28 space-y-1 overflow-auto text-[11px] text-stone-600">{Array.isArray(side.sessions) && side.sessions.length ? side.sessions.map((item, index) => <li key={item.id ?? item.sessionId ?? index}>{scheduleText(item)}</li>) : <li>{copy(isVi, 'Chưa tải được lịch chi tiết.', 'Schedule details could not be loaded.')}</li>}</ol></details>
    </section>)}</div>
}

function ProposalSchedule({ schedule, isVi }) {
  if (!Array.isArray(schedule)) return <p className="mt-2 text-xs text-amber-800">{copy(isVi, 'Lịch dự kiến: Chưa xác minh.', 'Proposed schedule: Unverified.')}</p>
  if (!schedule.length) return <p className="mt-2 text-xs text-amber-800">{copy(isVi, 'Lịch dự kiến: Chưa có buổi học nào.', 'Proposed schedule: No sessions listed.')}</p>
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-indigo-700">{copy(isVi, `Xem lịch dự kiến (${schedule.length} buổi)`, `View proposed schedule (${schedule.length} sessions)`)}</summary>
      <ol className="mt-2 max-h-36 space-y-1 overflow-auto rounded-md bg-stone-50 p-2 text-xs text-stone-700">
        {schedule.map((item, index) => (
          <li key={item.sessionId ?? index}>
            {item.sessionId == null ? '' : `Buổi #${item.sessionId} · `}{sessionDate(item)}
            {' · '}{copy(isVi, 'HLV', 'Coach')} #{item.coachId ?? '—'}{' · '}{copy(isVi, 'Sân / phòng', 'Court / room')} #{item.roomId ?? '—'}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] text-stone-500">{copy(isVi, 'Đây là phương án xem trước; chưa xác nhận giữ chỗ lớp đích.', 'This is a preview; a place in the target class is not reserved.')}</p>
    </details>
  )
}

export default function NormalClassLifecyclePanel({ classItem, initialKind = 'Postpone', initialAction = 'details', sessions = null, sessionsLoading = false, sessionsError = '', onRefreshClassDetail }) {
  const { apiEnabled, currentUser, classes, subjects, coaches, setClasses, language, showToast } = useSCMS()
  const isVi = language !== 'en'
  const classId = classItem?.id
  const authorities = Array.isArray(currentUser?.authorities) ? currentUser.authorities : []
  const authorized = apiEnabled && canManageNormalClassLifecycle(currentUser?.role, authorities)
  const isNormal = String(classItem?.classType ?? '').trim().toLowerCase() === 'normal'

  const [proposals, setProposals] = useState(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [kind, setKind] = useState(initialKind === 'Transfer' ? 'Transfer' : 'Postpone')
  const [shiftDays, setShiftDays] = useState('1')
  const [reason, setReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [targets, setTargets] = useState(null)
  const [targetsLoading, setTargetsLoading] = useState(false)
  const [targetsError, setTargetsError] = useState(null)
  const [targetClassId, setTargetClassId] = useState('')
  const [targetSessions, setTargetSessions] = useState(null)
  const [targetSessionsLoading, setTargetSessionsLoading] = useState(false)
  const [targetSessionsError, setTargetSessionsError] = useState(null)
  const [targetClassDetail, setTargetClassDetail] = useState(null)
  const [targetClassDetailLoading, setTargetClassDetailLoading] = useState(false)
  const [targetClassDetailError, setTargetClassDetailError] = useState(null)
  const [targetClassDetailRefreshKey, setTargetClassDetailRefreshKey] = useState(0)
  const [activeApplyProposalId, setActiveApplyProposalId] = useState(null)
  const [latestApplyProposal, setLatestApplyProposal] = useState(null)
  const [latestApplyClass, setLatestApplyClass] = useState(null)
  const [activeAction, setActiveAction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [actionStatus, setActionStatus] = useState('')

  const generation = useRef(0)
  const cancelSectionRef = useRef(null)

  useEffect(() => {
    if (initialAction !== 'cancel') return undefined
    const timer = window.setTimeout(() => {
      cancelSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [classId, initialAction])

  const loadProposals = useCallback(async ({ silent = false } = {}) => {
    if (!classId || !authorized || !isNormal) return false
    const requestGeneration = ++generation.current
    if (!silent) setProposalLoading(true)
    setProposalError(null)
    try {
      const items = await getNormalClassProposals(classId, { notifyForbidden: false })
      if (requestGeneration === generation.current) setProposals(items)
      return true
    } catch (error) {
      if (requestGeneration === generation.current) {
        setProposalError({
          status: Number(error?.status) || 0,
          code: error?.code ?? null,
          message: getErrorMessage(error),
        })
        // Preserve last known successful list; an error must not look like empty data.
      }
      return false
    } finally {
      if (requestGeneration === generation.current && !silent) {
        setProposalLoading(false)
        setRefreshing(false)
      }
    }
  }, [authorized, classId, isNormal])

  useEffect(() => {
    setProposals(null)
    setProposalError(null)
    setActiveApplyProposalId(null)
    setLatestApplyProposal(null)
    loadProposals()
    return () => { generation.current += 1 }
  }, [loadProposals])

  const loadTargets = useCallback(async () => {
    setTargetsLoading(true)
    setTargetsError(null)
    setTargets(null)
    try {
      const items = await managerApi.getClasses({ subjects, coaches }, { notifyForbidden: false })
      setClasses?.(items)
      const compatibleTargets = filterNormalTransferTargetsForUi(classItem, items)
      setTargets(compatibleTargets)
      setTargetClassId((currentId) => compatibleTargets.some((item) => String(item.id) === String(currentId)) ? currentId : '')
    } catch (error) {
      setTargetsError(getErrorMessage(error))
    } finally {
      setTargetsLoading(false)
    }
  }, [classItem, coaches, setClasses, subjects])

  useEffect(() => {
    if (kind === 'Transfer' && authorized && targets === null && !targetsLoading && !targetsError) loadTargets()
  }, [authorized, kind, loadTargets, targets, targetsError, targetsLoading])

  useEffect(() => {
    let active = true
    if (!targetClassId) {
      setTargetSessions(null)
      setTargetSessionsError(null)
      return () => { active = false }
    }
    setTargetSessions(null)
    setTargetSessionsLoading(true)
    setTargetSessionsError(null)
    getSessions({ classId: targetClassId }, { notifyForbidden: false })
      .then((items) => { if (active) setTargetSessions(items) })
      .catch((error) => { if (active) setTargetSessionsError(getErrorMessage(error)) })
      .finally(() => { if (active) setTargetSessionsLoading(false) })
    return () => { active = false }
  }, [targetClassId])

  useEffect(() => {
    let active = true
    if (!targetClassId) {
      setTargetClassDetail(null)
      setTargetClassDetailError(null)
      setTargetClassDetailLoading(false)
      return () => { active = false }
    }
    setTargetClassDetail(null)
    setTargetClassDetailError(null)
    setTargetClassDetailLoading(true)
    managerApi.getClassById(targetClassId, {}, { notifyForbidden: false })
      .then((item) => { if (active) setTargetClassDetail(item) })
      .catch((error) => { if (active) setTargetClassDetailError(getErrorMessage(error)) })
      .finally(() => { if (active) setTargetClassDetailLoading(false) })
    return () => { active = false }
  }, [targetClassId, targetClassDetailRefreshKey])

  const lifecycleCheck = useMemo(() => evaluateNormalClassLifecycle(classItem, {
    action: 'proposal',
    kind,
  }), [classItem, kind])
  const cancelCheck = useMemo(() => evaluateNormalClassLifecycle(classItem, { action: 'cancel' }), [classItem])
  const validTransferTarget = targets?.find((item) => String(item.id) === String(targetClassId)) ?? null
  const targetCutoffCheck = evaluateNormalTransferTargetCutoff(targetClassDetail)
  const applyEval = latestApplyProposal ? evaluateNormalProposalApply(latestApplyProposal, latestApplyClass) : null
  const actionBusy = Boolean(activeAction) || activeApplyProposalId != null || proposalLoading || refreshing
  const lifecycleDataReady = Array.isArray(proposals) && !proposalError
  const expectedSourceSessions = Number(classItem?.totalSessions ?? 12)
  const sourceScheduleReady = hasCompleteSchedule(sessions, expectedSourceSessions)
  const expectedTargetSessions = Number(validTransferTarget?.totalSessions ?? 12)
  const targetScheduleReady = hasCompleteSchedule(targetSessions, expectedTargetSessions)
  const appliedTransferProposal = proposals?.find((proposal) =>
    String(proposal.kind ?? '').toLowerCase() === 'transfer' && String(proposal.status ?? '').toLowerCase() === 'applied',
  ) ?? null
  const createBlocked = !lifecycleCheck.canAttempt || lifecycleCheck.unverified.length > 0 ||
    !lifecycleDataReady || !Number.isSafeInteger(classItem?.lifecycleVersion) || !reason.trim() ||
    (kind === 'Transfer' && !sourceScheduleReady) ||
    (kind === 'Postpone' && (!Number.isInteger(Number(shiftDays)) || Number(shiftDays) <= 0)) ||
    (kind === 'Transfer' && (!validTransferTarget || targetSessionsLoading || Boolean(targetSessionsError) || !targetScheduleReady || targetClassDetailLoading || Boolean(targetClassDetailError) || !targetCutoffCheck.canAttempt))
  const cancelBlocked = !cancelCheck.canAttempt || cancelCheck.unverified.length > 0 ||
    !lifecycleDataReady || !Number.isSafeInteger(classItem?.lifecycleVersion) || !cancelReason.trim()
  const cancelNotice = cancelCheck.blockers[0] ?? cancelCheck.unverified[0] ??
    (!lifecycleDataReady
      ? proposalError ? 'Không tải được dữ liệu phương án; hãy tải lại trước khi hủy lớp.' : 'Đang tải trạng thái lớp…'
      : null)

  const refreshAllReadData = useCallback(async () => {
    setRefreshing(true)
    setActionStatus('')
    try {
      setLatestApplyProposal(null)
      setLatestApplyClass(null)
      const proposalsLoaded = await loadProposals({ silent: true })
      const reads = await Promise.allSettled([
        onRefreshClassDetail?.(),
        ...(targetClassId ? [getSessions({ classId: targetClassId }, { notifyForbidden: false })] : []),
        ...(kind === 'Transfer' ? [managerApi.getClasses({ subjects, coaches }, { notifyForbidden: false })] : []),
      ])
      if (targetClassId && reads[1]?.status === 'fulfilled') {
        setTargetSessions(reads[1].value)
        setTargetSessionsError(null)
      } else if (targetClassId && reads[1]?.status === 'rejected') {
        setTargetSessionsError(getErrorMessage(reads[1].reason))
      }
      const targetClassesIndex = targetClassId ? 2 : 1
      if (kind === 'Transfer' && reads[targetClassesIndex]?.status === 'fulfilled') {
        const freshClasses = reads[targetClassesIndex].value
        setClasses?.(freshClasses)
        const compatibleTargets = filterNormalTransferTargetsForUi(classItem, freshClasses)
        setTargets(compatibleTargets)
        setTargetClassId((currentId) => compatibleTargets.some((item) => String(item.id) === String(currentId)) ? currentId : '')
        setTargetsError(null)
      } else if (kind === 'Transfer' && reads[targetClassesIndex]?.status === 'rejected') {
        setTargetsError(getErrorMessage(reads[targetClassesIndex].reason))
      }
      return proposalsLoaded && reads.every((result) => result.status === 'fulfilled') && reads[0]?.value !== false
    } finally {
      setRefreshing(false)
    }
  }, [classId, classItem, coaches, kind, loadProposals, onRefreshClassDetail, setClasses, subjects, targetClassId])

  const refreshLatestApplyProposal = async (proposalId) => {
    setActiveApplyProposalId(proposalId)
    setLatestApplyProposal(null)
    setLatestApplyClass(null)
    setProposalError(null)
    try {
      const [items, latestClass] = await Promise.all([
        getNormalClassProposals(classId, { notifyForbidden: false }),
        managerApi.getClassById(classId, {}, { notifyForbidden: false }),
        onRefreshClassDetail?.(),
      ])
      setProposals(items)
      const latest = items.find((item) => String(item.id) === String(proposalId))
      if (latest) {
        setLatestApplyProposal(latest)
        setLatestApplyClass(latestClass)
        if (!Number.isSafeInteger(latestClass.lifecycleVersion)) setActionStatus('Đã tải proposal nhưng lifecycleVersion lớp không hợp lệ. Hãy tải lại trước khi áp dụng.')
        return Number.isSafeInteger(latestClass.lifecycleVersion)
      }
      else setProposalError({ status: 0, code: null, message: 'Không tìm thấy đề xuất trong dữ liệu mới nhất.' })
      return false
    } catch (error) {
      setProposalError({ status: Number(error?.status) || 0, code: error?.code ?? null, message: getErrorMessage(error) })
      return false
    } finally {
      setActiveApplyProposalId(null)
    }
  }

  const handleActionFailure = async (error, proposalId = null) => {
    const details = getNormalLifecycleError(error)
    const staleClass = isNormalLifecycleStaleError(error, 'NORMAL_VERSION_STALE')
    const staleProposal = isNormalLifecycleStaleError(error, 'NORMAL_PROPOSAL_STALE')
    setActionError({ status: details.status, message: details.message })
    if (staleClass || staleProposal) {
      const refreshed = staleProposal && proposalId != null
        ? await refreshLatestApplyProposal(proposalId)
        : await refreshAllReadData()
      if (refreshed) setActionError(null)
      setActionStatus(staleProposal
        ? 'Phiên bản proposal đã cũ. Đã tải lại proposal; vui lòng kiểm tra lại trước khi thao tác.'
        : 'Phiên bản lớp đã cũ. Đã tải lại dữ liệu lớp và proposal; vui lòng kiểm tra lại trước khi thao tác.')
    }
  }

  const submitCreateProposal = async () => {
    if (createBlocked || actionBusy) return
    setActiveAction('create')
    setActionError(null)
    setActionStatus('')
    try {
      await createNormalClassProposal(classId, {
        kind,
        version: classItem.lifecycleVersion,
        reason: reason.trim(),
        ...(kind === 'Postpone'
          ? { shiftDays: Number(shiftDays) }
          : { targetClassId: Number(targetClassId) }),
      }, { notifyForbidden: false })
      setReason('')
      const sentMessage = copy(isVi, 'Đã gửi đề xuất.', 'Proposal sent.')
      showToast?.(sentMessage, 'success')
      const refreshed = await refreshAllReadData()
      setActionStatus(refreshed
        ? sentMessage
        : copy(isVi, 'Đã gửi đề xuất nhưng chưa tải lại được toàn bộ dữ liệu. Hãy tải lại trước thao tác tiếp theo.', 'Proposal sent, but not all data could be refreshed. Please reload before the next action.'))
    } catch (error) {
      await handleActionFailure(error)
    } finally {
      setActiveAction(null)
    }
  }

  const submitApplyProposal = async (proposal) => {
    const repairAppliedTransfer = String(proposal.kind ?? '').toLowerCase() === 'transfer'
      && String(proposal.status ?? '').toLowerCase() === 'applied'
      && latestApplyClass?.changePending === true
      && !proposals?.some((item) => String(item.id) !== String(proposal.id) && String(item.status ?? '').toLowerCase() === 'pending')
    const check = evaluateNormalProposalApply(proposal, latestApplyClass, { allowAppliedTransferRepair: repairAppliedTransfer })
    const freshClassCheck = repairAppliedTransfer ? null : evaluateNormalClassLifecycle(latestApplyClass, { action: 'cancel' })
    if (!check.canAttempt || (!repairAppliedTransfer && (!freshClassCheck?.canAttempt || freshClassCheck?.unverified.length > 0 || latestApplyClass?.lifecycleVersion !== proposal.version)) || actionBusy || !latestApplyProposal ||
      String(latestApplyProposal.id) !== String(proposal.id)) return
    if (typeof window !== 'undefined' && !window.confirm(repairAppliedTransfer
      ? copy(isVi, 'Khôi phục lớp nguồn sau Transfer đã áp dụng? Lớp vẫn mở; thao tác này không hủy lớp.', 'Release the source class after the applied transfer? The class stays open and will not be cancelled.')
      : copy(isVi, 'Áp dụng phương án mới nhất cho lớp này?', 'Apply the latest proposal to this class?'))) return
    setActiveAction(`apply:${proposal.id}`)
    setActionError(null)
    setActionStatus('')
    try {
      await applyNormalClassProposal(proposal.id, { version: proposal.version }, { notifyForbidden: false })
      const refreshed = await refreshAllReadData()
      setActionStatus(refreshed
        ? 'Đã áp dụng phương án. Dữ liệu lớp và proposal đã được tải lại.'
        : 'Đã áp dụng phương án nhưng chưa tải lại được toàn bộ dữ liệu. Hãy tải lại trước thao tác tiếp theo.')
    } catch (error) {
      await handleActionFailure(error, proposal.id)
    } finally {
      setActiveAction(null)
    }
  }

  const submitCancelClass = async () => {
    if (cancelBlocked || actionBusy) return
    if (typeof window !== 'undefined' && !window.confirm('Hủy lớp trước khai giảng? Hành động này không đồng nghĩa với hoàn tiền.')) return
    setActiveAction('cancel')
    setActionError(null)
    setActionStatus('')
    try {
      await cancelNormalClassBeforeOpening(classId, {
        version: classItem.lifecycleVersion,
        reason: cancelReason.trim(),
      }, { notifyForbidden: false })
      setCancelReason('')
      const refreshed = await refreshAllReadData()
      setActionStatus(refreshed
        ? 'Đã hủy lớp. Dữ liệu lớp đã được tải lại.'
        : 'Đã hủy lớp nhưng chưa tải lại được toàn bộ dữ liệu. Hãy tải lại trước thao tác tiếp theo.')
    } catch (error) {
      await handleActionFailure(error)
    } finally {
      setActiveAction(null)
    }
  }

  if (!apiEnabled || !authorized || !isNormal) return null

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4" aria-labelledby="normal-proposals-heading" aria-busy={proposalLoading || refreshing}>
      {initialAction !== 'cancel' && <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="normal-proposals-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
            {copy(isVi, 'Phương án thay đổi lớp / đề xuất chuyển học viên', 'Class change proposals / learner transfers')}
          </h3>
          <p className="mt-1 text-xs text-stone-500">{copy(isVi, 'Đề xuất và phản hồi của hội viên.', 'Proposals and member responses.')}</p>
        </div>
        <button type="button" disabled={proposalLoading || refreshing} onClick={() => { setRefreshing(true); refreshAllReadData() }} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${proposalLoading || refreshing ? 'animate-spin' : ''}`} />
          {copy(isVi, 'Tải lại', 'Reload')}
        </button>
      </div>

      {actionError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">Không thể hoàn tất thao tác: {actionError.message}{actionError.status ? ` (HTTP ${actionError.status})` : ''}</p>}
      {actionStatus && <p role="status" className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{actionStatus}</p>}

      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
          <CalendarClock className="h-4 w-4 text-indigo-600" />
          {copy(isVi, 'Tạo đề xuất', 'Create proposal')}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-stone-700">
              {copy(isVi, 'Loại đề xuất', 'Proposal type')}
            <select value={kind} onChange={(event) => { setKind(event.target.value); setTargetClassId('') }} className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" disabled={proposalLoading || refreshing}>
              <option value="Postpone">{copy(isVi, 'Dời ngày khai giảng', 'Postpone first session')}</option>
              <option value="Transfer">{copy(isVi, 'Đề xuất chuyển học viên (gộp sang lớp Normal khác)', 'Propose moving learners to another Normal class')}</option>
            </select>
          </label>
          {kind === 'Postpone' ? (
            <label className="text-xs font-medium text-stone-700">
              {copy(isVi, 'Số ngày dự kiến dời', 'Days to postpone')}
              <input type="number" min="1" step="1" value={shiftDays} onChange={(event) => setShiftDays(event.target.value)} className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" />
            </label>
          ) : (
            <label className="text-xs font-medium text-stone-700">
              {copy(isVi, 'Lớp đích', 'Target class')}
              <select value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" disabled={targetsLoading || Boolean(targetsError)}>
              <option value="">{targetsLoading ? copy(isVi, 'Đang tải lớp phù hợp…', 'Loading compatible classes…') : targetsError ? copy(isVi, 'Không tải được danh sách lớp', 'Could not load classes') : copy(isVi, 'Chọn lớp đích tương thích', 'Choose a compatible target class')}</option>
              {(targets ?? []).map((target) => {
                return <option key={target.id} value={target.id}>{target.name ?? `Lớp #${target.id}`}</option>
              })}
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-stone-700 sm:col-span-2">
            {copy(isVi, 'Lý do', 'Reason')}
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 block w-full resize-y rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" placeholder={copy(isVi, 'Nhập lý do đề xuất', 'Enter a reason for the proposal')} />
          </label>
        </div>
        {kind === 'Postpone' && (
          <p className="mt-2 text-xs text-stone-600">{copy(isVi, 'Buổi đầu hiện tại:', 'Current first session:')} {Array.isArray(sessions) && sessions.length ? sessionDate([...sessions].sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))[0]) : copy(isVi, 'Chưa xác minh', 'Unverified')}</p>
        )}
        {kind === 'Transfer' && (
          <div className="mt-3 space-y-2.5 text-xs">
            {!targetsLoading && !targetsError && (targets ?? []).length === 0 && <p role="status" className="text-amber-800">{copy(isVi, 'Không có lớp đích tương thích từ dữ liệu hiện có.', 'No compatible target class was found in the available data.')}</p>}
            {targetsError && <p role="alert" className="text-rose-700">{copy(isVi, 'Không tải được lớp đích:', 'Could not load target classes:')} {targetsError}</p>}
            {targetsError && <button type="button" onClick={loadTargets} disabled={targetsLoading} className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-50">{copy(isVi, 'Tải lại lớp đích', 'Reload target classes')}</button>}
            {validTransferTarget && (
              <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-2xs">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-1.5 font-semibold text-stone-800">
                    <CalendarClock className="h-4 w-4 text-indigo-600" />
                    <span>{copy(isVi, 'Lịch lớp đích', 'Target class schedule')}</span>
                  </div>
                  {Array.isArray(targetSessions) && targetSessions.length > 0 && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                      {copy(isVi, `${targetSessions.length} buổi học`, `${targetSessions.length} sessions`)}
                    </span>
                  )}
                </div>
                {targetSessionsLoading && <p role="status" className="text-stone-500">{copy(isVi, 'Đang tải lịch lớp đích…', 'Loading target schedule…')}</p>}
                {targetSessionsError && <p role="alert" className="text-rose-700">{copy(isVi, 'Không tải được lịch lớp đích:', 'Could not load target schedule:')} {targetSessionsError}</p>}
                {Array.isArray(targetSessions) && targetSessions.length === 0 && <p className="text-amber-800">{copy(isVi, 'Chưa có lịch cho lớp đích.', 'The target class has no schedule.')}</p>}
                {Array.isArray(targetSessions) && targetSessions.length > 0 && (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {targetSessions.map((item, index) => {
                      const rawDate = item?.sessionDate ?? item?.date
                      const slotLabel = formatSessionSlotLabel(item, isVi)
                      return (
                        <li
                          key={item.id ?? index}
                          className="flex items-center justify-between gap-2 rounded-md border border-stone-200/80 bg-stone-50/70 px-2.5 py-2 text-stone-700"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700">
                              {index + 1}
                            </span>
                            <span className="whitespace-nowrap font-semibold text-stone-900">
                              {rawDate ? formatDate(rawDate) : copy(isVi, 'Chưa xác minh', 'Unverified')}
                            </span>
                          </div>
                          {slotLabel && (
                            <span className="shrink-0 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                              {slotLabel}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
            {validTransferTarget && targetClassDetailLoading && <p role="status" className="text-stone-500">{copy(isVi, 'Đang kiểm tra hạn đăng ký của lớp đích…', 'Checking the target registration cutoff…')}</p>}
            {validTransferTarget && targetClassDetailError && (
              <p role="alert" className="text-rose-700">
                {copy(isVi, 'Không tải được trạng thái và hạn đăng ký của lớp đích:', 'Could not load target status and registration cutoff:')} {targetClassDetailError}{' '}
                <button type="button" onClick={() => setTargetClassDetailRefreshKey((key) => key + 1)} className="font-semibold underline">{copy(isVi, 'Thử lại', 'Retry')}</button>
              </p>
            )}
            {validTransferTarget && !targetClassDetailLoading && !targetClassDetailError && targetCutoffCheck.state === 'unverified' && (
              <p role="status" className="text-amber-800">{targetCutoffCheck.message}</p>
            )}
            {validTransferTarget && !targetClassDetailLoading && !targetClassDetailError && targetCutoffCheck.state === 'closed' && (
              <p role="status" className="text-amber-800">{targetCutoffCheck.message}</p>
            )}
            {validTransferTarget && !targetClassDetailLoading && !targetClassDetailError && targetCutoffCheck.state === 'open' && (
              <p className="text-emerald-700">{copy(isVi, 'Lớp đích còn nhận đăng ký đến', 'Target registration is open until')} {localDateTime(targetCutoffCheck.registrationDeadline)}.</p>
            )}
            {validTransferTarget && <TransferClassComparison source={classItem} target={targetClassDetail ?? validTransferTarget} sourceSessions={sessions} targetSessions={targetSessions} isVi={isVi} />}
          </div>
        )}
        {(lifecycleCheck.blockers.length > 0 || lifecycleCheck.unverified.length > 0) && (
          <p className="mt-2 text-xs text-amber-800">{lifecycleCheck.blockers[0] ?? lifecycleCheck.unverified[0]}</p>
        )}
        {sessionsLoading && <p role="status" className="mt-2 text-xs text-stone-500">{copy(isVi, 'Đang tải lịch lớp nguồn…', 'Loading source schedule…')}</p>}
        {sessionsError && <p role="alert" className="mt-2 text-xs text-rose-700">{copy(isVi, 'Không tải được lịch lớp nguồn:', 'Could not load source schedule:')} {sessionsError}</p>}
        {kind === 'Transfer' && !sessionsLoading && !sessionsError && !sourceScheduleReady && <p className="mt-2 text-xs text-amber-800">{copy(isVi, `Lịch lớp nguồn chưa đủ ${expectedSourceSessions} buổi hợp lệ.`, `The source schedule does not have ${expectedSourceSessions} valid sessions.`)}</p>}
        {kind === 'Transfer' && validTransferTarget && Array.isArray(targetSessions) && !targetScheduleReady && !targetSessionsLoading && !targetSessionsError && <p className="mt-2 text-xs text-amber-800">{copy(isVi, `Lịch lớp đích chưa đủ ${expectedTargetSessions} buổi hợp lệ.`, `The target schedule does not have ${expectedTargetSessions} valid sessions.`)}</p>}
        <button type="button" disabled={actionBusy || createBlocked} title={createBlocked ? lifecycleCheck.blockers[0] ?? lifecycleCheck.unverified[0] ?? (!lifecycleDataReady ? 'Đang chờ tải proposal thành công.' : kind === 'Transfer' && (sessionsError || !sourceScheduleReady) ? 'Không tải được hoặc lịch lớp nguồn chưa đủ buổi hợp lệ.' : kind === 'Transfer' && targetClassDetailError ? 'Không tải được trạng thái lớp đích.' : kind === 'Transfer' && targetClassDetailLoading ? 'Đang xác minh hạn đăng ký của lớp đích.' : kind === 'Transfer' && validTransferTarget && !targetCutoffCheck.canAttempt ? targetCutoffCheck.message : kind === 'Transfer' && (targetSessionsError || targetSessionsLoading || !targetScheduleReady) ? 'Chưa xác minh được lịch lớp đích.' : !reason.trim() ? 'Vui lòng nhập lý do.' : undefined) : undefined} onClick={submitCreateProposal} className="mt-3 rounded-md bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {activeAction === 'create' ? copy(isVi, 'Đang gửi đề xuất…', 'Sending proposal…') : kind === 'Transfer' ? copy(isVi, 'Gửi đề xuất chuyển học viên', 'Send learner transfer proposal') : copy(isVi, 'Tạo đề xuất', 'Create proposal')}
        </button>
      </div>

      {proposalError && (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <span>Không tải được đề xuất: {proposalError.message}{proposalError.status ? ` (HTTP ${proposalError.status})` : ''}{proposalError.code ? ` · ${proposalError.code}` : ''}</span>
          <button type="button" disabled={proposalLoading || refreshing} onClick={() => loadProposals()} className="rounded border border-rose-300 bg-white px-2.5 py-1.5 font-semibold">Thử lại</button>
        </div>
      )}

      {proposalLoading && <p role="status" className="py-3 text-center text-xs text-stone-500">Đang tải đề xuất…</p>}
      {!proposalLoading && proposals === null && !proposalError && <p className="py-3 text-xs text-stone-500">Chưa tải được danh sách đề xuất. Hãy tải lại để kiểm tra.</p>}
      {!proposalLoading && proposals?.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 px-3 py-5 text-center text-xs text-stone-500">Chưa có phương án thay đổi cho lớp này.</p>}

      {Array.isArray(proposals) && proposals.length > 0 && (
        <ul className="space-y-3">
          {proposals.map((proposal, index) => {
            const inspected = inspectNormalClassProposal(proposal)
            const isLatestProposal = String(latestApplyProposal?.id) === String(proposal.id)
            const proposalClass = isLatestProposal ? latestApplyClass : classItem
            const canRepairTransfer = String(proposal.kind ?? '').toLowerCase() === 'transfer'
              && String(proposal.status ?? '').toLowerCase() === 'applied'
              && proposalClass?.changePending === true
              && !proposals.some((item) => String(item.id) !== String(proposal.id) && String(item.status ?? '').toLowerCase() === 'pending')
            const applyState = evaluateNormalProposalApply(proposal, proposalClass, { allowAppliedTransferRepair: canRepairTransfer })
            const isApplyLoading = String(activeApplyProposalId) === String(proposal.id)
            const target = proposal.targetClassId == null ? null : classes?.find((item) => String(item.id) === String(proposal.targetClassId))
            const statusMeta = proposalStatusMeta(proposal.status, isVi)
            return (
              <li key={proposal.id ?? index} className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-stone-900">
                        {inspected.kind === 'unknown' ? copy(isVi, `Loại: ${text(proposal.kind)}`, `Type: ${text(proposal.kind)}`) : inspected.kind === 'postpone' ? copy(isVi, 'Đề xuất dời khai giảng', 'Postpone proposal') : copy(isVi, 'Đề xuất chuyển học viên', 'Learner transfer proposal')}
                      </p>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-600">
                      {proposal.targetClassId != null && (
                        <span>
                          {copy(isVi, 'Lớp đích:', 'Target class:')}{' '}
                          <strong className="font-semibold text-stone-900">{target?.name ?? `#${proposal.targetClassId}`}</strong>
                        </span>
                      )}
                      {proposal.shiftDays != null && (
                        <span>
                          {copy(isVi, 'Dự kiến dời:', 'Postponement:')}{' '}
                          <strong className="font-semibold text-stone-900">{copy(isVi, `${proposal.shiftDays} ngày`, `${proposal.shiftDays} days`)}</strong>
                        </span>
                      )}
                      <span>
                        {copy(isVi, 'Lý do:', 'Reason:')}{' '}
                        <span className="text-stone-800">{text(proposal.reason, copy(isVi, 'Không có', 'None'))}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={isApplyLoading || actionBusy} onClick={() => refreshLatestApplyProposal(proposal.id)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                      {isApplyLoading ? copy(isVi, 'Đang kiểm tra…', 'Checking…') : copy(isVi, 'Kiểm tra đề xuất mới nhất', 'Check latest proposal')}
                    </button>
                    <button type="button" disabled={actionBusy || !latestApplyProposal || !isLatestProposal || !latestApplyClass || (latestApplyClass.lifecycleVersion !== latestApplyProposal.version && !canRepairTransfer) || !applyState.canAttempt} title={applyState.blockers[0] ?? applyState.unverified[0] ?? (!latestApplyProposal || !isLatestProposal ? 'Kiểm tra proposal mới nhất trước khi áp dụng.' : latestApplyClass?.lifecycleVersion !== latestApplyProposal?.version && !canRepairTransfer ? 'Phiên bản lớp hoặc proposal chưa đồng bộ.' : undefined)} onClick={() => submitApplyProposal(latestApplyProposal)} className="rounded-lg border border-indigo-300 bg-indigo-50/70 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                      {activeAction === `apply:${proposal.id}` ? copy(isVi, 'Đang xử lý…', 'Processing…') : canRepairTransfer ? copy(isVi, 'Mở khóa lớp nguồn', 'Release source class') : copy(isVi, 'Áp dụng', 'Apply')}
                    </button>
                  </div>
                </div>
                {String(latestApplyProposal?.id) === String(proposal.id) && (
                  <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                    <p className="font-semibold">Đã tải đề xuất mới nhất.</p>
                    <p className="mt-1">Trạng thái: {proposalStatusMeta(latestApplyProposal.status, isVi).label}. {applyEval?.blockers[0] ?? applyEval?.unverified[0] ?? 'Hệ thống đang thẩm định đề xuất.'}</p>
                    {applyEval?.canAttempt && <p className="mt-1 font-medium text-emerald-800">Đề xuất đã sẵn sàng để áp dụng.</p>}
                  </div>
                )}
                {inspected.kind !== 'transfer' && <ProposalSchedule schedule={proposal.schedule} isVi={isVi} />}
                <ProposalChoices proposal={proposal} isVi={isVi} />
              </li>
            )
          })}
        </ul>
      )}
      {appliedTransferProposal && <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">{copy(isVi, 'Đề xuất chuyển học viên đã áp dụng; lớp nguồn vẫn mở và không bị tự hủy.', 'The transfer proposal is applied; the source class remains open and is not cancelled.')}</p>
        <p className="mt-1">{copy(isVi, 'Có thể tiếp tục chuyển học viên phù hợp vào lớp này theo lịch, sức chứa và điều kiện hiện tại.', 'Eligible members can continue transferring into this class, subject to its current schedule, capacity, and rules.')}</p>
      </div>}
      </>}

      {(initialAction !== 'transfer' || appliedTransferProposal) && <div ref={cancelSectionRef} className={`${initialAction === 'cancel' ? '' : 'mt-4 border-t border-stone-200 pt-3'}`}>
        <p className="text-xs font-semibold text-stone-800">Hủy lớp trước khai giảng</p>
        <p className="mt-1 text-xs text-stone-600">Hủy lớp không đồng nghĩa hoàn tiền. Không thay đổi hóa đơn, enrollment hoặc trạng thái hiển thị tại đây.</p>
        {cancelNotice ? (
          <div role="status" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <span>{cancelNotice}</span>
            <button type="button" disabled={refreshing || proposalLoading} onClick={() => refreshAllReadData()} className="rounded border border-amber-300 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-50">
              Tải lại trạng thái lớp
            </button>
          </div>
        ) : (
          <>
            <label className="mt-2 block text-xs font-medium text-stone-700">
              Lý do hủy
              <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={2} className="mt-1 block w-full resize-y rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" placeholder="Nhập lý do hủy lớp" />
            </label>
            <button type="button" disabled={actionBusy || cancelBlocked} title={cancelBlocked ? (!cancelReason.trim() ? 'Vui lòng nhập lý do hủy.' : undefined) : undefined} onClick={submitCancelClass} className="mt-2 rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">
              {activeAction === 'cancel' ? 'Đang hủy lớp…' : 'Hủy lớp'}
            </button>
          </>
        )}
      </div>}
    </section>
  )
}

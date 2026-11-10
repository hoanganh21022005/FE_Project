import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, CalendarClock, RefreshCw } from 'lucide-react'
import { getErrorMessage } from '../../api/apiErrors.js'
import * as managerApi from '../../api/managerApi.js'
import { getSessions } from '../../api/managerApi.js'
import {
  canManageNormalClassLifecycle,
  evaluateNormalClassLifecycle,
  evaluateNormalProposalApply,
  getNormalClassProposals,
  inspectNormalClassProposal,
  normalLifecycleVersionSemantics,
} from '../../api/normalClassLifecycleApi.js'
import { useSCMS } from '../../context/SCMSContext.jsx'

const text = (value, fallback = 'Chưa xác minh') =>
  typeof value === 'string' && value.trim() ? value : fallback

const localDateTime = (value) => {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

const sessionDate = (session) => {
  const date = session?.sessionDate ?? session?.date
  if (!date) return 'Chưa xác minh'
  return `${date}${session?.startTime ? ` · ${session.startTime}` : ''}${session?.endTime ? `–${session.endTime}` : ''}`
}

function ProposalChoices({ proposal }) {
  const inspected = inspectNormalClassProposal(proposal)
  if (!Array.isArray(inspected.choices)) {
    return <p className="mt-2 text-xs text-amber-800">Phản hồi Member: Chưa xác minh (Backend không trả danh sách lựa chọn).</p>
  }
  if (!inspected.memberChoicesVerified) {
    return <p className="mt-2 text-xs text-amber-800">Phản hồi Member: Chưa xác minh (có giá trị chưa được xác nhận trong contract).</p>
  }
  if (inspected.choices.length === 0) {
    return <p className="mt-2 text-xs text-amber-800">Phản hồi Member: Chưa xác minh (danh sách trống không chứng minh Member đã đồng ý).</p>
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-stone-700">Phản hồi Member</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">
          {inspected.pendingChoiceCount === null ? 'Chưa xác minh số đang chờ' : `${inspected.pendingChoiceCount} đang chờ`}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {inspected.choices.map((choice, index) => (
          <li key={`${choice.memberId ?? 'member'}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-stone-50 px-2.5 py-2 text-xs">
            <span className="text-stone-600">Member {choice.memberId == null ? 'chưa xác minh' : `#${choice.memberId}`}</span>
            <span className="font-semibold text-stone-900">{text(choice.choice)}</span>
            <span className="text-stone-500">{localDateTime(choice.respondedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProposalSchedule({ schedule }) {
  if (!Array.isArray(schedule)) return <p className="mt-2 text-xs text-amber-800">Lịch dự kiến: Chưa xác minh.</p>
  if (!schedule.length) return <p className="mt-2 text-xs text-amber-800">Lịch dự kiến: Backend chưa trả buổi học nào.</p>
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-semibold text-indigo-700">Xem lịch dự kiến từ Backend ({schedule.length} buổi)</summary>
      <ol className="mt-2 max-h-36 space-y-1 overflow-auto rounded-md bg-stone-50 p-2 text-xs text-stone-700">
        {schedule.map((item, index) => (
          <li key={item.sessionId ?? index}>
            {item.sessionId == null ? '' : `Buổi #${item.sessionId} · `}{sessionDate(item)}
            {' · Coach '}{item.coachId ?? 'Chưa xác minh'}{' · Phòng '}{item.roomId ?? 'Chưa xác minh'}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] text-stone-500">Đây là phương án xem trước; chưa xác nhận giữ chỗ lớp đích.</p>
    </details>
  )
}

export default function NormalClassLifecyclePanel({ classItem, sessions = null, onRefreshClassDetail }) {
  const { apiEnabled, currentUser, classes, subjects, coaches, setClasses } = useSCMS()
  const classId = classItem?.id
  const authorities = Array.isArray(currentUser?.authorities) ? currentUser.authorities : []
  const authorized = apiEnabled && canManageNormalClassLifecycle(currentUser?.role, authorities)
  const isNormal = String(classItem?.classType ?? '').trim().toLowerCase() === 'normal'

  const [proposals, setProposals] = useState(null)
  const [proposalLoading, setProposalLoading] = useState(false)
  const [proposalError, setProposalError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [kind, setKind] = useState('Postpone')
  const [shiftDays, setShiftDays] = useState('1')
  const [reason, setReason] = useState('')
  const [targets, setTargets] = useState(null)
  const [targetsLoading, setTargetsLoading] = useState(false)
  const [targetsError, setTargetsError] = useState(null)
  const [targetClassId, setTargetClassId] = useState('')
  const [targetSessions, setTargetSessions] = useState(null)
  const [targetSessionsLoading, setTargetSessionsLoading] = useState(false)
  const [targetSessionsError, setTargetSessionsError] = useState(null)
  const [activeApplyProposalId, setActiveApplyProposalId] = useState(null)
  const [latestApplyProposal, setLatestApplyProposal] = useState(null)

  const generation = useRef(0)
  const loadProposals = useCallback(async ({ silent = false } = {}) => {
    if (!classId || !authorized || !isNormal) return
    const requestGeneration = ++generation.current
    if (!silent) setProposalLoading(true)
    setProposalError(null)
    try {
      const items = await getNormalClassProposals(classId, { notifyForbidden: false })
      if (requestGeneration === generation.current) setProposals(items)
    } catch (error) {
      if (requestGeneration === generation.current) {
        setProposalError({
          status: Number(error?.status) || 0,
          code: error?.code ?? null,
          message: getErrorMessage(error),
        })
        // Preserve last known successful list; an error must not look like empty data.
      }
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
      setTargets(items.filter((item) =>
        String(item.classType ?? '').toLowerCase() === 'normal' &&
        String(item.apiStatus ?? '').toLowerCase() === 'open' &&
        String(item.id) !== String(classId),
      ))
    } catch (error) {
      setTargetsError(getErrorMessage(error))
    } finally {
      setTargetsLoading(false)
    }
  }, [classId, coaches, setClasses, subjects])

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

  const lifecycleCheck = useMemo(() => evaluateNormalClassLifecycle(classItem, {
    action: 'proposal',
    kind,
  }), [classItem, kind])
  const cancelCheck = useMemo(() => evaluateNormalClassLifecycle(classItem, { action: 'cancel' }), [classItem])
  const versionBlocked = Object.values(normalLifecycleVersionSemantics)
    .filter((message) => message.includes('NEED_BE_CONFIRMATION'))
  const validTransferTarget = targets?.find((item) => String(item.id) === String(targetClassId)) ?? null
  const applyEval = latestApplyProposal ? evaluateNormalProposalApply(latestApplyProposal) : null

  const refreshAllReadData = useCallback(async () => {
    setRefreshing(true)
    await loadProposals({ silent: true })
    const reads = await Promise.allSettled([
      onRefreshClassDetail?.(),
      ...(targetClassId ? [getSessions({ classId: targetClassId }, { notifyForbidden: false })] : []),
      ...(kind === 'Transfer' ? [managerApi.getClasses({ subjects, coaches }, { notifyForbidden: false })] : []),
    ])
    if (targetClassId && reads[1]?.status === 'fulfilled') setTargetSessions(reads[1].value)
    else if (targetClassId && reads[1]?.status === 'rejected') setTargetSessionsError(getErrorMessage(reads[1].reason))
    const targetClassesIndex = targetClassId ? 2 : 1
    if (kind === 'Transfer' && reads[targetClassesIndex]?.status === 'fulfilled') {
      const freshClasses = reads[targetClassesIndex].value
      setClasses?.(freshClasses)
      setTargets(freshClasses.filter((item) => String(item.classType ?? '').toLowerCase() === 'normal' && String(item.apiStatus ?? '').toLowerCase() === 'open' && String(item.id) !== String(classId)))
      setTargetsError(null)
    } else if (kind === 'Transfer' && reads[targetClassesIndex]?.status === 'rejected') {
      setTargetsError(getErrorMessage(reads[targetClassesIndex].reason))
    }
    setRefreshing(false)
  }, [classId, coaches, kind, loadProposals, onRefreshClassDetail, setClasses, subjects, targetClassId])

  const refreshLatestApplyProposal = async (proposalId) => {
    setActiveApplyProposalId(proposalId)
    setLatestApplyProposal(null)
    setProposalError(null)
    try {
      const items = await getNormalClassProposals(classId, { notifyForbidden: false })
      setProposals(items)
      const latest = items.find((item) => String(item.id) === String(proposalId))
      if (latest) setLatestApplyProposal(latest)
      else setProposalError({ status: 0, code: null, message: 'Không tìm thấy đề xuất trong dữ liệu mới nhất.' })
    } catch (error) {
      setProposalError({ status: Number(error?.status) || 0, code: error?.code ?? null, message: getErrorMessage(error) })
    } finally {
      setActiveApplyProposalId(null)
    }
  }

  if (!apiEnabled || !authorized || !isNormal) return null

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4" aria-labelledby="normal-proposals-heading" aria-busy={proposalLoading || refreshing}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="normal-proposals-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
            Phương án thay đổi lớp
          </h3>
          <p className="mt-1 text-xs text-stone-500">Đề xuất và phản hồi Member được tải trực tiếp từ Backend.</p>
        </div>
        <button type="button" disabled={proposalLoading || refreshing} onClick={() => { setRefreshing(true); refreshAllReadData() }} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${proposalLoading || refreshing ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
      </div>

      {versionBlocked.length > 0 && (
        <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" />Thao tác ghi đang chờ Backend xác nhận version</p>
          <p className="mt-1">OpenAPI khai báo trường <code>version</code> nhưng chưa nêu version của lớp hay proposal cần gửi cho từng thao tác. Vì vậy giao diện chỉ cho xem dữ liệu và chưa gửi tạo, áp dụng hoặc hủy.</p>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-800">
          <CalendarClock className="h-4 w-4 text-indigo-600" />
          Tạo đề xuất
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-stone-700">
            Loại đề xuất
            <select value={kind} onChange={(event) => { setKind(event.target.value); setTargetClassId('') }} className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" disabled={proposalLoading || refreshing}>
              <option value="Postpone">Dời ngày khai giảng</option>
              <option value="Transfer">Chuyển lớp</option>
            </select>
          </label>
          {kind === 'Postpone' ? (
            <label className="text-xs font-medium text-stone-700">
              Số ngày dự kiến dời
              <input type="number" min="1" step="1" value={shiftDays} onChange={(event) => setShiftDays(event.target.value)} className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" />
            </label>
          ) : (
            <label className="text-xs font-medium text-stone-700">
              Lớp đích
              <select value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} className="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" disabled={targetsLoading || Boolean(targetsError)}>
                <option value="">{targetsLoading ? 'Đang tải lớp từ Backend…' : targetsError ? 'Không tải được danh sách lớp' : 'Chọn lớp Normal đang mở'}</option>
                {(targets ?? []).map((target) => <option key={target.id} value={target.id}>{target.name ?? `Lớp #${target.id}`}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-stone-700 sm:col-span-2">
            Lý do (tùy chọn theo contract hiện có)
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 block w-full resize-y rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm" placeholder="Nhập lý do đề xuất" />
          </label>
        </div>
        <p className="mt-2 text-xs text-stone-600">Lớp nguồn: {classItem?.name ?? `#${classId}`} · Trạng thái Backend: {text(classItem?.apiStatus)}</p>
        {kind === 'Postpone' && (
          <p className="mt-2 text-xs text-stone-600">Buổi đầu hiện tại: {Array.isArray(sessions) && sessions.length ? sessionDate([...sessions].sort((a, b) => String(a.sessionDate).localeCompare(String(b.sessionDate)))[0]) : 'Chưa xác minh'}</p>
        )}
        {kind === 'Transfer' && (
          <div className="mt-2 space-y-1 text-xs">
            <p className="text-stone-600">Sức chứa còn lại của lớp đích: Chưa xác minh; Backend kiểm tra chỗ và lịch khi nhận đề xuất.</p>
            {targetsError && <p role="alert" className="text-rose-700">Không tải được lớp đích: {targetsError}</p>}
            {targetsError && <button type="button" onClick={loadTargets} disabled={targetsLoading} className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold disabled:opacity-50">Tải lại lớp đích</button>}
            {validTransferTarget && (
              <p className="text-stone-600">Lịch lớp đích:</p>
            )}
            {validTransferTarget && targetSessionsLoading && <p role="status" className="text-stone-500">Đang tải lịch lớp đích…</p>}
            {validTransferTarget && targetSessionsError && <p role="alert" className="text-rose-700">Không tải được lịch lớp đích: {targetSessionsError}</p>}
            {validTransferTarget && Array.isArray(targetSessions) && targetSessions.length === 0 && <p className="text-amber-800">Backend chưa trả lịch cho lớp đích.</p>}
            {validTransferTarget && Array.isArray(targetSessions) && targetSessions.length > 0 && <ul className="max-h-24 space-y-1 overflow-auto rounded bg-white p-2 text-stone-700">{targetSessions.map((item, index) => <li key={item.id ?? index}>{sessionDate(item)}</li>)}</ul>}
          </div>
        )}
        {(lifecycleCheck.blockers.length > 0 || lifecycleCheck.unverified.length > 0) && (
          <p className="mt-2 text-xs text-amber-800">{lifecycleCheck.blockers[0] ?? lifecycleCheck.unverified[0]}</p>
        )}
        <button type="button" disabled title="Chờ Backend xác nhận version trước khi gửi mutation" className="mt-3 rounded-md bg-indigo-700 px-3 py-2 text-xs font-semibold text-white opacity-50">
          Tạo đề xuất (đang chờ xác nhận version)
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
            const applyState = evaluateNormalProposalApply(proposal)
            const isApplyLoading = String(activeApplyProposalId) === String(proposal.id)
            const target = proposal.targetClassId == null ? null : classes?.find((item) => String(item.id) === String(proposal.targetClassId))
            return (
              <li key={proposal.id ?? index} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-stone-900">{inspected.kind === 'unknown' ? `Loại: ${text(proposal.kind)}` : inspected.kind === 'postpone' ? 'Đề xuất dời khai giảng' : 'Đề xuất chuyển lớp'}</p>
                    <p className="mt-1 text-xs text-stone-600">Trạng thái: <span className="font-medium text-stone-900">{text(proposal.status)}</span></p>
                    <p className="mt-1 text-xs text-stone-600">Lớp nguồn: {proposal.classId == null ? 'Chưa xác minh' : `#${proposal.classId}`} · Lớp đích: {proposal.targetClassId == null ? '—' : target?.name ?? `#${proposal.targetClassId}`}</p>
                    {proposal.shiftDays == null ? null : <p className="mt-1 text-xs text-stone-600">Dự kiến dời: {proposal.shiftDays} ngày</p>}
                    <p className="mt-1 text-xs text-stone-600">Lý do: {text(proposal.reason, 'Không có lý do trong response')}</p>
                    <p className="mt-1 text-xs text-stone-500">Proposal version: {proposal.version ?? 'Chưa có thông tin'} · lifecycleVersion lớp: {classItem?.lifecycleVersion ?? 'Chưa có thông tin'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={isApplyLoading} onClick={() => refreshLatestApplyProposal(proposal.id)} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold text-stone-700 disabled:opacity-50">
                      {isApplyLoading ? 'Đang kiểm tra…' : 'Kiểm tra proposal mới nhất'}
                    </button>
                    <button type="button" disabled title={applyState.blockers[0] ?? applyState.unverified[0] ?? 'Chờ xác nhận version từ Backend'} className="rounded-md border border-indigo-300 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 opacity-50">
                      Áp dụng (đang khóa)
                    </button>
                  </div>
                </div>
                {String(latestApplyProposal?.id) === String(proposal.id) && (
                  <div role="status" className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                    <p className="font-semibold">Đã tải proposal mới nhất từ Backend.</p>
                    <p className="mt-1">Proposal version: {latestApplyProposal.version ?? 'Chưa có thông tin'}; trạng thái: {text(latestApplyProposal.status)}. {applyEval?.blockers[0] ?? applyEval?.unverified[0] ?? 'Backend vẫn cần xác nhận version dùng cho apply.'}</p>
                    <p className="mt-1">Chưa gửi thao tác áp dụng.</p>
                  </div>
                )}
                <ProposalSchedule schedule={proposal.schedule} />
                <ProposalChoices proposal={proposal} />
                {proposal.fingerprint == null && <p className="mt-2 text-xs text-amber-800">Fingerprint: Chưa xác minh.</p>}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 border-t border-stone-200 pt-3">
        <p className="text-xs font-semibold text-stone-800">Hủy lớp trước khai giảng</p>
        <p className="mt-1 text-xs text-stone-600">Hủy lớp không đồng nghĩa hoàn tiền. Không thay đổi hóa đơn, enrollment hoặc trạng thái hiển thị tại đây.</p>
        {(cancelCheck.blockers.length > 0 || cancelCheck.unverified.length > 0) && <p className="mt-1 text-xs text-amber-800">{cancelCheck.blockers[0] ?? cancelCheck.unverified[0]}</p>}
        <button type="button" disabled title={cancelCheck.blockers[0] ?? 'Chờ Backend xác nhận version cần gửi'} className="mt-2 rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 opacity-50">
          Hủy lớp (đang chờ xác nhận version)
        </button>
      </div>
    </section>
  )
}

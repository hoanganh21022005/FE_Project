import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, UsersRound } from 'lucide-react'
import { getClassById } from '../../api/managerApi.js'
import { getClassCatalogSessions } from '../../api/memberPortalApi.js'
import { getNormalClassProposals, inspectNormalClassProposal } from '../../api/normalClassLifecycleApi.js'
import { buildNormalProposalChoiceRequest, respondNormalProposal } from '../../api/normalProposalResponseApi.js'
import { formatDate } from '../../locales/translations'
import { NORMAL_CLASS_TIME_SLOTS } from '../modals/new-class/classFormConstants.js'

const classIdOf = (enrollment) => enrollment?.classId ?? enrollment?.class_id ?? enrollment?.courseId ?? enrollment?.sportsClassId
const loadMemberProposals = async (sourceClasses) => {
  const groups = await Promise.all(sourceClasses.map(async ({ id, enrollment }) => {
    const [proposals, sourceSessions] = await Promise.all([
      getNormalClassProposals(id, { notifyForbidden: false }),
      getClassCatalogSessions(id).catch(() => []),
    ])
    return proposals.map((proposal) => ({ proposal, sourceId: id, sourceName: enrollment.className ?? enrollment.courseName ?? enrollment.name ?? `#${id}`, enrollment, sourceSessions }))
  }))
  const entries = groups.flat()
  const targetIds = [...new Set(entries.map(({ proposal }) => Number(proposal.targetClassId)).filter((id) => Number.isInteger(id) && id > 0))]
  const targets = await Promise.all(targetIds.map(async (id) => {
    try { return [id, await getClassById(id, {}, { notifyForbidden: false })] } catch { return [id, null] }
  }))
  const targetById = new Map(targets)
  return entries.map((entry) => ({ ...entry, target: targetById.get(Number(entry.proposal.targetClassId)) ?? null }))
}
const fmt = (value, isVi) => {
  if (!value) return isVi ? 'Chưa có dữ liệu' : 'Unavailable'
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return formatDate(String(value))
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}
const formatSlotLabel = (session, isVi) => {
  const slotNum = Number(session?.slotNumber)
  if (Number.isInteger(slotNum) && slotNum > 0) {
    return isVi ? `Ca ${slotNum}` : `Slot ${slotNum}`
  }
  const start = String(session?.start ?? session?.startTime ?? '').slice(0, 5)
  const end = String(session?.end ?? session?.endTime ?? '').slice(0, 5)
  const matched = NORMAL_CLASS_TIME_SLOTS.find(
    (slot) => slot.startTime === start && (!end || slot.endTime === end),
  )
  if (matched) {
    return isVi ? matched.name : `Slot ${matched.slotNumber}`
  }
  return start ? `${start}${end ? `–${end}` : ''}` : ''
}
const sessionText = (session, isVi) => {
  const date = session?.date ?? session?.sessionDate
  const slot = formatSlotLabel(session, isVi)
  return [date ? formatDate(date) : null, slot].filter(Boolean).join(' · ') || (isVi ? 'Chưa có lịch trong đề xuất' : 'No schedule in proposal')
}
const errorForMember = (error, isVi) => {
  const raw = [error?.code, error?.message, error?.response?.data?.code, error?.response?.data?.message]
    .filter((value) => typeof value === 'string').join(' ').toUpperCase()
  const known = [
    ['NORMAL_PROPOSAL_STALE', isVi ? 'Đề xuất đã thay đổi. Đang tải lại thông tin mới nhất.' : 'The proposal changed. Reloading the latest details.'],
    ['NORMAL_CHOICE_ALREADY_RECORDED', isVi ? 'Bạn đã phản hồi đề xuất này. Đang tải lại trạng thái.' : 'You already responded. Reloading the current status.'],
    ['NORMAL_PRESTART_REQUIRED', isVi ? 'Đề xuất không còn trong thời gian phản hồi.' : 'This proposal is no longer within its response period.'],
    ['CLASS_FULL', isVi ? 'Lớp đích vừa hết chỗ. Liên hệ trung tâm để được hỗ trợ.' : 'The target class just filled up. Contact the center for help.'],
    ['SCHEDULE_CONFLICT', isVi ? 'Lịch lớp mới bị trùng. Liên hệ trung tâm để được hỗ trợ.' : 'The proposed schedule conflicts with another class. Contact the center for help.'],
    ['NORMAL_REGISTRATION_CLOSED', isVi ? 'Lớp đích đã đóng đăng ký. Liên hệ trung tâm để được hỗ trợ.' : 'Registration for the target class has closed. Contact the center for help.'],
    ['NORMAL_RECEIPT_NOT_ELIGIBLE', isVi ? 'Quyền học cần được trung tâm kiểm tra lại.' : 'The center needs to recheck your class entitlement.'],
    ['NORMAL_TRANSFER_INCOMPATIBLE', isVi ? 'Không thể chuyển theo điều kiện hiện tại. Liên hệ trung tâm.' : 'The transfer is not eligible under the current conditions. Contact the center.'],
    ['NORMAL_CHANGE_PENDING', isVi ? 'Đề xuất của lớp đã thay đổi. Hãy tải lại và liên hệ trung tâm nếu vẫn còn lỗi.' : 'The class proposal changed. Reload and contact the center if the issue continues.'],
    ['CLASS_NOT_READY', isVi ? 'Lịch lớp chưa sẵn sàng để chuyển. Liên hệ trung tâm.' : 'The class schedule is not ready for transfer. Contact the center.'],
    ['NORMAL_RESOURCE_UNAVAILABLE', isVi ? 'Nguồn lực của lớp đích đã thay đổi. Liên hệ trung tâm.' : 'The target class resources changed. Contact the center.'],
    ['NORMAL_RESOURCE_CONFLICT', isVi ? 'Lịch HLV hoặc sân của lớp đích bị trùng. Liên hệ trung tâm.' : 'The target coach or court schedule conflicts. Contact the center.'],
    ['HOLIDAY_BLOCKED', isVi ? 'Lịch đề xuất có ngày nghỉ của trung tâm. Liên hệ trung tâm.' : 'The proposed schedule overlaps a center holiday. Contact the center.'],
    ['ALREADY_ENROLLED', isVi ? 'Bạn đã có quyền học ở lớp đích. Liên hệ trung tâm.' : 'You already have an entitlement to the target class. Contact the center.'],
    ['BOOKING_BLOCKED', isVi ? 'Tài khoản hiện chưa thể đặt lớp. Liên hệ trung tâm.' : 'Your account is currently blocked from booking. Contact the center.'],
  ]
  const knownMessage = known.find(([code]) => raw.includes(code))?.[1]
  if (knownMessage) return knownMessage
  const status = Number(error?.status ?? error?.response?.status) || 0
  if (status === 401) return isVi ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để phản hồi.' : 'Your session expired. Sign in again to respond.'
  if (status === 403) return isVi ? 'Tài khoản không có quyền phản hồi đề xuất này.' : 'This account cannot respond to this proposal.'
  if (status === 404) return isVi ? 'Không tìm thấy đề xuất. Hãy tải lại danh sách.' : 'Proposal not found. Reload the list.'
  return isVi
    ? 'Không gửi được phản hồi. Trạng thái chưa được xác nhận; vui lòng tải lại hoặc liên hệ trung tâm.'
    : 'Your response was not confirmed. Reload or contact the center.'
}

export default function MemberNormalProposalInbox({ enrollments = [], memberId, isVi = true, onRefresh }) {
  const sourceClasses = useMemo(() => {
    const unique = new Map()
    for (const enrollment of enrollments) {
      const id = Number(classIdOf(enrollment))
      if (Number.isInteger(id) && id > 0) unique.set(String(id), { id, enrollment })
    }
    return [...unique.values()]
  }, [enrollments])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    let active = true
    if (!sourceClasses.length) {
      setItems([])
      setLoading(false)
      setLoadError('')
      return () => { active = false }
    }
    setLoading(true)
    setLoadError('')
    loadMemberProposals(sourceClasses).then((rows) => {
      if (active) setItems(rows)
    }).catch(() => {
      if (active) setLoadError(isVi ? 'Không tải được đề xuất lớp. Hãy thử tải lại.' : 'Could not load class proposals. Try again.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isVi, sourceClasses])

  const reload = async () => {
    setSuccess(null)
    setItems([])
    // Re-run the read request even if the enrolled class identifiers did not change.
    setLoading(true)
    setLoadError('')
    try {
      setItems(await loadMemberProposals(sourceClasses))
    } catch {
      setLoadError(isVi ? 'Không tải được đề xuất lớp. Hãy thử lại.' : 'Could not load class proposals. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const submitChoice = async (entry, choice) => {
    if (activeId != null) return
    const proposalId = Number(entry.proposal?.id)
    if (!Number.isInteger(proposalId) || proposalId <= 0) return
    const confirmed = typeof window === 'undefined' || window.confirm(choice === 'Accept'
      ? (isVi ? 'Đồng ý với đề xuất? Với đề xuất chuyển lớp, Backend sẽ chuyển quyền học ngay sau khi ghi nhận đồng ý.' : 'Accept this proposal? For a class transfer, the Backend moves your entitlement as soon as your consent is recorded.')
      : (isVi ? 'Gửi lựa chọn không đồng ý và yêu cầu hoàn tiền?' : 'Decline the proposal and request a refund?'))
    if (!confirmed) return
    setActiveId(proposalId)
    setActionError('')
    setSuccess(null)
    try {
      const result = await respondNormalProposal(proposalId, buildNormalProposalChoiceRequest(entry.proposal, choice), { notifyForbidden: false })
      setItems((current) => current.map((item) => String(item.proposal?.id) === String(proposalId) ? { ...item, proposal: result } : item))
      setSuccess({ proposalId, choice, kind: entry.proposal.kind })
      await onRefresh?.()
    } catch (error) {
      setActionError(errorForMember(error, isVi))
      await reload()
    } finally {
      setActiveId(null)
    }
  }

  if (!sourceClasses.length && !success) return null
  const pending = items.filter(({ proposal }) => String(proposal?.status ?? '').toLowerCase() === 'pending' &&
    proposal?.choices?.some((item) => memberId != null && String(item.memberId) === String(memberId) && String(item.choice).toLowerCase() === 'waiting'))
  const visible = items.filter(({ proposal }) => String(proposal?.status ?? '').toLowerCase() === 'pending' || String(proposal?.status ?? '').toLowerCase() === 'applied')

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm" aria-labelledby="member-normal-proposals-heading" aria-busy={loading || activeId != null}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="member-normal-proposals-heading" className="flex items-center gap-2 text-base font-bold text-slate-900"><UsersRound className="h-4 w-4 text-indigo-600" />{isVi ? 'Đề xuất thay đổi lớp' : 'Class change proposals'}</h2>
          <p className="mt-1 text-sm text-slate-600">{isVi ? 'Bạn chỉ phản hồi được đề xuất dành cho quyền học của mình.' : 'You can only respond to proposals for your own class entitlement.'}</p>
        </div>
        <button type="button" onClick={reload} disabled={loading || activeId != null} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{isVi ? 'Tải lại' : 'Reload'}</button>
      </div>
      {loadError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{loadError}</p>}
      {actionError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</p>}
      {success && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success.choice === 'Accept'
        ? success.kind === 'Transfer' ? (isVi ? 'Backend đã ghi nhận đồng ý và xác nhận quyền học đã được chuyển. Đang tải lại thông tin lớp.' : 'The Backend recorded your consent and confirmed the entitlement transfer. Reloading your classes.') : (isVi ? 'Đã ghi nhận đồng ý. Trung tâm sẽ cập nhật thay đổi sau khi xử lý đề xuất.' : 'Your acceptance was recorded. The center will apply the proposed change after processing.')
        : (isVi ? 'Đã ghi nhận lựa chọn yêu cầu hoàn tiền. Đây chưa phải xác nhận tiền đã được hoàn.' : 'Your refund choice was recorded. This does not confirm that money has been refunded.')}</p>}
      {loading && <p role="status" className="py-5 text-center text-sm text-slate-500">{isVi ? 'Đang tải đề xuất…' : 'Loading proposals…'}</p>}
      {!loading && !loadError && visible.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{isVi ? 'Hiện không có đề xuất nào cần phản hồi.' : 'There are no proposals to respond to.'}</p>}
      {!loading && visible.length > 0 && <ul className="mt-4 space-y-3">{visible.map((entry, index) => {
        const proposal = entry.proposal
        const inspected = inspectNormalClassProposal(proposal)
        const ownChoice = inspected.choices?.find((item) => memberId != null && item.memberId != null && String(item.memberId) === String(memberId)) ?? null
        const waiting = String(ownChoice?.choice ?? '').toLowerCase() === 'waiting'
        const targetName = entry.target?.name ?? proposal.targetClassName ?? proposal.targetName ?? (proposal.targetClassId == null ? null : `#${proposal.targetClassId}`)
        const first = Array.isArray(proposal.schedule) ? proposal.schedule[0] : null
        return <li key={proposal.id ?? `${entry.sourceId}-${index}`} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{inspected.kind === 'transfer' ? (isVi ? 'Đề xuất chuyển lớp' : 'Transfer proposal') : inspected.kind === 'postpone' ? (isVi ? 'Đề xuất dời khai giảng' : 'Postponement proposal') : (isVi ? 'Đề xuất thay đổi lớp' : 'Class change proposal')}</p><p className="mt-1 text-sm text-slate-600">{entry.sourceName}{targetName ? ` → ${targetName}` : ''}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{waiting ? (isVi ? 'Chờ phản hồi' : 'Awaiting response') : ownChoice?.choice ? (isVi ? 'Đã phản hồi' : 'Responded') : (isVi ? 'Chưa xác minh phản hồi' : 'Response unverified')}</span></div>
          {proposal.reason && <p className="mt-3 text-sm text-slate-700"><span className="font-semibold">{isVi ? 'Lý do:' : 'Reason:'}</span> {proposal.reason}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">{isVi ? 'Lớp hiện tại' : 'Current class'}</p><p className="mt-1 text-sm font-semibold text-slate-900">{entry.sourceName}</p><p className="mt-1 text-xs text-slate-600">{isVi ? 'Ngày khai giảng:' : 'First session:'} {fmt(entry.sourceSessions?.[0]?.sessionDate ?? entry.enrollment.startDate ?? entry.enrollment.classStartDate, isVi)}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-slate-700">{isVi ? `Lịch hiện tại (${entry.sourceSessions?.length ?? 0} buổi)` : `Current schedule (${entry.sourceSessions?.length ?? 0} sessions)`}</summary><ol className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-slate-600">{entry.sourceSessions?.length ? entry.sourceSessions.map((session, sessionIndex) => <li key={session.id ?? session.sessionId ?? sessionIndex}>{sessionText(session, isVi)} · {isVi ? 'HLV' : 'Coach'} {session.coachName ?? (session.coachId != null ? `#${session.coachId}` : '—')} · {isVi ? 'Sân' : 'Court'} {session.roomName ?? session.room?.name ?? (session.roomId != null ? `#${session.roomId}` : '—')}</li>) : <li>{isVi ? 'Chưa tải được lịch lớp hiện tại.' : 'The current schedule could not be loaded.'}</li>}</ol></details></div>
            <div className="rounded-lg bg-indigo-50 p-3"><p className="text-xs font-semibold uppercase text-indigo-700">{isVi ? 'Lớp đề xuất' : 'Proposed class'}</p><p className="mt-1 text-sm font-semibold text-slate-900">{targetName ?? (isVi ? 'Chưa xác minh tên lớp' : 'Class name unverified')}</p><p className="mt-1 text-xs text-slate-700">{isVi ? 'Môn:' : 'Subject:'} {entry.target?.subjectName ?? (isVi ? 'Chưa xác minh' : 'Unverified')} · {isVi ? 'Khai giảng:' : 'Starts:'} {fmt(first?.date ?? first?.sessionDate ?? entry.target?.startDate, isVi)}</p><p className="mt-1 text-xs text-slate-700">{isVi ? 'HLV:' : 'Coach:'} {entry.target?.coachName ?? (first?.coachId != null ? `#${first.coachId}` : (isVi ? 'Chưa xác minh' : 'Unverified'))} · {isVi ? 'Học phí:' : 'Tuition:'} {entry.target?.tuitionFee != null ? new Intl.NumberFormat(isVi ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(entry.target.tuitionFee) : (isVi ? 'Chưa xác minh' : 'Unverified')}</p><p className="mt-1 text-xs text-slate-700">{isVi ? 'Buổi đầu theo lịch đề xuất:' : 'First proposed session:'} {first ? sessionText(first, isVi) : (isVi ? 'Chưa có dữ liệu' : 'Unavailable')}</p></div>
          </div>
          {Array.isArray(proposal.schedule) && proposal.schedule.length > 0 && (
            <details className="mt-3" open>
              <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
                {isVi ? `Xem lịch mới (${proposal.schedule.length} buổi)` : `View proposed schedule (${proposal.schedule.length} sessions)`}
              </summary>
              <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {proposal.schedule.map((session, sessionIndex) => {
                  const rawDate = session?.date ?? session?.sessionDate
                  const slotLabel = formatSlotLabel(session, isVi)
                  return (
                    <li
                      key={session.sessionId ?? session.id ?? sessionIndex}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700">
                          {sessionIndex + 1}
                        </span>
                        <span className="whitespace-nowrap font-semibold text-slate-900">
                          {rawDate ? formatDate(rawDate) : (isVi ? 'Chưa xác minh' : 'Unverified')}
                        </span>
                      </div>
                      {slotLabel && (
                        <span className="shrink-0 rounded border border-indigo-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                          {slotLabel}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
          <p className="mt-3 text-xs text-slate-600">{ownChoice?.choice ? `${isVi ? 'Phản hồi của bạn:' : 'Your response:'} ${ownChoice.choice}` : (isVi ? 'Chưa xác minh được phản hồi của tài khoản này.' : 'Could not verify this account’s response.')}</p>
          {waiting && String(proposal.status ?? '').toLowerCase() === 'pending' && <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={activeId != null} onClick={() => submitChoice(entry, 'Accept')} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{activeId === proposal.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isVi ? 'Đồng ý chuyển lớp' : 'Accept transfer'}</button><button type="button" disabled={activeId != null} onClick={() => submitChoice(entry, 'Refund')} className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">{isVi ? 'Không đồng ý · Yêu cầu hoàn tiền' : 'Decline · Request refund'}</button></div>}
        </li>
      })}</ul>}
      {pending.length > 0 && <p className="mt-3 text-xs text-slate-500">{isVi ? 'Im lặng không được xem là đồng ý. Lựa chọn sẽ được Backend xác minh.' : 'Silence is not consent. The Backend validates every choice.'}</p>}
    </section>
  )
}

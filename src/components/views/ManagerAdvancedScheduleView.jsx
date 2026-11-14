import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, Search, UserRound } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext.jsx'
import { getErrorMessage } from '../../api/apiErrors.js'
import { getPrivateSessionProposals } from '../../api/memberPortalApi.js'
import { getMyAdvancedRegistrations } from '../../api/advancedRegistrationApi.js'
import { getRooms } from '../../api/managerApi.js'
import { canManageClasses } from '../../api/holidayUtils.js'

const normalize = (value) => String(value ?? '').trim().toLowerCase()

const statusInfo = (status, isVi) => {
  const key = normalize(status)
  if (key === 'accepted') return { label: isVi ? 'Member đã xác nhận' : 'Member accepted', style: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 }
  if (key === 'pending') return { label: isVi ? 'Chờ Member xác nhận' : 'Waiting for Member', style: 'border-amber-200 bg-amber-50 text-amber-800', Icon: Clock3 }
  if (key === 'rejected') return { label: isVi ? 'Member từ chối' : 'Member declined', style: 'border-rose-200 bg-rose-50 text-rose-800', Icon: UserRound }
  if (key === 'expired') return { label: isVi ? 'Đã hết hạn' : 'Expired', style: 'border-stone-200 bg-stone-100 text-stone-700', Icon: Clock3 }
  return { label: status || (isVi ? 'Chưa xác định' : 'Unknown'), style: 'border-stone-200 bg-stone-100 text-stone-700', Icon: Clock3 }
}

const formatDate = (value, language) => {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) return String(value)
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

const formatDateTime = (value, language) => {
  if (!value) return '—'
  const date = String(value).replace('T', ' ')
  return `${formatDate(date.slice(0, 10), language)} · ${date.slice(11, 16) || '—'}`
}

function StatusBadge({ status, isVi }) {
  const config = statusInfo(status, isVi)
  const Icon = config.Icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.style}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}

export default function ManagerAdvancedScheduleView() {
  const { apiEnabled, currentUser, language } = useSCMS()
  const isVi = language === 'vi'
  const canManage = canManageClasses(apiEnabled, currentUser?.authorities)
  const [proposals, setProposals] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(apiEnabled && canManage)
  const [error, setError] = useState('')
  const [lookupWarning, setLookupWarning] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const loadSchedule = useCallback(async () => {
    if (!apiEnabled || !canManage) return
    setLoading(true)
    setError('')
    setLookupWarning('')
    const [proposalResult, registrationResult, roomResult] = await Promise.allSettled([
      getPrivateSessionProposals(),
      getMyAdvancedRegistrations(),
      getRooms({ notifyForbidden: false }),
    ])
    if (proposalResult.status === 'fulfilled') {
      setProposals(Array.isArray(proposalResult.value) ? proposalResult.value : [])
    } else {
      setError(getErrorMessage(proposalResult.reason, isVi ? 'Không tải được lịch học Advanced.' : 'Could not load Advanced schedules.'))
    }
    if (registrationResult.status === 'fulfilled') setRegistrations(registrationResult.value)
    if (roomResult.status === 'fulfilled') setRooms(roomResult.value)
    const lookupErrors = []
    if (registrationResult.status === 'rejected') lookupErrors.push(isVi ? 'Tên Member/Coach/môn học chưa tải được.' : 'Member, Coach, and subject names could not be loaded.')
    if (roomResult.status === 'rejected') lookupErrors.push(isVi ? 'Tên sân/phòng chưa tải được.' : 'Room names could not be loaded.')
    setLookupWarning(lookupErrors.join(' '))
    setLoading(false)
  }, [apiEnabled, canManage, isVi])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  const registrationBySubscription = useMemo(() => new Map(
    registrations
      .filter((item) => item?.subscriptionId != null)
      .map((item) => [String(item.subscriptionId), item]),
  ), [registrations])
  const roomById = useMemo(() => new Map(rooms.map((room) => [String(room.id), room])), [rooms])

  const rows = useMemo(() => proposals.map((proposal) => {
    const registration = registrationBySubscription.get(String(proposal.subscriptionId))
    const session = proposal.session || null
    return {
      ...proposal,
      memberName: session?.bookedMemberName || registration?.memberName || (proposal.memberId ? `Member #${proposal.memberId}` : '—'),
      coachName: session?.coachName || registration?.primaryCoachName || (proposal.coachId ? `Coach #${proposal.coachId}` : '—'),
      subjectName: session?.subjectName || registration?.subjectName || (proposal.subjectId ? `${isVi ? 'Môn' : 'Subject'} #${proposal.subjectId}` : '—'),
      roomName: session?.roomName || roomById.get(String(proposal.roomId))?.name || (proposal.roomId ? `${isVi ? 'Sân/phòng' : 'Room'} #${proposal.roomId}` : '—'),
    }
  }), [proposals, registrationBySubscription, roomById, isVi])

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter((row) => normalize(row.status) === 'pending').length,
    accepted: rows.filter((row) => normalize(row.status) === 'accepted' && row.sessionId != null).length,
    closed: rows.filter((row) => ['rejected', 'expired'].includes(normalize(row.status))).length,
  }), [rows])

  const filteredRows = useMemo(() => {
    const needle = normalize(query)
    return rows
      .filter((row) => statusFilter === 'all' || normalize(row.status) === statusFilter)
      .filter((row) => !fromDate || String(row.sessionDate || '') >= fromDate)
      .filter((row) => !toDate || String(row.sessionDate || '') <= toDate)
      .filter((row) => !needle || [row.memberName, row.coachName, row.subjectName, row.roomName, row.status]
        .some((value) => normalize(value).includes(needle)))
      .sort((a, b) => `${a.sessionDate || ''}T${a.startTime || ''}`.localeCompare(`${b.sessionDate || ''}T${b.startTime || ''}`))
  }, [rows, statusFilter, fromDate, toDate, query])

  if (!apiEnabled) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <PageHeading isVi={isVi} />
        <p className="mt-5 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          {isVi ? 'Kết nối Backend để xem lịch học Advanced.' : 'Connect to the Backend to view Advanced schedules.'}
        </p>
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="w-full space-y-6">
        <PageHeading isVi={isVi} />
        <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isVi ? 'Tài khoản cần quyền MANAGE_CLASSES để xem lịch Advanced.' : 'MANAGE_CLASSES permission is required to view Advanced schedules.'}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6" aria-busy={loading}>
      <PageHeading isVi={isVi} />

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-6 text-indigo-950">
        {isVi
          ? 'Coach tạo đề xuất sau khi đã thống nhất lịch với Member. Buổi tập chỉ được tạo khi Member xác nhận; Manager theo dõi lịch và trạng thái, không thay đổi lịch của hai bên.'
          : 'The Coach creates a proposal after agreeing on a time with the Member. A session is created only after the Member accepts. Managers monitor the schedule and status without changing their agreement.'}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={isVi ? 'Tổng quan lịch Advanced' : 'Advanced schedule overview'}>
        <SummaryCard label={isVi ? 'Tổng lịch' : 'Total schedules'} value={counts.all} tone="stone" />
        <SummaryCard label={isVi ? 'Chờ Member xác nhận' : 'Waiting for Member'} value={counts.pending} tone="amber" />
        <SummaryCard label={isVi ? 'Member đã xác nhận' : 'Member accepted'} value={counts.accepted} tone="emerald" />
        <SummaryCard label={isVi ? 'Từ chối / hết hạn' : 'Declined / expired'} value={counts.closed} tone="rose" />
      </section>

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="block min-w-56 flex-1 text-xs font-semibold text-stone-700">
            {isVi ? 'Tìm Member, Coach, môn hoặc sân/phòng' : 'Search Member, Coach, subject, or room'}
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-stone-400" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </span>
          </label>
          <label className="block text-xs font-semibold text-stone-700">
            {isVi ? 'Trạng thái' : 'Status'}
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal sm:w-52">
              <option value="all">{isVi ? 'Tất cả' : 'All'}</option>
              <option value="pending">{isVi ? 'Chờ Member xác nhận' : 'Waiting for Member'}</option>
              <option value="accepted">{isVi ? 'Member đã xác nhận' : 'Member accepted'}</option>
              <option value="rejected">{isVi ? 'Member từ chối' : 'Member declined'}</option>
              <option value="expired">{isVi ? 'Đã hết hạn' : 'Expired'}</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-stone-700">
            {isVi ? 'Từ ngày' : 'From'}
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal" />
          </label>
          <label className="block text-xs font-semibold text-stone-700">
            {isVi ? 'Đến ngày' : 'To'}
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 min-h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal" />
          </label>
          <button type="button" onClick={loadSchedule} disabled={loading || !canManage} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isVi ? 'Tải lại' : 'Refresh'}
          </button>
        </div>

        {error && <div role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        {lookupWarning && <p role="status" className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{lookupWarning} {isVi ? 'Một số tên có thể chỉ hiện bằng mã.' : 'Some records may display IDs instead of names.'}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Lịch tập' : 'Session'}</th>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Coach</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Môn học' : 'Subject'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Sân/phòng' : 'Room'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Trạng thái xác nhận' : 'Confirmation status'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Member phản hồi / Hạn' : 'Response / deadline'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {!loading && filteredRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-stone-50/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-stone-900">{formatDate(row.sessionDate, language)}</div>
                    <div className="mt-0.5 text-xs tabular-nums text-stone-600">{String(row.startTime || '').slice(0, 5)}–{String(row.endTime || '').slice(0, 5)}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">{row.memberName}</td>
                  <td className="px-4 py-3 text-stone-700">{row.coachName}</td>
                  <td className="px-4 py-3 text-stone-700">{row.subjectName}</td>
                  <td className="px-4 py-3 text-stone-700">{row.roomName}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.status} isVi={isVi} /></td>
                  <td className="px-4 py-3 text-xs text-stone-600">
                    {row.respondedAt
                      ? formatDateTime(row.respondedAt, language)
                      : normalize(row.status) === 'pending'
                        ? `${isVi ? 'Phản hồi trước' : 'Respond by'}: ${formatDateTime(row.respondBy, language)}`
                        : '—'}
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-stone-500">
                  {error ? (isVi ? 'Không thể hiển thị lịch cho đến khi tải dữ liệu thành công.' : 'Schedules are unavailable until data loads successfully.') : proposals.length === 0 ? (isVi ? 'Chưa có Coach nào tạo đề xuất lịch Advanced.' : 'No Coach has proposed an Advanced schedule yet.') : (isVi ? 'Không có lịch nào khớp bộ lọc.' : 'No schedules match these filters.')}
                </td></tr>
              )}
              {loading && <tr><td colSpan={7} role="status" className="px-4 py-12 text-center text-sm text-stone-500">{isVi ? 'Đang tải lịch Advanced…' : 'Loading Advanced schedules…'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
          {isVi ? `${filteredRows.length} lịch đang hiển thị` : `${filteredRows.length} schedules shown`}
        </div>
      </section>
    </div>
  )
}

function PageHeading({ isVi }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-950">{isVi ? 'Lớp Advanced' : 'Advanced Classes'}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {isVi ? 'Theo dõi lịch Coach tạo và trạng thái xác nhận của Member.' : 'Track Coach-created schedules and Member confirmations.'}
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {isVi ? 'Chỉ theo dõi' : 'Read only'}
      </span>
    </header>
  )
}

function SummaryCard({ label, value, tone }) {
  const tones = {
    stone: 'border-stone-200 bg-white text-stone-950',
    amber: 'border-amber-200 bg-amber-50/60 text-amber-950',
    emerald: 'border-emerald-200 bg-emerald-50/60 text-emerald-950',
    rose: 'border-rose-200 bg-rose-50/60 text-rose-950',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold text-stone-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

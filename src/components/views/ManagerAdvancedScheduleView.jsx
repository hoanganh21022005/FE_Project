import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Layers, RefreshCw, Search, ShieldCheck, UserRound, XCircle } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext.jsx'
import { AdminPagination } from '../admin/AdminPagination.jsx'
import { getErrorMessage } from '../../api/apiErrors.js'
import { getPrivateSessionProposals } from '../../api/memberPortalApi.js'
import { getMyAdvancedRegistrations } from '../../api/advancedRegistrationApi.js'
import { getRooms } from '../../api/managerApi.js'
import { canManageClasses } from '../../api/holidayUtils.js'

const normalize = (value) => String(value ?? '').trim().toLowerCase()

const statusInfo = (status, isVi) => {
  const key = normalize(status)
  if (key === 'accepted') return { label: isVi ? 'Member đã xác nhận' : 'Member accepted', style: 'border-status-success-border bg-status-success-bg text-status-success', Icon: CheckCircle2 }
  if (key === 'pending') return { label: isVi ? 'Chờ Member xác nhận' : 'Waiting for Member', style: 'border-status-warning-border bg-status-warning-bg text-status-warning', Icon: Clock3 }
  if (key === 'rejected') return { label: isVi ? 'Member từ chối' : 'Member declined', style: 'border-status-danger-border bg-status-danger-bg text-status-danger', Icon: UserRound }
  if (key === 'expired') return { label: isVi ? 'Đã hết hạn' : 'Expired', style: 'border-border-color bg-bg-secondary text-text-secondary', Icon: Clock3 }
  return { label: status || (isVi ? 'Chưa xác định' : 'Unknown'), style: 'border-border-color bg-bg-secondary text-text-secondary', Icon: Clock3 }
}

const classStatusInfo = (status, isVi) => {
  const key = normalize(status)
  if (key === 'ongoing' || key === 'active') return { label: isVi ? 'Đang diễn ra' : 'Ongoing', style: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  if (key === 'open' || key === 'published') return { label: isVi ? 'Đang mở' : 'Open', style: 'border-blue-200 bg-blue-50 text-blue-700' }
  if (key === 'closed') return { label: isVi ? 'Đã đóng' : 'Closed', style: 'border-slate-200 bg-slate-100 text-slate-700' }
  if (key === 'completed') return { label: isVi ? 'Hoàn thành' : 'Completed', style: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
  if (key === 'cancelled') return { label: isVi ? 'Đã hủy' : 'Cancelled', style: 'border-rose-200 bg-rose-50 text-rose-700' }
  return { label: status || '—', style: 'border-border-color bg-bg-secondary text-text-secondary' }
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
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs leading-4 font-semibold ${config.style}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {config.label}
    </span>
  )
}

export default function ManagerAdvancedScheduleView() {
  const { apiEnabled, currentUser, language, classes, classesLoading } = useSCMS()
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
  const [classQuery, setClassQuery] = useState('')
  const [classStatusFilter, setClassStatusFilter] = useState('all')
  const [classPage, setClassPage] = useState(1)
  const [activeTab, setActiveTab] = useState('classes')
  const [schedulePage, setSchedulePage] = useState(1)
  const CLASS_PAGE_SIZE = 10
  const SCHEDULE_PAGE_SIZE = 10

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

  const advancedClasses = useMemo(() => (classes || []).filter(
    (item) => normalize(item.classType) === 'advanced',
  ), [classes])

  const filteredAdvancedClasses = useMemo(() => {
    const needle = normalize(classQuery)
    return advancedClasses
      .filter((item) => {
        if (classStatusFilter === 'all') return true
        const st = normalize(item.status)
        if (classStatusFilter === 'ongoing') return st === 'ongoing' || st === 'active'
        return st === classStatusFilter
      })
      .filter((item) => !needle || [item.name, item.category, item.coachName]
        .some((value) => normalize(value).includes(needle)))
  }, [advancedClasses, classQuery, classStatusFilter])

  useEffect(() => { setClassPage(1) }, [classQuery, classStatusFilter])

  const classTotalPages = Math.max(1, Math.ceil(filteredAdvancedClasses.length / CLASS_PAGE_SIZE))
  const safeClassPage = Math.min(Math.max(1, classPage), classTotalPages)
  const classStartIndex = (safeClassPage - 1) * CLASS_PAGE_SIZE
  const paginatedAdvancedClasses = filteredAdvancedClasses.slice(classStartIndex, classStartIndex + CLASS_PAGE_SIZE)

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

  useEffect(() => { setSchedulePage(1) }, [query, statusFilter, fromDate, toDate])

  const scheduleTotalPages = Math.max(1, Math.ceil(filteredRows.length / SCHEDULE_PAGE_SIZE))
  const safeSchedulePage = Math.min(Math.max(1, schedulePage), scheduleTotalPages)
  const scheduleStartIndex = (safeSchedulePage - 1) * SCHEDULE_PAGE_SIZE
  const paginatedRows = filteredRows.slice(scheduleStartIndex, scheduleStartIndex + SCHEDULE_PAGE_SIZE)

  if (!apiEnabled) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <PageHeading isVi={isVi} />
        <p className="mt-5 rounded-xl border border-dashed border-border-strong bg-bg-card p-8 text-center text-sm leading-5 text-text-secondary">
          {isVi ? 'Kết nối máy chủ để xem lịch học Advanced.' : 'Connect to the system to view Advanced schedules.'}
        </p>
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="w-full space-y-6">
        <PageHeading isVi={isVi} />
        <div role="alert" className="mt-5 rounded-xl border border-status-warning-border bg-status-warning-bg p-4 text-sm leading-5 text-status-warning">
          {isVi ? 'Tài khoản cần quyền MANAGE_CLASSES để xem lịch Advanced.' : 'MANAGE_CLASSES permission is required to view Advanced schedules.'}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6" aria-busy={loading}>
      <PageHeading isVi={isVi} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-color bg-bg-card p-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={isVi ? 'Chế độ hiển thị Lớp Advanced' : 'Advanced Classes view tabs'}>
          {[
            { id: 'classes', label: isVi ? 'Danh sách lớp Advanced' : 'Advanced classes', count: advancedClasses.length },
            { id: 'schedules', label: isVi ? 'Lịch tập & Xác nhận' : 'Schedules & Confirmations', count: rows.length },
          ].map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-brand-primary text-white shadow-2xs'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count != null && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-secondary'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={loadSchedule}
          disabled={loading || !canManage}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-color bg-bg-card px-3 text-xs font-semibold text-text-primary hover:bg-bg-secondary disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isVi ? 'Tải lại dữ liệu' : 'Refresh data'}
        </button>
      </div>

      {activeTab === 'classes' && (
        <section className="overflow-hidden rounded-xl border border-border-color bg-bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border-color bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Layers className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">{isVi ? 'Danh sách lớp Advanced' : 'Advanced class list'}</h2>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 tabular-nums">
                  {filteredAdvancedClasses.length}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={classQuery}
                  onChange={(event) => setClassQuery(event.target.value)}
                  placeholder={isVi ? 'Tìm lớp, môn, HLV...' : 'Search class, subject, coach...'}
                  aria-label={isVi ? 'Tìm lớp Advanced' : 'Search Advanced classes'}
                  className="h-9 w-full rounded-lg border border-border-strong bg-bg-card pl-9 pr-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary sm:w-56"
                />
              </div>
              <select
                value={classStatusFilter}
                onChange={(event) => setClassStatusFilter(event.target.value)}
                aria-label={isVi ? 'Lọc trạng thái lớp Advanced' : 'Filter Advanced class status'}
                className="h-9 rounded-lg border border-border-strong bg-bg-card px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <option value="all">{isVi ? 'Tất cả trạng thái' : 'All statuses'}</option>
                <option value="ongoing">{isVi ? 'Đang diễn ra' : 'Ongoing'}</option>
                <option value="closed">{isVi ? 'Đã đóng' : 'Closed'}</option>
                <option value="cancelled">{isVi ? 'Đã hủy' : 'Cancelled'}</option>
              </select>
            </div>
          </div>
          {classesLoading ? (
            <p role="status" className="p-6 text-sm text-text-secondary">{isVi ? 'Đang tải lớp Advanced…' : 'Loading Advanced classes…'}</p>
          ) : filteredAdvancedClasses.length === 0 ? (
            <p className="p-8 text-center text-sm text-text-secondary">
              {advancedClasses.length === 0
                ? (isVi ? 'Chưa có lớp Advanced.' : 'No Advanced classes yet.')
                : (isVi ? 'Không có lớp Advanced nào phù hợp bộ lọc.' : 'No Advanced classes match these filters.')}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-border-color bg-bg-secondary text-xs uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th className="w-14 px-4 py-3 text-center font-semibold">STT</th>
                      <th className="px-4 py-3 font-semibold">{isVi ? 'Lớp học' : 'Class'}</th>
                      <th className="px-4 py-3 font-semibold">{isVi ? 'Huấn luyện viên' : 'Coach'}</th>
                      <th className="px-4 py-3 text-center font-semibold">{isVi ? 'Số buổi' : 'Sessions'}</th>
                      <th className="px-4 py-3 text-center font-semibold">{isVi ? 'Học viên' : 'Members'}</th>
                      <th className="px-4 py-3 text-right font-semibold">{isVi ? 'Học phí' : 'Fee'}</th>
                      <th className="px-4 py-3 text-center font-semibold">{isVi ? 'Trạng thái' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {paginatedAdvancedClasses.map((item, idx) => {
                      const st = classStatusInfo(item.status, isVi)
                      return (
                        <tr key={item.id} className="transition-colors hover:bg-bg-main">
                          <td className="px-4 py-3.5 text-center text-xs tabular-nums text-text-secondary">{classStartIndex + idx + 1}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-text-primary">{item.name || (isVi ? `Lớp #${item.id}` : `Class #${item.id}`)}</div>
                            {item.category && <div className="mt-0.5 text-xs text-text-secondary">{item.category}</div>}
                          </td>
                          <td className="px-4 py-3.5 text-text-secondary">{item.coachName || '—'}</td>
                          <td className="px-4 py-3.5 text-center tabular-nums text-text-secondary">
                            {item.sessionCount ?? item.totalSessions ?? '—'} {isVi ? 'buổi' : 'sessions'}
                          </td>
                          <td className="px-4 py-3.5 text-center tabular-nums">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {item.enrolledCount ?? '—'}/{item.capacity ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-text-primary">
                            {item.price == null ? '—' : new Intl.NumberFormat(isVi ? 'vi-VN' : 'en-US').format(item.price) + (isVi ? ' đ' : ' VND')}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.style}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {filteredAdvancedClasses.length > CLASS_PAGE_SIZE && (
                <AdminPagination
                  page={safeClassPage}
                  totalPages={classTotalPages}
                  totalItems={filteredAdvancedClasses.length}
                  pageSize={CLASS_PAGE_SIZE}
                  onPageChange={setClassPage}
                  hideSummary
                  itemLabel={isVi ? 'lớp' : 'classes'}
                />
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={isVi ? 'Tổng quan lịch Advanced' : 'Advanced schedule overview'}>
            <SummaryCard label={isVi ? 'Tổng lịch đề xuất' : 'Total schedules'} value={counts.all} tone="stone" Icon={CalendarDays} />
            <SummaryCard label={isVi ? 'Chờ Member xác nhận' : 'Waiting for Member'} value={counts.pending} tone="amber" Icon={Clock3} />
            <SummaryCard label={isVi ? 'Member đã xác nhận' : 'Member accepted'} value={counts.accepted} tone="emerald" Icon={CheckCircle2} />
            <SummaryCard label={isVi ? 'Từ chối / hết hạn' : 'Declined / expired'} value={counts.closed} tone="rose" Icon={XCircle} />
          </section>

          <section className="overflow-hidden rounded-xl border border-border-color bg-bg-card shadow-sm">
            <div className="border-b border-border-color bg-slate-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-text-primary">{isVi ? 'Lịch tập 1-1 & Trạng thái xác nhận' : '1-on-1 Schedules & Confirmations'}</h2>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700 tabular-nums">
                        {filteredRows.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-text-secondary">
                      {isVi
                        ? 'Coach đề xuất lịch với Member; buổi tập chính thức được tạo khi Member xác nhận.'
                        : 'Coach proposes times with Member; sessions are created upon Member confirmation.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                <label className="block text-xs leading-4 font-semibold text-text-primary lg:col-span-5">
                  {isVi ? 'Tìm kiếm' : 'Search'}
                  <span className="relative mt-1 block">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={isVi ? 'Member, Coach, môn hoặc sân/phòng...' : 'Member, Coach, subject, or room...'}
                      className="h-9 w-full rounded-lg border border-border-strong bg-bg-card pl-9 pr-3 text-sm font-normal text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    />
                  </span>
                </label>
                <label className="block text-xs leading-4 font-semibold text-text-primary lg:col-span-3">
                  {isVi ? 'Trạng thái' : 'Status'}
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border-strong bg-bg-card px-3 text-sm font-normal text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
                    <option value="all">{isVi ? 'Tất cả' : 'All'}</option>
                    <option value="pending">{isVi ? 'Chờ Member xác nhận' : 'Waiting for Member'}</option>
                    <option value="accepted">{isVi ? 'Member đã xác nhận' : 'Member accepted'}</option>
                    <option value="rejected">{isVi ? 'Member từ chối' : 'Member declined'}</option>
                    <option value="expired">{isVi ? 'Đã hết hạn' : 'Expired'}</option>
                  </select>
                </label>
                <label className="block text-xs leading-4 font-semibold text-text-primary lg:col-span-2">
                  {isVi ? 'Từ ngày' : 'From'}
                  <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border-strong bg-bg-card px-2.5 text-sm font-normal text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" />
                </label>
                <label className="block text-xs leading-4 font-semibold text-text-primary lg:col-span-2">
                  {isVi ? 'Đến ngày' : 'To'}
                  <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border-strong bg-bg-card px-2.5 text-sm font-normal text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" />
                </label>
              </div>
            </div>

            {error && <div role="alert" className="m-4 rounded-lg border border-status-danger-border bg-status-danger-bg p-3 text-sm leading-5 text-status-danger">{error}</div>}
            {lookupWarning && <p role="status" className="mx-4 mt-4 rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-xs leading-4 text-status-warning">{lookupWarning} {isVi ? 'Một số tên có thể chỉ hiện bằng mã.' : 'Some records may display IDs instead of names.'}</p>}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-border-color bg-bg-secondary text-xs leading-4 uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{isVi ? 'Lịch tập' : 'Session'}</th>
                    <th className="px-4 py-3 font-semibold">Member</th>
                    <th className="px-4 py-3 font-semibold">Coach</th>
                    <th className="px-4 py-3 font-semibold">{isVi ? 'Môn học' : 'Subject'}</th>
                    <th className="px-4 py-3 font-semibold">{isVi ? 'Sân/phòng' : 'Room'}</th>
                    <th className="px-4 py-3 font-semibold">{isVi ? 'Trạng thái xác nhận' : 'Confirmation status'}</th>
                    <th className="px-4 py-3 font-semibold">{isVi ? 'Phản hồi / Hạn' : 'Response / deadline'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {!loading && paginatedRows.map((row) => (
                    <tr key={row.id} className="align-middle transition-colors hover:bg-bg-main">
                      <td className="px-4 py-3 text-sm leading-5">
                        <div className="font-semibold text-text-primary">{formatDate(row.sessionDate, language)}</div>
                        <div className="mt-0.5 text-xs leading-4 tabular-nums text-text-secondary">{String(row.startTime || '').slice(0, 5)}–{String(row.endTime || '').slice(0, 5)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm leading-5 font-medium text-text-primary">{row.memberName}</td>
                      <td className="px-4 py-3 text-sm leading-5 text-text-secondary">{row.coachName}</td>
                      <td className="px-4 py-3 text-sm leading-5 text-text-secondary">{row.subjectName}</td>
                      <td className="px-4 py-3 text-sm leading-5 text-text-secondary">{row.roomName}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} isVi={isVi} /></td>
                      <td className="px-4 py-3 text-xs leading-4 tabular-nums text-text-secondary">
                        {row.respondedAt
                          ? formatDateTime(row.respondedAt, language)
                          : normalize(row.status) === 'pending'
                            ? `${isVi ? 'Hạn' : 'Due'}: ${formatDateTime(row.respondBy, language)}`
                            : '—'}
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredRows.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-sm leading-5 text-text-secondary">
                      {error ? (isVi ? 'Không thể hiển thị lịch cho đến khi tải dữ liệu thành công.' : 'Schedules are unavailable until data loads successfully.') : proposals.length === 0 ? (isVi ? 'Chưa có Coach nào tạo đề xuất lịch Advanced.' : 'No Coach has proposed an Advanced schedule yet.') : (isVi ? 'Không có lịch nào khớp bộ lọc.' : 'No schedules match these filters.')}
                    </td></tr>
                  )}
                  {loading && <tr><td colSpan={7} role="status" className="px-4 py-12 text-center text-sm leading-5 text-text-secondary">{isVi ? 'Đang tải lịch Advanced…' : 'Loading Advanced schedules…'}</td></tr>}
                </tbody>
              </table>
            </div>
            {filteredRows.length > SCHEDULE_PAGE_SIZE ? (
              <AdminPagination
                page={safeSchedulePage}
                totalPages={scheduleTotalPages}
                totalItems={filteredRows.length}
                pageSize={SCHEDULE_PAGE_SIZE}
                onPageChange={setSchedulePage}
                itemLabel={isVi ? 'lịch' : 'schedules'}
              />
            ) : (
              <div className="border-t border-border-color px-4 py-3 text-xs leading-4 text-text-secondary">
                {isVi ? `${filteredRows.length} lịch đang hiển thị` : `${filteredRows.length} schedules shown`}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function PageHeading({ isVi }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">{isVi ? 'Lớp Advanced' : 'Advanced Classes'}</h1>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          {isVi ? 'Quản lý danh sách lớp 1-1, lịch tập và trạng thái xác nhận của Member.' : 'Overview of 1-on-1 classes, schedules, and Member confirmations.'}
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-status-info-border bg-brand-blue-soft px-3 py-1.5 text-xs leading-4 font-semibold text-brand-primary">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {isVi ? 'Chế độ theo dõi' : 'Read only'}
      </span>
    </header>
  )
}

function SummaryCard({ label, value, tone, Icon }) {
  const tones = {
    stone: { card: 'border-border-color bg-bg-card text-text-primary', icon: 'bg-slate-100 text-slate-600' },
    amber: { card: 'border-status-warning-border bg-status-warning-bg text-status-warning', icon: 'bg-amber-100/80 text-amber-700' },
    emerald: { card: 'border-status-success-border bg-status-success-bg text-status-success', icon: 'bg-emerald-100/80 text-emerald-700' },
    rose: { card: 'border-status-danger-border bg-status-danger-bg text-status-danger', icon: 'bg-rose-100/80 text-rose-700' },
  }
  const style = tones[tone] ?? tones.stone
  return (
    <div className={`flex items-center justify-between rounded-xl border p-4 shadow-2xs ${style.card}`}>
      <div>
        <p className="text-xs leading-4 font-semibold text-text-secondary">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
      {Icon && (
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${style.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}

import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useSCMS } from '../../context/SCMSContext'
import * as managerApi from '../../api/managerApi'
import { getErrorMessage } from '../../api/apiErrors'
import { addDays, localDateString } from '../../api/sessionIncidentUtils'
import { revenueTimelineForDisplay } from '../../api/reportUtils'
import { formatCurrency } from '../../locales/translations'

const CLASS_STATUSES = [
  { value: 'open', vi: 'Đang mở', en: 'Open', color: 'bg-brand-primary' },
  { value: 'ongoing', vi: 'Đang diễn ra', en: 'Ongoing', color: 'bg-brand-teal' },
  { value: 'closed', vi: 'Đã đóng', en: 'Closed', color: 'bg-slate-400' },
  { value: 'cancelled', vi: 'Đã hủy', en: 'Cancelled', color: 'bg-rose-500' },
]

function Panel({ title, subtitle, icon: Icon, action, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5 ${className}`}>
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && <span className="rounded-md bg-brand-blue-soft p-2 text-brand-primary"><Icon className="h-4 w-4" /></span>}
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function Notice({ children, error = false }) {
  return (
    <div className={`rounded-md border p-3 text-xs ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {children}
    </div>
  )
}

function formatRequestError(error, language) {
  const status = error?.status ?? error?.response?.status
  const message = getErrorMessage(error)
  if (status === 404) {
    return language === 'vi'
      ? `Dữ liệu chưa sẵn sàng: ${message}`
      : `Data not available: ${message}`
  }
  if (status === 403) {
    return language === 'vi'
      ? `Tài khoản không có quyền đọc dữ liệu này. ${message}`
      : `This account cannot read this data. ${message}`
  }
  return message
}

function shortPeriod(value) {
  const match = String(value ?? '').match(/^\d{4}-(\d{2})-(\d{2})/)
  return match ? `${match[2]}/${match[1]}` : String(value ?? '—')
}

export function ManagerDashboardInsights({ navigate }) {
  const {
    apiEnabled,
    classes,
    rooms,
    dashboard,
    managerDataLoading,
    managerDataError,
    language,
  } = useSCMS()
  const vi = language === 'vi'
  const today = localDateString()
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(apiEnabled)
  const [sessionsError, setSessionsError] = useState('')
  const [sessionReload, setSessionReload] = useState(0)
  const [revenueRange, setRevenueRange] = useState(7)
  const [revenueReport, setRevenueReport] = useState(null)
  const [revenueLoading, setRevenueLoading] = useState(apiEnabled)
  const [revenueError, setRevenueError] = useState('')
  const [revenueReload, setRevenueReload] = useState(0)

  const revenueStartDate = addDays(today, -(revenueRange - 1))

  useEffect(() => {
    if (!apiEnabled) return undefined
    let active = true
    setSessionsLoading(true)
    setSessionsError('')
    managerApi.getSessions(
      { startDate: today, endDate: today },
      { notifyForbidden: false },
    ).then((items) => {
      if (active) setSessions(Array.isArray(items) ? items : [])
    }).catch((error) => {
      if (active) setSessionsError(error)
    }).finally(() => {
      if (active) setSessionsLoading(false)
    })
    return () => { active = false }
  }, [apiEnabled, today, sessionReload])

  useEffect(() => {
    if (!apiEnabled) return undefined
    let active = true
    setRevenueLoading(true)
    setRevenueError('')
    managerApi.getRevenueReport(
      { startDate: revenueStartDate, endDate: today, groupBy: 'day' },
      { notifyForbidden: false },
    ).then((report) => {
      if (active) setRevenueReport(report)
    }).catch((error) => {
      if (active) setRevenueError(error)
    }).finally(() => {
      if (active) setRevenueLoading(false)
    })
    return () => { active = false }
  }, [apiEnabled, revenueStartDate, today, revenueReload])

  const todaySessions = useMemo(() => sessions
    .filter((session) => session?.sessionDate === today)
    .sort((a, b) => String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''))), [sessions, today])

  const [selectedSportTab, setSelectedSportTab] = useState('all')
  const [expandedSports, setExpandedSports] = useState({})

  const toggleSportAccordion = (sportName) => {
    setExpandedSports((prev) => ({
      ...prev,
      [sportName]: prev[sportName] === undefined ? false : !prev[sportName],
    }))
  }

  const isSportExpanded = (sportName) => {
    return expandedSports[sportName] !== false
  }

  const sportGroups = useMemo(() => {
    const map = {}
    todaySessions.forEach((session) => {
      const classInfo = classes.find((item) => String(item.id) === String(session.classId))
      const sportName = session.subjectName || classInfo?.category || (vi ? 'Bộ môn khác' : 'Other Sport')
      if (!map[sportName]) {
        map[sportName] = {
          name: sportName,
          sessions: [],
          cancelledCount: 0,
        }
      }
      map[sportName].sessions.push(session)
      const st = String(session.status ?? '').toLowerCase()
      if (st === 'cancelled' || st === 'canceled') {
        map[sportName].cancelledCount += 1
      }
    })
    return Object.values(map)
  }, [todaySessions, classes, vi])

  const activeSportTab = sportGroups.some((g) => g.name === selectedSportTab) ? selectedSportTab : 'all'

  const classListComplete = !managerDataLoading
    && !managerDataError
    && Number.isInteger(dashboard?.totalClasses)
    && classes.length === dashboard.totalClasses
  const classStatusCounts = CLASS_STATUSES.map((status) => ({
    ...status,
    count: classes.filter((item) => String(item.apiStatus ?? '').trim().toLowerCase() === status.value).length,
  }))
  const unknownClassStatusCount = classes.filter((item) => !CLASS_STATUSES.some(
    (status) => String(item.apiStatus ?? '').trim().toLowerCase() === status.value,
  )).length
  const revenueTimeline = revenueTimelineForDisplay(revenueReport).filter(
    (item) => item.period && item.revenue != null,
  )
  const classTotal = dashboard?.totalClasses
  const goTo = (path) => navigate?.(path)
  const sessionStatusLabel = (status) => {
    const normalized = String(status ?? '').trim().toLowerCase()
    if (normalized === 'scheduled') return vi ? 'Đã lên lịch' : 'Scheduled'
    if (normalized === 'completed') return vi ? 'Hoàn thành' : 'Completed'
    if (normalized === 'cancelled' || normalized === 'canceled') return vi ? 'Đã hủy' : 'Cancelled'
    return status || '—'
  }

  const renderSessionCard = (session) => {
    const classInfo = classes.find((item) => String(item.id) === String(session.classId))
    const room = session.roomName || rooms.find((item) => String(item.id) === String(session.roomId))?.name
    const status = String(session.status ?? '').toLowerCase()
    const isCancelled = status === 'cancelled' || status === 'canceled'
    const isCompleted = status === 'completed'
    const sessionType = classInfo?.classType
    const startTime = session.startTime ? String(session.startTime).slice(0, 5) : '—'
    const endTime = session.endTime ? String(session.endTime).slice(0, 5) : '—'

    return (
      <article
        key={session.id}
        className={`flex flex-col justify-between rounded-lg border p-3 transition-colors ${
          isCancelled
            ? 'border-rose-200 bg-rose-50/50'
            : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold tabular-nums text-slate-900">
            <span className="text-xs sm:text-sm">{startTime} - {endTime}</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-semibold border ${
                isCancelled
                  ? 'border-rose-300 bg-rose-100 text-rose-800'
                  : isCompleted
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                    : 'border-blue-200 bg-brand-blue-soft text-brand-primary'
              }`}
            >
              {sessionStatusLabel(session.status)}
            </span>
            {sessionType && (
              <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-2xs">
                {sessionType}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 min-w-0">
          <p className="truncate text-xs font-bold text-slate-900" title={session.className || classInfo?.name}>
            {session.className || classInfo?.name || (vi ? 'Chưa có tên lớp' : 'Class name unavailable')}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="truncate max-w-[130px]" title={session.coachName}>
              {session.coachName || (vi ? 'Chưa có Coach' : 'Coach unavailable')}
            </span>
            <span className="text-slate-300">·</span>
            <span className="truncate max-w-[130px]" title={room}>
              {room || (vi ? 'Chưa có phòng' : 'Room unavailable')}
            </span>
          </p>
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {managerDataError && (
        <Notice error>
          {vi ? 'Một số dữ liệu vận hành chưa tải được; các thống kê liên quan sẽ không được xem là 0.' : 'Some operational data did not load; related statistics will not be treated as zero.'}
          <p className="mt-1 whitespace-pre-line">{managerDataError}</p>
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-5"
          title={vi ? 'Lịch học hôm nay' : "Today's schedule"}
          subtitle={today}
          icon={CalendarClock}
          action={<div className="flex items-center gap-1">
            <button type="button" onClick={() => goTo('/manager/session-incidents')} className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-blue-soft">{vi ? 'Xem tất cả' : 'View all'}<ArrowRight className="h-3 w-3" /></button>
            <button type="button" onClick={() => setSessionReload((value) => value + 1)} aria-label={vi ? 'Tải lại lịch học' : 'Refresh schedule'} className="rounded p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button>
          </div>}
        >
          {sessionsLoading ? (
            <p role="status" className="py-8 text-center text-xs text-slate-500">
              {vi ? 'Đang tải buổi học…' : 'Loading sessions…'}
            </p>
          ) : sessionsError ? (
            <Notice error>{formatRequestError(sessionsError, language)}</Notice>
          ) : todaySessions.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              {vi ? 'Hôm nay chưa có buổi học.' : 'No sessions scheduled for today.'}
            </p>
          ) : (
            <div className="space-y-3">
              {/* Filter Tabs Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 pb-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedSportTab('all')}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                    activeSportTab === 'all'
                      ? 'bg-brand-primary text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {vi ? `Tất cả (${todaySessions.length})` : `All (${todaySessions.length})`}
                </button>
                {sportGroups.map((group) => (
                  <button
                    key={group.name}
                    type="button"
                    onClick={() => setSelectedSportTab(group.name)}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                      activeSportTab === group.name
                        ? 'bg-brand-primary text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {group.name} ({group.sessions.length})
                  </button>
                ))}
              </div>

              {/* Scrollable list bounded to max-h-[380px] */}
              <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3">
                {activeSportTab !== 'all' ? (
                  (() => {
                    const group = sportGroups.find((g) => g.name === activeSportTab)
                    if (!group) return null
                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">{group.name}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {vi ? `${group.sessions.length} ca` : `${group.sessions.length} sessions`}
                            </span>
                            {group.cancelledCount > 0 && (
                              <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                {vi ? `${group.cancelledCount} ca bị hủy` : `${group.cancelledCount} cancelled`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {group.sessions.map((session) => renderSessionCard(session))}
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="space-y-2.5">
                    {sportGroups.map((group) => {
                      const expanded = isSportExpanded(group.name)
                      return (
                        <div key={group.name} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => toggleSportAccordion(group.name)}
                            className="flex w-full items-center justify-between bg-slate-50/80 px-3.5 py-2 text-left transition hover:bg-slate-100/80"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{group.name}</span>
                              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {vi ? `${group.sessions.length} ca` : `${group.sessions.length} sessions`}
                              </span>
                              {group.cancelledCount > 0 && (
                                <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                                  {vi ? `${group.cancelledCount} ca bị hủy` : `${group.cancelledCount} cancelled`}
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400">
                              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </span>
                          </button>
                          {expanded && (
                            <div className="border-t border-slate-100 p-2.5 sm:p-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {group.sessions.map((session) => renderSessionCard(session))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title={vi ? 'Xu hướng doanh thu' : 'Revenue trend'}
          subtitle={vi ? 'Dữ liệu tổng hợp từ hệ thống quản lý.' : 'Aggregated system report data.'}
          icon={TrendingUp}
          action={<div className="flex gap-1 rounded-md bg-slate-100 p-1">
            {[7, 30].map((days) => <button key={days} type="button" aria-pressed={revenueRange === days} onClick={() => setRevenueRange(days)} className={`rounded px-2.5 py-1.5 text-xs font-semibold ${revenueRange === days ? 'bg-white text-brand-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{days} {vi ? 'ngày' : 'days'}</button>)}
          </div>}
        >
          {revenueLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải báo cáo doanh thu…' : 'Loading revenue report…'}</p>
            : revenueError ? <Notice error>{formatRequestError(revenueError, language)}</Notice>
              : revenueReport?.totalTransactions === 0 ? <p className="py-8 text-center text-xs text-slate-500">{vi ? 'Không có giao dịch Paid trong khoảng thời gian này.' : 'No paid transactions in this period.'}</p>
                : revenueTimeline.length === 0 ? <Notice>{vi ? 'Dữ liệu chưa sẵn sàng: Báo cáo chưa cung cấp chuỗi doanh thu theo ngày.' : 'Data not available: The report does not provide a daily revenue timeline.'}</Notice>
                  : <>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs text-slate-500">{revenueStartDate} – {today}</span>
                      <span className="text-sm font-bold tabular-nums text-brand-dark">{revenueReport.totalRevenue == null ? '—' : formatCurrency(revenueReport.totalRevenue, language)}</span>
                    </div>
                    <div className="h-56 w-full sm:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueTimeline} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                          <XAxis dataKey="period" tickFormatter={shortPeriod} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} minTickGap={14} />
                          <YAxis width={68} tickFormatter={(value) => formatCurrency(value, language)} tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value) => [value == null ? '—' : formatCurrency(value, language), vi ? 'Doanh thu Paid' : 'Paid revenue']} labelFormatter={shortPeriod} />
                          <Area type="monotone" dataKey="revenue" stroke="var(--brand-primary)" fill="var(--brand-blue-soft)" strokeWidth={2} connectNulls={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={() => goTo('/manager/reports')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:text-brand-primary-hover">
                        {vi ? 'Xem báo cáo' : 'View reports'}<ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>}
        </Panel>

        <Panel
          className="xl:col-span-2"
          title={vi ? 'Tình trạng lớp học' : 'Class status'}
          subtitle={vi ? 'Theo trạng thái lớp học đã xác nhận.' : 'Based on confirmed class statuses.'}
          icon={Activity}
          action={<button type="button" onClick={() => goTo('/manager/classes')} aria-label={vi ? 'Mở quản lý lớp' : 'Open class management'} className="rounded p-2 text-brand-primary hover:bg-brand-blue-soft"><ArrowRight className="h-4 w-4" /></button>}
        >
          {managerDataLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải danh sách lớp…' : 'Loading classes…'}</p>
            : !classListComplete ? <Notice>{vi ? 'Danh sách lớp học đang được cập nhật…' : 'Class list is being updated…'}</Notice>
              : classTotal === 0 ? <p className="py-8 text-center text-xs text-slate-500">{vi ? 'Chưa có lớp học.' : 'No classes found.'}</p>
                : <div className="space-y-3">
                  {classStatusCounts.map((status) => {
                    const percent = classTotal > 0 ? (status.count / classTotal) * 100 : 0
                    return <div key={status.value}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700">{vi ? status.vi : status.en}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{status.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${status.color}`} style={{ width: `${percent}%` }} /></div>
                    </div>
                  })}
                  {unknownClassStatusCount > 0 && <p className="text-xs text-amber-800">{vi ? `${unknownClassStatusCount} lớp có trạng thái chưa được xác định.` : `${unknownClassStatusCount} classes have an unrecognized status.`}</p>}
                  <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">{vi ? `Tổng cộng: ${classTotal} lớp` : `Total: ${classTotal} classes`}</p>
                </div>}
        </Panel>
      </div>

    </div>
  )
}

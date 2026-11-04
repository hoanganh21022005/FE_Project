import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  MapPin,
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
import { canManageClasses } from '../../api/holidayUtils'
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
  if (status === 404) return `BLOCKED BY BACKEND: ${message}`
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
    currentUser,
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
  const canManageSchedule = canManageClasses(apiEnabled, currentUser?.authorities)

  const goTo = (path) => navigate?.(path)
  const sessionStatusLabel = (status) => {
    const normalized = String(status ?? '').trim().toLowerCase()
    if (normalized === 'scheduled') return vi ? 'Đã lên lịch' : 'Scheduled'
    if (normalized === 'completed') return vi ? 'Hoàn thành' : 'Completed'
    if (normalized === 'cancelled' || normalized === 'canceled') return vi ? 'Đã hủy' : 'Cancelled'
    return status || '—'
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
            <button type="button" onClick={() => goTo('/manager/session-incidents')} className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-[10px] font-semibold text-brand-primary hover:bg-brand-blue-soft">{vi ? 'Xem tất cả' : 'View all'}<ArrowRight className="h-3 w-3" /></button>
            <button type="button" onClick={() => setSessionReload((value) => value + 1)} aria-label={vi ? 'Tải lại lịch học' : 'Refresh schedule'} className="rounded p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button>
          </div>}
        >
          {sessionsLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải buổi học…' : 'Loading sessions…'}</p>
            : sessionsError ? <Notice error>{formatRequestError(sessionsError, language)}</Notice>
              : todaySessions.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">{vi ? 'Hôm nay chưa có buổi học.' : 'No sessions scheduled for today.'}</p>
                : <div className="space-y-2.5">
                  {todaySessions.slice(0, 5).map((session) => {
                    const classInfo = classes.find((item) => String(item.id) === String(session.classId))
                    const room = session.roomName || rooms.find((item) => String(item.id) === String(session.roomId))?.name
                    const status = String(session.status ?? '').toLowerCase()
                    const sessionType = classInfo?.classType
                    return (
                      <article key={session.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
                        <div className="font-semibold tabular-nums text-brand-dark">
                          <div className="text-sm">{session.startTime ? String(session.startTime).slice(0, 5) : '—'}</div>
                          <div className="text-[11px] text-slate-500">{session.endTime ? String(session.endTime).slice(0, 5) : '—'}</div>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{session.className || classInfo?.name || (vi ? 'Chưa có tên lớp' : 'Class name unavailable')}</p>
                          <p className="mt-1 truncate text-[11px] text-slate-600">{session.subjectName || classInfo?.category || '—'}<span className="px-1.5">·</span>{session.coachName || (vi ? 'Chưa có Coach' : 'Coach unavailable')}<span className="px-1.5">·</span>{room || (vi ? 'Chưa có phòng' : 'Room unavailable')}</p>
                        </div>
                        <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-auto sm:justify-end">
                          <span className={`rounded px-2 py-1 text-[10px] font-semibold ${status === 'cancelled' || status === 'canceled' ? 'bg-slate-200 text-slate-700' : 'bg-brand-blue-soft text-brand-primary'}`}>{sessionStatusLabel(session.status)}</span>
                          {sessionType && <span className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">{sessionType}</span>}
                        </div>
                      </article>
                    )
                  })}
                </div>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title={vi ? 'Xu hướng doanh thu' : 'Revenue trend'}
          subtitle={vi ? 'Dữ liệu tổng hợp từ báo cáo Backend.' : 'Aggregated backend report data.'}
          icon={TrendingUp}
          action={<div className="flex gap-1 rounded-md bg-slate-100 p-1">
            {[7, 30].map((days) => <button key={days} type="button" aria-pressed={revenueRange === days} onClick={() => setRevenueRange(days)} className={`rounded px-2.5 py-1.5 text-[10px] font-semibold ${revenueRange === days ? 'bg-white text-brand-primary shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{days} {vi ? 'ngày' : 'days'}</button>)}
          </div>}
        >
          {revenueLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải báo cáo doanh thu…' : 'Loading revenue report…'}</p>
            : revenueError ? <Notice error>{formatRequestError(revenueError, language)}</Notice>
              : revenueReport?.totalTransactions === 0 ? <p className="py-8 text-center text-xs text-slate-500">{vi ? 'Không có giao dịch Paid trong khoảng thời gian này.' : 'No paid transactions in this period.'}</p>
                : revenueTimeline.length === 0 ? <Notice>{vi ? 'BLOCKED BY BACKEND: Báo cáo chưa cung cấp chuỗi doanh thu theo ngày có thể xác minh.' : 'BLOCKED BY BACKEND: The report does not provide a verifiable daily revenue timeline.'}</Notice>
                  : <>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[11px] text-slate-500">{revenueStartDate} – {today}</span>
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
          subtitle={vi ? 'Theo trạng thái Backend đã xác nhận.' : 'Based on recognized backend statuses.'}
          icon={Activity}
          action={<button type="button" onClick={() => goTo('/manager/classes')} aria-label={vi ? 'Mở quản lý lớp' : 'Open class management'} className="rounded p-2 text-brand-primary hover:bg-brand-blue-soft"><ArrowRight className="h-4 w-4" /></button>}
        >
          {managerDataLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải danh sách lớp…' : 'Loading classes…'}</p>
            : !classListComplete ? <Notice error>{vi ? `BLOCKED BY BACKEND: Chưa xác minh danh sách lớp đầy đủ (đã tải ${classes.length}, KPI Backend báo ${classTotal ?? '—'}). Không hiển thị phân bố có thể gây hiểu nhầm.` : `BLOCKED BY BACKEND: Class list completeness is unverified (${classes.length} loaded; backend KPI reports ${classTotal ?? '—'}). A distribution could be misleading.`}</Notice>
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
                  {unknownClassStatusCount > 0 && <p className="text-[11px] text-amber-800">{vi ? `${unknownClassStatusCount} lớp có trạng thái chưa được xác định.` : `${unknownClassStatusCount} classes have an unrecognized status.`}</p>}
                  <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">{vi ? `Tổng ${classTotal} lớp · khớp với KPI tổng quan` : `${classTotal} classes · matches the overview KPI`}</p>
                </div>}
        </Panel>
      </div>

      <Panel
        title={vi ? 'Thao tác nhanh' : 'Quick actions'}
        subtitle={vi ? 'Đi đến các trang quản lý hiện có.' : 'Open existing manager pages.'}
        icon={BarChart3}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { path: '/manager/classes', icon: CalendarClock, label: vi ? 'Quản lý lớp học' : 'Manage classes' },
            { path: '/manager/resources', icon: MapPin, label: vi ? 'Quản lý sân/phòng' : 'Manage facilities' },
            { path: '/manager/reports', icon: BarChart3, label: vi ? 'Xem báo cáo' : 'View reports' },
            ...(canManageSchedule ? [{ path: '/manager/session-incidents', icon: AlertTriangle, label: vi ? 'Xử lý sự cố lịch học' : 'Handle schedule incidents' }] : []),
          ].map((action) => {
            const Icon = action.icon
            return <button key={action.path} type="button" onClick={() => goTo(action.path)} className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:border-brand-primary/40 hover:bg-slate-50 hover:text-brand-primary">
              <span className="flex min-w-0 items-center gap-2.5"><Icon className="h-4 w-4 shrink-0 text-brand-primary" /><span className="truncate">{action.label}</span></span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          })}
        </div>
      </Panel>
    </div>
  )
}

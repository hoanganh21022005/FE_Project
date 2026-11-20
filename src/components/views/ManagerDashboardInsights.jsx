import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
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

function formatDateDmy(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value ?? '—')
}

export function ManagerDashboardInsights({ navigate }) {
  const {
    apiEnabled,
    managerDataError,
    language,
  } = useSCMS()
  const vi = language === 'vi'
  const today = localDateString()
  const [revenueRange, setRevenueRange] = useState(7)
  const [revenueReport, setRevenueReport] = useState(null)
  const [revenueLoading, setRevenueLoading] = useState(apiEnabled)
  const [revenueError, setRevenueError] = useState('')
  const [revenueReload, setRevenueReload] = useState(0)

  const revenueStartDate = addDays(today, -(revenueRange - 1))

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

  const revenueTimeline = revenueTimelineForDisplay(revenueReport).filter(
    (item) => item.period && item.revenue != null,
  )
  const goTo = (path) => navigate?.(path)
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
          title={vi ? 'Xu hướng doanh thu' : 'Revenue trend'}
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
                      <span className="text-xs text-slate-500">{formatDateDmy(revenueStartDate)} – {formatDateDmy(today)}</span>
                      <span className="text-sm font-bold tabular-nums text-brand-dark">{revenueReport.totalRevenue == null ? '—' : formatCurrency(revenueReport.totalRevenue, language)}</span>
                    </div>
                    <div className="h-56 w-full sm:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueTimeline} margin={{ top: 24, right: 8, left: 4, bottom: 0 }}>
                          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
                          <XAxis dataKey="period" tickFormatter={shortPeriod} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} minTickGap={14} />
                          <YAxis width={88} tickFormatter={(value) => formatCurrency(value, language)} tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
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


      </div>

    </div>
  )
}

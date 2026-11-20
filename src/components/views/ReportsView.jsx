import React, { useEffect, useMemo, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { getErrorMessage } from '../../api/apiErrors';
import * as managerApi from '../../api/managerApi';
import { localDateString } from '../../api/sessionIncidentUtils';
import { revenueTimelineForDisplay } from '../../api/reportUtils';
import { formatCurrency } from '../../locales/translations';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function EmptyChart({ children }) {
  return <div className="h-64 flex items-center justify-center text-xs text-slate-500">{children}</div>;
}

function buildMockRevenueReport(payments, startDate, endDate, groupBy) {
  const grouped = new Map();
  (payments || []).filter((payment) => payment.status === 'successful').forEach((payment) => {
    const paymentDate = String(payment.paymentDate || '').slice(0, 10);
    if (paymentDate < startDate || paymentDate > endDate) return;
    const period = groupBy === 'month' ? paymentDate.slice(0, 7) : paymentDate;
    const entry = grouped.get(period) || { period, revenue: 0, count: 0 };
    entry.revenue += Number(payment.amount) || 0;
    entry.count += 1;
    grouped.set(period, entry);
  });
  const timeline = [...grouped.values()].sort((a, b) => a.period.localeCompare(b.period));
  const totalRevenue = timeline.reduce((total, entry) => total + entry.revenue, 0);
  const normalizedTimeline = timeline.map((entry) => ({
    ...entry,
    moneyReceived: entry.revenue,
    moneyRefunded: 0,
    netReceived: entry.revenue,
  }));
  return {
    totalRevenue,
    moneyReceived: totalRevenue,
    moneyRefunded: 0,
    netReceived: totalRevenue,
    totalTransactions: timeline.reduce((total, entry) => total + entry.count, 0),
    timeline: normalizedTimeline,
  };
}

export function ReportsView() {
  const { payments, members, t, language, apiEnabled } = useSCMS();
  const [monthlyRevenueReport, setMonthlyRevenueReport] = useState(null);
  const [annualRevenueReport, setAnnualRevenueReport] = useState(null);
  const [memberReport, setMemberReport] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [revenueError, setRevenueError] = useState(null);
  const [memberError, setMemberError] = useState(null);
  const vi = language === 'vi';
  const reportDate = localDateString();
  const currentMonth = reportDate.slice(0, 7);
  const currentYear = reportDate.slice(0, 4);
  const currentMonthStart = `${currentMonth}-01`;
  const currentYearStart = `${currentYear}-01-01`;
  const currentYearEnd = `${currentYear}-12-31`;

  useEffect(() => {
    if (!apiEnabled) return undefined;
    let active = true;
    setRevenueLoading(true);
    Promise.all([
      managerApi.getRevenueReport({ startDate: currentMonthStart, endDate: reportDate, groupBy: 'day' }, { notifyForbidden: false }),
      managerApi.getRevenueReport({ startDate: currentYearStart, endDate: currentYearEnd, groupBy: 'month' }, { notifyForbidden: false }),
    ]).then(([monthReport, yearReport]) => {
      if (!active) return;
      setMonthlyRevenueReport(monthReport);
      setAnnualRevenueReport(yearReport);
      setRevenueError(null);
    }).catch((error) => {
      if (active) setRevenueError(getErrorMessage(error));
    }).finally(() => {
      if (active) setRevenueLoading(false);
    });
    return () => { active = false; };
  }, [apiEnabled, currentMonthStart, currentYearStart, currentYearEnd, reportDate]);

  useEffect(() => {
    if (!apiEnabled) return undefined;
    let active = true;
    setMemberLoading(true);
    managerApi.getMemberReport({ notifyForbidden: false })
      .then((report) => {
        if (active) {
          setMemberReport(report);
          setMemberError(null);
        }
      })
      .catch((error) => {
        if (active) setMemberError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setMemberLoading(false);
      });
    return () => { active = false; };
  }, [apiEnabled]);

  const mockMonthlyReport = useMemo(
    () => buildMockRevenueReport(payments, currentMonthStart, reportDate, 'day'),
    [payments, currentMonthStart, reportDate],
  );
  const mockAnnualReport = useMemo(
    () => buildMockRevenueReport(payments, currentYearStart, currentYearEnd, 'month'),
    [payments, currentYearStart, currentYearEnd],
  );
  const currentMonthReport = apiEnabled ? monthlyRevenueReport : mockMonthlyReport;
  const currentYearReport = apiEnabled ? annualRevenueReport : mockAnnualReport;
  const monthlyTimeline = revenueTimelineForDisplay(currentMonthReport);
  const annualTimelineByMonth = new Map(revenueTimelineForDisplay(currentYearReport).map((entry) => [String(entry.period || '').slice(0, 7), entry]));
  const annualTimeline = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const period = `${currentYear}-${String(monthNumber).padStart(2, '0')}`;
    const entry = annualTimelineByMonth.get(period);
    return {
      period,
      monthLabel: vi ? `T${monthNumber}` : new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(Number(currentYear), index, 1)),
      revenue: entry?.revenue ?? null,
      moneyRefunded: entry?.moneyRefunded ?? null,
      netReceived: entry?.netReceived ?? null,
      count: entry?.count ?? null,
    };
  });
  const monthlyTimelineTotal = monthlyTimeline.reduce((sum, entry) => sum + (Number(entry.revenue) || 0), 0);
  const monthlyTimelineCount = monthlyTimeline.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0);
  const monthlyRefundedTotal = monthlyTimeline.reduce((sum, entry) => sum + (Number(entry.moneyRefunded) || 0), 0);
  const monthlyNetReceivedTotal = monthlyTimeline.reduce((sum, entry) => sum + (Number(entry.netReceived) || 0), 0);
  const monthlyGrowth = memberReport?.monthlyGrowth || [];
  const noYearRevenueData = revenueTimelineForDisplay(currentYearReport).length === 0;

  const moneyTooltip = (value, name) => [value == null ? '—' : formatCurrency(value, language), name];
  const sectionError = (error) => error && <p role="alert" className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>;
  const chartTitleClass = 'text-sm font-bold text-slate-900';
  const chartContainerClass = 'bg-white border border-slate-200 p-5 rounded-lg shadow-xs';
  const axisProps = { tick: { fontSize: 10, fill: '#64748B' }, axisLine: false, tickLine: false };

  return (
    <div className="space-y-6">
      <section className={chartContainerClass}>
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3">
          <h3 className={chartTitleClass}>{vi ? 'Doanh thu' : 'Revenue'} {new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(`${currentMonth}-01T00:00:00`))}</h3>
          <p className="text-xs text-slate-500">{vi ? 'Chi tiết doanh thu và số giao dịch theo từng ngày trong tháng.' : 'Revenue and transaction count by day for this month.'}</p>
        </div>
        {sectionError(revenueError)}
        {revenueLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải báo cáo doanh thu…' : 'Loading revenue report…'}</p>
          : monthlyTimeline.length === 0 ? <EmptyChart>{vi ? 'Tháng này chưa có giao dịch Paid.' : 'No paid transactions this month.'}</EmptyChart>
            : <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-3 font-semibold">{vi ? 'Ngày' : 'Date'}</th>
                    <th className="px-3 py-2.5 text-right font-semibold">{vi ? 'Giao dịch Paid' : 'Paid transactions'}</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">{vi ? 'Doanh thu gộp' : 'Gross revenue'}</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">{vi ? 'Tiền hoàn' : 'Refunds'}</th>
                    <th className="py-2.5 pl-3 text-right font-semibold">{vi ? 'Tiền thực thu' : 'Net received'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyTimeline.map((item) => (
                    <tr key={item.period}>
                      <td className="py-2.5 pr-3 text-slate-800">{item.period}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{item.count ?? '—'}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-slate-900">{item.revenue == null ? '—' : formatCurrency(item.revenue, language)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-rose-700">{item.moneyRefunded == null ? '—' : formatCurrency(item.moneyRefunded, language)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-semibold text-slate-900">{item.netReceived == null ? '—' : formatCurrency(item.netReceived, language)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 font-bold text-slate-900">
                  <tr>
                    <td className="py-3 pr-3">{vi ? 'Tổng theo dữ liệu từng ngày' : 'Daily timeline total'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{monthlyTimelineCount}</td>
                    <td className="py-3 pl-3 text-right tabular-nums">{formatCurrency(monthlyTimelineTotal, language)}</td>
                    <td className="py-3 pl-3 text-right tabular-nums text-rose-700">{formatCurrency(monthlyRefundedTotal, language)}</td>
                    <td className="py-3 pl-3 text-right tabular-nums">{formatCurrency(monthlyNetReceivedTotal, language)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>}
      </section>

      <section className={chartContainerClass}>
        <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3">
          <h3 className={chartTitleClass}>{vi ? 'Doanh thu theo từng tháng trong năm' : 'Revenue by month'} · {currentYear}</h3>
          <p className="text-xs text-slate-500">{vi ? 'Biểu đồ cột so sánh doanh thu theo tháng trong năm hiện tại.' : 'Column chart comparing monthly revenue for the current year.'}</p>
        </div>
        {sectionError(revenueError)}
        {revenueLoading ? <p role="status" className="py-8 text-center text-xs text-slate-500">{vi ? 'Đang tải báo cáo doanh thu…' : 'Loading revenue report…'}</p>
          : noYearRevenueData ? <EmptyChart>{vi ? 'Năm nay chưa có giao dịch Paid hoặc hoàn tiền hoàn tất.' : 'No paid transactions or completed refunds this year.'}</EmptyChart>
            : <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualTimeline} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis {...axisProps} tickFormatter={(value) => formatCurrency(value, language)} />
                  <Tooltip formatter={moneyTooltip} contentStyle={{ backgroundColor: '#1E293B', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="revenue" name={vi ? 'Doanh thu gộp' : 'Gross revenue'} fill="#2A5270" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="moneyRefunded" name={vi ? 'Tiền hoàn' : 'Refunds'} fill="#E11D48" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netReceived" name={vi ? 'Tiền thực thu' : 'Net received'} fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>}
      </section>

      <section className={chartContainerClass}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className={chartTitleClass}>{vi ? 'Báo cáo hội viên' : 'Member report'}</h3>
            <p className="text-xs text-slate-500 mt-1">{vi ? 'Số không có gói hoạt động gồm mọi hội viên hiện không có gói tập kích hoạt.' : 'The inactive count includes members without an active membership package.'}</p>
          </div>
          {memberLoading && <span className="text-xs text-slate-500">{vi ? 'Đang tải…' : 'Loading…'}</span>}
        </div>
        {sectionError(memberError)}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{vi ? 'Tổng hội viên' : 'Total members'}</p><p className="mt-1 font-bold text-slate-900">{apiEnabled ? memberReport?.totalMembers ?? '—' : members.length}</p></article>
          <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{vi ? 'Hội viên Active' : 'Active members'}</p><p className="mt-1 font-bold text-slate-900">{apiEnabled ? memberReport?.activeMembers ?? '—' : members.filter((member) => member.membershipStatus === 'active').length}</p></article>
          <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-500">{vi ? 'Không có gói đang hoạt động' : 'No active package'}</p><p className="mt-1 font-bold text-slate-900">{apiEnabled ? memberReport?.expiredMembers ?? '—' : members.filter((member) => member.membershipStatus !== 'active').length}</p></article>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">{vi ? 'Phân bổ theo gói' : 'Package distribution'}</h4>
            {(!apiEnabled || !memberReport || memberReport.packageDistribution.length === 0)
              ? <EmptyChart>{vi ? 'Chưa có dữ liệu phân bổ.' : 'No package distribution data.'}</EmptyChart>
              : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={memberReport.packageDistribution} margin={{ top: 6, right: 8, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="packageName" tick={{ fontSize: 10, fill: '#64748B' }} /><YAxis {...axisProps} allowDecimals={false} /><Tooltip formatter={(value) => [value, vi ? 'Hội viên' : 'Members']} /><Bar dataKey="memberCount" fill="#3B332B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">{vi ? 'Tăng trưởng hội viên theo tháng' : 'Monthly member growth'}</h4>
            {monthlyGrowth.length === 0
              ? <EmptyChart>{vi ? 'Chưa có dữ liệu tăng trưởng.' : 'No member growth data.'}</EmptyChart>
              : <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyGrowth} margin={{ top: 6, right: 8, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} /><YAxis {...axisProps} allowDecimals={false} /><Tooltip formatter={(value) => [value, vi ? 'Hội viên mới' : 'Members joined']} /><Bar dataKey="count" fill="#2A5270" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          </div>
        </div>
      </section>
    </div>
  );
}

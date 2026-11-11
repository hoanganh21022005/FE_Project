import React, { useEffect, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { getErrorMessage } from '../../api/apiErrors';
import * as managerApi from '../../api/managerApi';
import { revenueSummaryCsvRows, revenueTimelineForDisplay, serializeCsvRows } from '../../api/reportUtils';
import { formatCurrency } from '../../locales/translations';
import { BarChart3, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function EmptyChart({ children }) {
  return <div className="h-64 flex items-center justify-center text-xs text-slate-500">{children}</div>;
}

function RevenueBreakdownTable({ items, categoryLabel, language }) {
  const vi = language === 'vi';
  return <div className="mt-3 overflow-x-auto">
    <table className="w-full text-left text-xs">
      <thead className="text-slate-500 border-b"><tr><th className="py-2 pr-3">{categoryLabel}</th><th className="py-2 px-3 text-right">{vi ? 'Giao dịch' : 'Transactions'}</th><th className="py-2 pl-3 text-right">{vi ? 'Doanh thu' : 'Revenue'}</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{items.map((item, index) => <tr key={`${item.label}-${index}`}><td className="py-2 pr-3 text-slate-800">{item.label || '—'}</td><td className="py-2 px-3 text-right tabular-nums">{item.count ?? '—'}</td><td className="py-2 pl-3 text-right tabular-nums">{item.totalRevenue == null ? '—' : formatCurrency(item.totalRevenue, language)}</td></tr>)}</tbody>
    </table>
  </div>;
}

export function ReportsView() {
  const { payments, members, t, language, apiEnabled } = useSCMS();
  const [revenueReport, setRevenueReport] = useState(null);
  const [memberReport, setMemberReport] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [revenueError, setRevenueError] = useState(null);
  const [memberError, setMemberError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState('month');
  const [filterError, setFilterError] = useState('');
  const vi = language === 'vi';

  useEffect(() => {
    if (!apiEnabled) return undefined;
    if (startDate && endDate && startDate > endDate) {
      setRevenueLoading(false);
      setFilterError(vi ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' : 'Start date must be on or before end date.');
      return undefined;
    }

    setFilterError('');
    let active = true;
    setRevenueLoading(true);
    managerApi.getRevenueReport({ startDate, endDate, groupBy }, { notifyForbidden: false })
      .then((report) => {
        if (active) {
          setRevenueReport(report);
          setRevenueError(null);
        }
      })
      .catch((error) => {
        if (active) setRevenueError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setRevenueLoading(false);
      });

    return () => { active = false; };
  }, [apiEnabled, startDate, endDate, groupBy, vi]);

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

  const mockRevenue = payments.filter((payment) => payment.status === 'successful').reduce((sum, payment) => sum + payment.amount, 0);
  const revenueValue = apiEnabled ? revenueReport?.totalRevenue : mockRevenue;
  const timeline = revenueTimelineForDisplay(revenueReport);
  const packageRevenue = revenueReport?.revenueByPackage || [];
  const methodRevenue = revenueReport?.revenueByMethod || [];
  const monthlyGrowth = memberReport?.monthlyGrowth || [];
  const noPaidTransactions = apiEnabled && revenueReport?.totalTransactions === 0;

  const moneyTooltip = (value) => [value == null ? '—' : formatCurrency(value, language), vi ? 'Doanh thu' : 'Revenue'];
  const sectionError = (error) => error && <p role="alert" className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>;
  const chartTitleClass = 'text-sm font-bold text-slate-900';
  const chartContainerClass = 'bg-white border border-slate-200 p-5 rounded-lg shadow-xs';
  const axisProps = { tick: { fontSize: 10, fill: '#64748B' }, axisLine: false, tickLine: false };

  const handleExportReport = () => {
    const revenueCsvReport = apiEnabled ? revenueReport : { totalRevenue: mockRevenue };
    const rows = [
      ['Metric', 'Value'],
      ...revenueSummaryCsvRows(revenueCsvReport),
      ['totalTransactions', apiEnabled ? revenueReport?.totalTransactions ?? null : payments.filter((p) => p.status === 'successful').length],
      ['averageTransactionValue', apiEnabled ? revenueReport?.averageTransactionValue ?? null : null],
      ['totalMembers', apiEnabled ? memberReport?.totalMembers ?? null : members.length],
      ['activeMembers', apiEnabled ? memberReport?.activeMembers ?? null : members.filter((m) => m.status === 'active').length],
      ['expiredMembers', apiEnabled ? memberReport?.expiredMembers ?? null : members.filter((m) => m.status === 'expired').length],
      [],
      ['Period', 'Revenue', 'Transactions'],
      ...timeline.map((item) => [item.period || item.month || '', item.revenue, item.count]),
    ];
    const csvContent = serializeCsvRows(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `scms-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200"><BarChart3 className="w-5 h-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('reports')}</h2>
            <p className="text-xs text-slate-500">{vi ? 'Báo cáo doanh thu và tăng trưởng hội viên' : 'Revenue and member growth reports'}</p>
          </div>
        </div>
        <button type="button" onClick={handleExportReport} className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded text-xs font-bold flex items-center gap-1.5 border border-slate-300 shadow-xs cursor-pointer">
          <Download className="w-3.5 h-3.5 text-slate-600" /><span>{t('exportReport')}</span>
        </button>
      </div>

      <section className={chartContainerClass}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div>
            <h3 className={chartTitleClass}>{vi ? 'Báo cáo doanh thu' : 'Revenue report'}</h3>
            <p className="text-xs text-slate-500 mt-1">{vi ? 'Chỉ tính các giao dịch đã thanh toán.' : 'Includes paid transactions only.'}</p>
          </div>
          {apiEnabled && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-semibold text-slate-600">{vi ? 'Từ ngày' : 'Start date'}
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="block mt-1 border rounded px-2.5 py-2 font-normal text-slate-800" />
            </label>
            <label className="text-xs font-semibold text-slate-600">{vi ? 'Đến ngày' : 'End date'}
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="block mt-1 border rounded px-2.5 py-2 font-normal text-slate-800" />
            </label>
            <label className="text-xs font-semibold text-slate-600">{vi ? 'Nhóm theo' : 'Group by'}
              <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="block mt-1 w-full border rounded px-2.5 py-2 font-normal text-slate-800">
                <option value="day">{vi ? 'Ngày' : 'Day'}</option>
                <option value="month">{vi ? 'Tháng' : 'Month'}</option>
              </select>
            </label>
          </div>}
        </div>
        {filterError && <p role="alert" className="mb-4 text-xs text-rose-700">{filterError}</p>}
        {sectionError(revenueError)}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
          <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Tổng doanh thu (totalRevenue)' : 'Total revenue (totalRevenue)'}</p><p className="mt-1 font-bold text-slate-900">{revenueValue == null ? '—' : formatCurrency(revenueValue, language)}</p></article>
          {apiEnabled && <>
            <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Tiền đã thu' : 'Money received'}</p><p className="mt-1 font-bold text-slate-900">{revenueReport?.moneyReceived == null ? '—' : formatCurrency(revenueReport.moneyReceived, language)}</p></article>
            <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Tiền đã hoàn' : 'Money refunded'}</p><p className="mt-1 font-bold text-slate-900">{revenueReport?.moneyRefunded == null ? '—' : formatCurrency(revenueReport.moneyRefunded, language)}</p></article>
            <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Tiền thu thuần' : 'Net received'}</p><p className="mt-1 font-bold text-slate-900">{revenueReport?.netReceived == null ? '—' : formatCurrency(revenueReport.netReceived, language)}</p></article>
            <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Điều chỉnh Cash' : 'Cash corrections recorded'}</p><p className="mt-1 font-bold text-slate-900">{revenueReport?.cashCorrectionsRecorded == null ? '—' : formatCurrency(revenueReport.cashCorrectionsRecorded, language)}</p></article>
          </>}
          <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Giao dịch Paid' : 'Paid transactions'}</p><p className="mt-1 font-bold text-slate-900">{apiEnabled ? revenueReport?.totalTransactions ?? '—' : payments.filter((payment) => payment.status === 'successful').length}</p></article>
          <article className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-500">{vi ? 'Giá trị trung bình' : 'Average transaction value'}</p><p className="mt-1 font-bold text-slate-900">{apiEnabled ? revenueReport?.averageTransactionValue == null ? '—' : formatCurrency(revenueReport.averageTransactionValue, language) : mockRevenue ? formatCurrency(mockRevenue / Math.max(1, payments.filter((payment) => payment.status === 'successful').length), language) : '—'}</p></article>
        </div>
        {apiEnabled && <p className="-mt-3 text-xs text-slate-500">{vi ? 'OpenAPI trả totalRevenue như một trường riêng và không mô tả công thức; số liệu này không được xem là đồng nghĩa với tiền thu thuần.' : 'OpenAPI returns totalRevenue as a separate field without defining its formula; it is not treated as the same value as net received.'}</p>}
        {revenueLoading && <p className="mb-3 text-xs text-slate-500">{vi ? 'Đang tải báo cáo doanh thu…' : 'Loading revenue report…'}</p>}
        {apiEnabled && noPaidTransactions
          ? <EmptyChart>{vi ? 'Chưa có giao dịch trong kỳ.' : 'No transactions in this period.'}</EmptyChart>
          : timeline.length === 0
            ? <EmptyChart>{vi ? 'Chưa có dữ liệu biểu đồ.' : 'No chart data available.'}</EmptyChart>
            : <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                  <defs><linearGradient id="reportRevenueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2A5270" stopOpacity={0.75} /><stop offset="95%" stopColor="#2A5270" stopOpacity={0.05} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey={apiEnabled ? 'period' : 'month'} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis {...axisProps} tickFormatter={(value) => formatCurrency(value, language)} />
                  <Tooltip formatter={moneyTooltip} contentStyle={{ backgroundColor: '#1E293B', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey={apiEnabled ? 'revenue' : 'revenue'} stroke="#2A5270" strokeWidth={2.5} fillOpacity={1} fill="url(#reportRevenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>}

        {apiEnabled && <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-6">
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">{vi ? 'Doanh thu theo gói' : 'Revenue by package'}</h4>
            {noPaidTransactions || packageRevenue.length === 0 ? <EmptyChart>{vi ? 'Chưa có dữ liệu theo gói.' : 'No package revenue data.'}</EmptyChart> : <div className="h-56">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={packageRevenue} margin={{ top: 6, right: 8, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="packageName" tick={{ fontSize: 10, fill: '#64748B' }} /><YAxis {...axisProps} tickFormatter={(value) => formatCurrency(value, language)} /><Tooltip formatter={moneyTooltip} /><Bar dataKey="totalRevenue" fill="#3B332B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>}
            {!noPaidTransactions && packageRevenue.length > 0 && <RevenueBreakdownTable items={packageRevenue.map((entry) => ({ label: entry.packageName, count: entry.count, totalRevenue: entry.totalRevenue }))} categoryLabel={vi ? 'Gói' : 'Package'} language={language} />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">{vi ? 'Doanh thu theo phương thức' : 'Revenue by payment method'}</h4>
            {noPaidTransactions || methodRevenue.length === 0 ? <EmptyChart>{vi ? 'Chưa có dữ liệu theo phương thức.' : 'No payment method data.'}</EmptyChart> : <div className="h-56">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={methodRevenue} margin={{ top: 6, right: 8, left: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="method" tick={{ fontSize: 10, fill: '#64748B' }} /><YAxis {...axisProps} tickFormatter={(value) => formatCurrency(value, language)} /><Tooltip formatter={moneyTooltip} /><Bar dataKey="totalRevenue" fill="#2A5270" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            </div>}
            {!noPaidTransactions && methodRevenue.length > 0 && <RevenueBreakdownTable items={methodRevenue.map((entry) => ({ label: entry.method, count: entry.count, totalRevenue: entry.totalRevenue }))} categoryLabel={vi ? 'Phương thức' : 'Method'} language={language} />}
          </div>
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

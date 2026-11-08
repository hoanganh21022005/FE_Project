import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency, formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { ManagerDashboardInsights } from './ManagerDashboardInsights';
import {
  Users, Clock, Calendar, CreditCard,
  ArrowUpRight, AlertTriangle, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export function ManagerDashboard({ onNavigate }) {
  let navigate;
  try {
    navigate = useNavigate();
  } catch {
    navigate = null;
  }
  const { members, classes, payments, bookings, dashboard, dashboardLoading, dashboardError, apiEnabled, t, language } = useSCMS();

  const visibleMembers = apiEnabled ? [] : members;
  const visiblePayments = apiEnabled ? [] : payments;
  const visibleBookings = apiEnabled ? [] : bookings;

  const totalMembersCount = apiEnabled ? dashboard?.totalMembers ?? null : visibleMembers.length;
  const activeMembersCount = apiEnabled ? dashboard?.activeSubscriptions ?? null : visibleMembers.filter(m => m.membershipStatus === 'active').length;
  const pendingPaymentCount = apiEnabled ? null : visibleMembers.filter(m => m.membershipStatus === 'pending_payment').length;
  const gracePeriodCount = apiEnabled ? null : visibleMembers.filter(m => m.membershipStatus === 'grace_period').length;

  const successfulPayments = visiblePayments.filter(p => p.status === 'successful');
  const totalRevenue = apiEnabled ? dashboard?.totalRevenue ?? null : successfulPayments.reduce((acc, p) => acc + p.amount, 0);
  const pendingPaymentsCount = apiEnabled ? null : visiblePayments.filter(p => p.status === 'pending').length;

  if (apiEnabled) {
    const metrics = [
      { label: language === 'vi' ? 'Tổng người dùng' : 'Total users', value: dashboard?.totalUsers },
      { label: language === 'vi' ? 'Tổng hội viên' : 'Total members', value: dashboard?.totalMembers },
      { label: language === 'vi' ? 'Tổng lớp học' : 'Total classes', value: dashboard?.totalClasses },
      { label: language === 'vi' ? 'Tổng gói' : 'Total packages', value: dashboard?.totalPackages },
      { label: language === 'vi' ? 'Tổng doanh thu' : 'Total revenue', value: dashboard?.totalRevenue, money: true },
      { label: language === 'vi' ? 'Hóa đơn đã thanh toán' : 'Paid invoices', value: dashboard?.totalInvoices },
      { label: language === 'vi' ? 'Subscription đang hoạt động' : 'Active subscriptions', value: dashboard?.activeSubscriptions },
      { label: language === 'vi' ? 'Buổi tập hôm nay' : 'Sessions today', value: dashboard?.todaySessions },
    ];

    return (
      <div className="space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label={language === 'vi' ? 'Chỉ số tổng quan' : 'Dashboard metrics'}>
          {metrics.map((metric) => (
            <article key={metric.label} className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
              <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">{metric.label}</h2>
              <p className="mt-2 text-2xl font-bold text-stone-900 tabular-nums">
                {metric.value == null ? '—' : metric.money ? formatCurrency(metric.value, language) : metric.value}
              </p>
            </article>
          ))}
        </section>
        {dashboardLoading && <p className="text-xs text-stone-500">{language === 'vi' ? 'Đang tải số liệu tổng quan…' : 'Loading dashboard metrics…'}</p>}
        {dashboardError && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{dashboardError}</p>}
        <ManagerDashboardInsights navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{t('totalMembers')}</span>
            <div className="p-1.5 bg-brand-blue-soft text-brand-primary rounded border border-brand-primary/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900 tabular-nums">{totalMembersCount ?? '—'}</span>
            {!apiEnabled && <span className="text-xs text-emerald-700 font-bold flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> +12%
            </span>}
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{language === 'vi' ? 'Hiện tại' : 'Current count'}</p>
          <div className="mt-2 text-xs text-stone-500 flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-emerald-700 font-bold">{activeMembersCount ?? '—'} {language === 'vi' ? 'Hoạt động' : 'Active'}</span>
            <span>&bull;</span>
            <span className="text-amber-700 font-medium">{pendingPaymentCount ?? '—'} {language === 'vi' ? 'Chờ thanh toán' : 'Pending'}</span>
          </div>
        </div>

        {/* Grace Period Warning Card */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
              {language === 'vi' ? 'CHỜ GIA HẠN (72 GIỜ)' : 'IN GRACE PERIOD (72H)'}
            </span>
            <div className="p-1.5 bg-amber-50 text-status-warning rounded border border-amber-200 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-status-warning tabular-nums">{gracePeriodCount ?? '—'}</span>
            <span className="text-xs text-stone-600 font-semibold whitespace-nowrap">{language === 'vi' ? 'Tài khoản chờ gia hạn' : 'Grace accounts'}</span>
          </div>
          <p className="mt-2 text-xs text-stone-500 whitespace-nowrap">
            {language === 'vi' ? 'Duy trì quyền lợi tối đa 72 giờ' : 'Benefits remain active for up to 72h'}
          </p>
        </div>

        {/* Revenue Card Box */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">{t('totalRevenue')}</span>
            <div className="p-1.5 bg-brand-mint-soft text-brand-teal rounded border border-brand-teal/20 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-brand-teal tabular-nums">{totalRevenue === null ? '—' : formatCurrency(totalRevenue, language)}</span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{language === 'vi' ? 'Tổng tích lũy *' : 'All-time total *'}</p>
          <div className="mt-2 text-xs text-stone-500 flex items-center justify-between gap-1 whitespace-nowrap">
            <span>{apiEnabled ? dashboard?.totalInvoices ?? '—' : successfulPayments.length} {language === 'vi' ? 'Thành công' : 'Success'}</span>
            <span className="text-amber-700 font-medium">{pendingPaymentsCount ?? '—'} {language === 'vi' ? 'Đang xử lý' : 'Pending'}</span>
          </div>
        </div>

        {/* Today Classes & Attendance */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">{t('todayClasses')}</span>
            <div className="p-1.5 bg-brand-sky-soft text-brand-accent-dark rounded border border-brand-accent/30 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900 tabular-nums">{apiEnabled ? dashboard?.todaySessions ?? '—' : classes.length}</span>
            <span className="text-xs text-brand-accent-dark font-medium whitespace-nowrap">{apiEnabled ? '—' : visibleBookings.length} {language === 'vi' ? 'đăng ký' : 'bookings'}</span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{language === 'vi' ? 'Hôm nay' : 'Today'}</p>
          <div className="mt-2 text-xs text-stone-500 flex items-center gap-1.5 whitespace-nowrap">
            <Activity className="w-3.5 h-3.5 text-brand-accent-dark shrink-0" />
            <span>{language === 'vi' ? 'Tỷ lệ điểm danh:' : 'Attendance:'} <strong className="text-stone-900">{apiEnabled ? '—' : '94.5%'}</strong></span>
          </div>
        </div>
      </div>
      <p className="text-xs text-stone-400 -mt-1">
        {language === 'vi'
          ? '* Phạm vi doanh thu do API cung cấp; cần xác nhận kỳ tính.'
          : '* Revenue scope is provided by the API; period needs confirmation.'}
      </p>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes Table */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4 border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight whitespace-nowrap">
                {language === 'vi' ? 'Lịch lớp học sắp diễn ra' : 'Upcoming classes'}
              </h3>
              <p className="text-xs text-stone-500 whitespace-nowrap">
                {language === 'vi' ? 'Danh sách các lớp nhóm đang vận hành tại trung tâm' : 'Operational group classes at the center'}
              </p>
            </div>
            <button
              onClick={() => {
                if (onNavigate) onNavigate('classes');
                else if (navigate) navigate('/manager/classes');
              }}
              className="text-xs text-brand-primary hover:text-brand-primary-hover cursor-pointer font-bold bg-transparent border-0 p-0"
            >
              {language === 'vi' ? 'Xem tất cả →' : 'View all →'}
            </button>
          </div>

          <div className="overflow-x-auto border border-stone-200 rounded">
            <table className="w-full text-left text-[12px] sm:text-[13px] border-collapse">
              <thead className="bg-stone-50 text-stone-600 uppercase tracking-wider border-b border-stone-200 font-bold text-xs whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3 min-w-[200px] whitespace-nowrap">{language === 'vi' ? 'Mã và tên lớp' : 'Code and class'}</th>
                  <th className="py-2.5 px-2.5 min-w-[80px] whitespace-nowrap">{language === 'vi' ? 'Bộ môn' : 'Category'}</th>
                  <th className="py-2.5 px-2.5 min-w-[130px] whitespace-nowrap">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</th>
                  <th className="py-2.5 px-2.5 min-w-[165px] whitespace-nowrap">{language === 'vi' ? 'Phòng tập' : 'Room'}</th>
                  <th className="py-2.5 px-2 min-w-[85px] text-center whitespace-nowrap">{language === 'vi' ? 'Sức chứa' : 'Capacity'}</th>
                  <th className="py-2.5 px-3 min-w-[130px] text-center whitespace-nowrap">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-700">
                {classes.map(cls => (
                  <tr key={cls.id} className="hover:bg-stone-50 transition-colors h-[48px]">
                    <td className="py-2 px-3 font-semibold text-stone-900 whitespace-nowrap">
                      <div>{language === 'vi' ? cls.nameVi : cls.name}</div>
                      <div className="text-xs text-stone-500 tabular-nums">{apiEnabled ? '—' : `${cls.code} • ${cls.startTime} (${cls.durationMinutes} ${language === 'vi' ? 'phút' : 'min'})`}</div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-xs">
                        {cls.category || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-medium text-stone-800 whitespace-nowrap">{cls.coachName}</td>
                    <td className="py-2 px-2.5 text-stone-600 whitespace-nowrap">{apiEnabled ? '—' : language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</td>
                    <td className="py-2 px-2 text-center tabular-nums whitespace-nowrap">
                      <span className={cls.enrolledCount != null && cls.capacity != null && cls.enrolledCount >= cls.capacity ? 'text-rose-700 font-bold' : 'text-stone-800'}>
                        {cls.enrolledCount ?? '—'}/{cls.capacity ?? '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <StatusBadge type="class" status={cls.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="flex items-center justify-between text-xs text-stone-500 mt-3 pt-3 border-t border-stone-200">
            <span>
              {language === 'vi'
                ? `Hiển thị 1-${classes.length} của ${classes.length} bản ghi`
                : `Showing 1-${classes.length} of ${classes.length} records`}
            </span>
            <div className="flex items-center gap-1 text-xs tabular-nums">
              <button disabled className="px-2 py-1 bg-stone-100 border border-stone-200 rounded opacity-50 cursor-not-allowed">
                {language === 'vi' ? 'Trang trước' : 'Previous'}
              </button>
              <span className="px-2.5 py-1 bg-stone-900 text-white rounded font-bold">1</span>
              <button disabled className="px-2 py-1 bg-stone-100 border border-stone-200 rounded opacity-50 cursor-not-allowed">
                {language === 'vi' ? 'Trang sau' : 'Next'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column Requiring Action */}
        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-stone-200 pb-3">
              <h3 className="text-sm font-bold text-stone-900 tracking-tight whitespace-nowrap">
                {language === 'vi' ? 'Hội viên cần xử lý' : 'Action needed'}
              </h3>
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            </div>

            <div className="space-y-3">
              {visibleMembers.filter(m => m.membershipStatus === 'grace_period' || m.membershipStatus === 'pending_payment').map(m => (
                <div key={m.id} className="p-3 bg-stone-50 border border-stone-200 rounded flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-stone-900">{m.name}</div>
                    <div className="text-xs text-stone-500 tabular-nums">{m.code} &bull; {m.phone}</div>
                    <div className="mt-1">
                      <StatusBadge type="membership" status={m.membershipStatus} />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onNavigate) onNavigate('members');
                      else if (navigate) navigate('/manager/members');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-brand-accent-soft border border-stone-300 hover:border-brand-accent rounded text-xs font-semibold text-stone-800 hover:text-brand-primary shadow-2xs transition-all cursor-pointer"
                  >
                    {language === 'vi' ? 'Xử lý' : 'Process'}
                  </button>
                </div>
              ))}
              {visibleMembers.filter(m => m.membershipStatus === 'grace_period' || m.membershipStatus === 'pending_payment').length === 0 && (
                <p className="text-[13px] text-slate-500 py-4 text-center">
                  {language === 'vi' ? 'Không có hội viên cần xử lý' : 'No members require action'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

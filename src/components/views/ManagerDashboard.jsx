import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency, formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { ManagerDashboardInsights } from './ManagerDashboardInsights';
import { PageHeader } from '../ui/PageHeader';
import { Card, StatCard, SectionTitle } from '../ui/DesignSystem';
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
        <PageHeader
          title={language === 'vi' ? 'Tổng quan' : 'Dashboard'}
          description={language === 'vi' ? 'Số liệu hoạt động của trung tâm' : 'Center activity metrics'}
        />
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label={language === 'vi' ? 'Chỉ số tổng quan' : 'Dashboard metrics'}>
          {metrics.map((metric) => (
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value == null ? '—' : metric.money ? formatCurrency(metric.value, language) : metric.value}
            />
          ))}
        </section>
        {dashboardLoading && <p className="text-xs text-slate-500">{language === 'vi' ? 'Đang tải số liệu tổng quan…' : 'Loading dashboard metrics…'}</p>}
        {dashboardError && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{dashboardError}</p>}
        <ManagerDashboardInsights navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={language === 'vi' ? 'Tổng quan' : 'Dashboard'}
        description={language === 'vi' ? 'Số liệu hoạt động của trung tâm' : 'Center activity metrics'}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <StatCard
          label={t('totalMembers')}
          value={totalMembersCount ?? '—'}
          scope={language === 'vi' ? 'Hiện tại' : 'Current count'}
          icon={<Users className="w-4 h-4" />}
          iconBg="bg-brand-blue-soft"
          iconColor="text-brand-primary"
          footer={
            <div className="text-xs text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-emerald-700 font-bold">{activeMembersCount ?? '—'} {language === 'vi' ? 'Hoạt động' : 'Active'}</span>
              <span>&bull;</span>
              <span className="text-amber-700 font-medium">{pendingPaymentCount ?? '—'} {language === 'vi' ? 'Chờ thanh toán' : 'Pending'}</span>
            </div>
          }
        />

        {/* Grace Period Warning Card */}
        <StatCard
          label={language === 'vi' ? 'CHỜ GIA HẠN (72 GIỜ)' : 'IN GRACE PERIOD (72H)'}
          value={gracePeriodCount ?? '—'}
          valueClassName="text-status-warning"
          scope={language === 'vi' ? 'Tài khoản chờ gia hạn' : 'Grace accounts'}
          icon={<Clock className="w-4 h-4" />}
          iconBg="bg-amber-50"
          iconColor="text-status-warning"
          footer={
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === 'vi' ? 'Duy trì quyền lợi tối đa 72 giờ' : 'Benefits remain active for up to 72h'}
            </p>
          }
        />

        {/* Revenue Card */}
        <StatCard
          label={t('totalRevenue')}
          value={totalRevenue === null ? '—' : formatCurrency(totalRevenue, language)}
          valueClassName="text-brand-teal"
          scope={language === 'vi' ? 'Tổng tích lũy *' : 'All-time total *'}
          icon={<CreditCard className="w-4 h-4" />}
          iconBg="bg-brand-mint-soft"
          iconColor="text-brand-teal"
          footer={
            <div className="text-xs text-slate-500 flex items-center justify-between gap-1 whitespace-nowrap">
              <span>{apiEnabled ? dashboard?.totalInvoices ?? '—' : successfulPayments.length} {language === 'vi' ? 'Thành công' : 'Success'}</span>
              <span className="text-amber-700 font-medium">{pendingPaymentsCount ?? '—'} {language === 'vi' ? 'Đang xử lý' : 'Pending'}</span>
            </div>
          }
        />

        {/* Today Classes & Attendance */}
        <StatCard
          label={t('todayClasses')}
          value={apiEnabled ? dashboard?.todaySessions ?? '—' : classes.length}
          scope={language === 'vi' ? 'Hôm nay' : 'Today'}
          icon={<Calendar className="w-4 h-4" />}
          iconBg="bg-brand-sky-soft"
          iconColor="text-brand-accent-dark"
          footer={
            <div className="text-xs text-slate-500 flex items-center gap-1.5 whitespace-nowrap">
              <Activity className="w-3.5 h-3.5 text-brand-accent-dark shrink-0" />
              <span>{language === 'vi' ? 'Tỷ lệ điểm danh:' : 'Attendance:'} <strong className="text-slate-900">{apiEnabled ? '—' : '94.5%'}</strong></span>
            </div>
          }
        />
      </div>
      <p className="text-xs text-slate-400 -mt-1">
        {language === 'vi'
          ? '* Phạm vi doanh thu do API cung cấp; cần xác nhận kỳ tính.'
          : '* Revenue scope is provided by the API; period needs confirmation.'}
      </p>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes Table */}
        <Card className="lg:col-span-2 !p-5">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div>
              <SectionTitle>{language === 'vi' ? 'Lịch lớp học sắp diễn ra' : 'Upcoming classes'}</SectionTitle>
              <p className="text-xs text-slate-500 whitespace-nowrap">
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

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-[12px] sm:text-[13px] border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200 font-bold text-xs whitespace-nowrap">
                <tr>
                  <th className="py-2.5 px-3 min-w-[200px] whitespace-nowrap">{language === 'vi' ? 'Mã và tên lớp' : 'Code and class'}</th>
                  <th className="py-2.5 px-2.5 min-w-[80px] whitespace-nowrap">{language === 'vi' ? 'Bộ môn' : 'Category'}</th>
                  <th className="py-2.5 px-2.5 min-w-[130px] whitespace-nowrap">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</th>
                  <th className="py-2.5 px-2.5 min-w-[165px] whitespace-nowrap">{language === 'vi' ? 'Phòng tập' : 'Room'}</th>
                  <th className="py-2.5 px-2 min-w-[85px] text-center whitespace-nowrap">{language === 'vi' ? 'Sức chứa' : 'Capacity'}</th>
                  <th className="py-2.5 px-3 min-w-[130px] text-center whitespace-nowrap">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {classes.map(cls => (
                  <tr key={cls.id} className="hover:bg-slate-50 motion-safe:transition-colors motion-safe:duration-150 h-[52px]">
                    <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      <div>{language === 'vi' ? cls.nameVi : cls.name}</div>
                      <div className="text-xs text-slate-500 tabular-nums">{apiEnabled ? '—' : `${cls.code} • ${cls.startTime} (${cls.durationMinutes} ${language === 'vi' ? 'phút' : 'min'})`}</div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs">
                        {cls.category || '—'}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-medium text-slate-800 whitespace-nowrap">{cls.coachName}</td>
                    <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">{apiEnabled ? '—' : language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</td>
                    <td className="py-2 px-2 text-center tabular-nums whitespace-nowrap">
                      <span className={cls.enrolledCount != null && cls.capacity != null && cls.enrolledCount >= cls.capacity ? 'text-rose-700 font-bold' : 'text-slate-800'}>
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
          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
            <span>
              {language === 'vi'
                ? `Hiển thị 1-${classes.length} của ${classes.length} bản ghi`
                : `Showing 1-${classes.length} of ${classes.length} records`}
            </span>
            <div className="flex items-center gap-1 text-xs tabular-nums">
              <button disabled className="px-2 py-1 bg-slate-100 border border-slate-200 rounded opacity-50 cursor-not-allowed">
                {language === 'vi' ? 'Trang trước' : 'Previous'}
              </button>
              <span className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold">1</span>
              <button disabled className="px-2 py-1 bg-slate-100 border border-slate-200 rounded opacity-50 cursor-not-allowed">
                {language === 'vi' ? 'Trang sau' : 'Next'}
              </button>
            </div>
          </div>
        </Card>

        {/* Right Column Requiring Action */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
              <SectionTitle>{language === 'vi' ? 'Hội viên cần xử lý' : 'Action needed'}</SectionTitle>
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            </div>

            <div className="space-y-3">
              {visibleMembers.filter(m => m.membershipStatus === 'grace_period' || m.membershipStatus === 'pending_payment').map(m => (
                <div key={m.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{m.name}</div>
                    <div className="text-xs text-slate-500 tabular-nums">{m.code} &bull; {m.phone}</div>
                    <div className="mt-1">
                      <StatusBadge type="membership" status={m.membershipStatus} />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onNavigate) onNavigate('members');
                      else if (navigate) navigate('/manager/members');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-brand-accent-soft border border-slate-300 hover:border-brand-accent rounded-lg text-xs font-semibold text-slate-800 hover:text-brand-primary shadow-sm motion-safe:transition-all motion-safe:duration-150 cursor-pointer"
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
        </Card>
      </div>
    </div>
  );
}

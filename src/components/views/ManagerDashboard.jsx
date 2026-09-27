import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency, formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import {
  Users, Clock, Calendar, CreditCard,
  ArrowUpRight, AlertTriangle, Activity
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

export function ManagerDashboard() {
  const { members, classes, payments, bookings, dashboard, apiEnabled, t, language, setCurrentTab } = useSCMS();

  const visibleMembers = apiEnabled ? [] : members;
  const visiblePayments = apiEnabled ? [] : payments;
  const visibleBookings = apiEnabled ? [] : bookings;

  const totalMembersCount = apiEnabled ? (dashboard?.totalMembers ?? 0) : visibleMembers.length;
  const activeMembersCount = visibleMembers.filter(m => m.membershipStatus === 'active').length;
  const pendingPaymentCount = visibleMembers.filter(m => m.membershipStatus === 'pending_payment').length;
  const gracePeriodCount = visibleMembers.filter(m => m.membershipStatus === 'grace_period').length;

  const successfulPayments = visiblePayments.filter(p => p.status === 'successful');
  const totalRevenue = successfulPayments.reduce((acc, p) => acc + p.amount, 0);
  const pendingPaymentsCount = visiblePayments.filter(p => p.status === 'pending').length;

  // Monthly Revenue Data for Area Chart
  const revenueTrendData = apiEnabled ? [] : [
    { month: language === 'vi' ? 'T5/2026' : 'May 26', revenue: 9800000, target: 10000000 },
    { month: language === 'vi' ? 'T6/2026' : 'Jun 26', revenue: 11200000, target: 11000000 },
    { month: language === 'vi' ? 'T7/2026' : 'Jul 26', revenue: 12500000, target: 12000000 },
    { month: language === 'vi' ? 'T8/2026' : 'Aug 26', revenue: 13800000, target: 13000000 },
    { month: language === 'vi' ? 'T9/2026' : 'Sep 26', revenue: 14700000, target: 14000000 },
  ];

  // Member Status Breakdown Data for Bar Chart
  const memberStatusData = [
    { name: language === 'vi' ? 'Đang hoạt động' : 'Active', count: activeMembersCount, fill: '#059669' },
    { name: language === 'vi' ? 'Chờ thanh toán' : 'Pending Pay', count: pendingPaymentCount, fill: '#D97706' },
    { name: language === 'vi' ? 'Chờ gia hạn' : 'Grace Period', count: gracePeriodCount, fill: '#EA580C' },
    { name: language === 'vi' ? 'Hết hạn' : 'Expired', count: visibleMembers.filter(m => m.membershipStatus === 'expired').length, fill: '#DC2626' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{t('totalMembers')}</span>
            <div className="p-1.5 bg-stone-100 text-orange-600 rounded border border-stone-200">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900 tabular-nums">{totalMembersCount}</span>
            <span className="text-xs text-emerald-700 font-bold flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> +12%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-emerald-700 font-bold">{activeMembersCount} {language === 'vi' ? 'Hoạt động' : 'Active'}</span>
            <span>&bull;</span>
            <span className="text-amber-700 font-medium">{pendingPaymentCount} {language === 'vi' ? 'Chờ thanh toán' : 'Pending'}</span>
          </div>
        </div>

        {/* Grace Period Warning Card */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">
              {language === 'vi' ? 'CHỜ GIA HẠN (72 GIỜ)' : 'IN GRACE PERIOD (72H)'}
            </span>
            <div className="p-1.5 bg-orange-50 text-orange-600 rounded border border-orange-200 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-orange-600 tabular-nums">{gracePeriodCount}</span>
            <span className="text-xs text-orange-700 font-semibold whitespace-nowrap">{language === 'vi' ? 'Tài khoản chờ gia hạn' : 'Grace accounts'}</span>
          </div>
          <p className="mt-2 text-[11px] text-stone-500 whitespace-nowrap">
            {language === 'vi' ? 'Duy trì quyền lợi tối đa 72 giờ' : 'Benefits remain active for up to 72h'}
          </p>
        </div>

        {/* Revenue Card Box */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">{t('totalRevenue')}</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">{formatCurrency(totalRevenue, language)}</span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center justify-between gap-1 whitespace-nowrap">
            <span>{successfulPayments.length} {language === 'vi' ? 'Thành công' : 'Success'}</span>
            <span className="text-amber-700 font-medium">{pendingPaymentsCount} {language === 'vi' ? 'Đang xử lý' : 'Pending'}</span>
          </div>
        </div>

        {/* Today Classes & Attendance */}
        <div className="bg-white border border-stone-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider whitespace-nowrap">{t('todayClasses')}</span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded border border-amber-200 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-stone-900 tabular-nums">{apiEnabled ? (dashboard?.totalClasses ?? classes.length) : classes.length}</span>
            <span className="text-xs text-orange-700 font-medium whitespace-nowrap">{visibleBookings.length} {language === 'vi' ? 'đăng ký' : 'bookings'}</span>
          </div>
          <div className="mt-2 text-[11px] text-stone-500 flex items-center gap-1.5 whitespace-nowrap">
            <Activity className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>{language === 'vi' ? 'Tỷ lệ điểm danh:' : 'Attendance:'} <strong className="text-stone-900">94.5%</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Classes Table */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-lg p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4 border-b border-stone-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight whitespace-nowrap">
                {language === 'vi' ? 'Lịch lớp học sắp diễn ra' : 'Upcoming classes'}
              </h3>
              <p className="text-[11px] text-stone-500 whitespace-nowrap">
                {language === 'vi' ? 'Danh sách các lớp nhóm đang vận hành tại trung tâm' : 'Operational group classes at the center'}
              </p>
            </div>
            <button
              onClick={() => setCurrentTab && setCurrentTab('classes')}
              className="text-xs text-orange-600 hover:text-orange-700 cursor-pointer font-bold bg-transparent border-0 p-0"
            >
              {language === 'vi' ? 'Xem tất cả →' : 'View all →'}
            </button>
          </div>

          <div className="overflow-x-auto border border-stone-200 rounded">
            <table className="w-full text-left text-[12px] sm:text-[13px] border-collapse">
              <thead className="bg-stone-50 text-stone-600 uppercase tracking-wider border-b border-stone-200 font-bold text-[11px] whitespace-nowrap">
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
                      <div className="text-[11px] text-stone-500 tabular-nums">{cls.code} &bull; {cls.startTime} ({cls.durationMinutes} {language === 'vi' ? 'phút' : 'min'})</div>
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-mono text-[10px]">
                        {cls.category}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-medium text-stone-800 whitespace-nowrap">{cls.coachName}</td>
                    <td className="py-2 px-2.5 text-stone-600 whitespace-nowrap">{language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</td>
                    <td className="py-2 px-2 text-center tabular-nums whitespace-nowrap">
                      <span className={cls.enrolledCount >= cls.capacity ? 'text-rose-700 font-bold' : 'text-stone-800'}>
                        {cls.enrolledCount}/{cls.capacity}
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
            <div className="flex items-center gap-1 text-[11px] tabular-nums">
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
                    <div className="text-[11px] text-stone-500 tabular-nums">{m.code} &bull; {m.phone}</div>
                    <div className="mt-1">
                      <StatusBadge type="membership" status={m.membershipStatus} />
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentTab && setCurrentTab('members')}
                    className="px-2.5 py-1 bg-white hover:bg-orange-50 border border-stone-300 hover:border-orange-500 rounded text-[11px] font-semibold text-stone-800 hover:text-orange-700 shadow-2xs transition-all cursor-pointer"
                  >
                    {language === 'vi' ? 'Xử lý' : 'Process'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

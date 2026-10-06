import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { Award, Calendar, AlertTriangle, ShieldCheck, Activity, Flame, Dumbbell } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export function MemberDashboard() {
  const { currentUser, members, packages, bookings, cancelBooking, t, language } = useSCMS();

  const member = members.find(m => m.id === currentUser.id) || members[0];
  const pkg = packages.find(p => p.id === member.currentPackageId);

  const myBookings = bookings.filter(b => b.memberId === member.id && b.status === 'confirmed');

  const fitnessTrendData = [
    { week: language === 'vi' ? 'Tuần 1' : 'W1', calories: 1850, weight: 68.5 },
    { week: language === 'vi' ? 'Tuần 2' : 'W2', calories: 2200, weight: 68.0 },
    { week: language === 'vi' ? 'Tuần 3' : 'W3', calories: 2450, weight: 67.4 },
    { week: language === 'vi' ? 'Tuần 4' : 'W4', calories: 2900, weight: 66.8 },
  ];

  return (
    <div className="space-y-6">
      {/* Member Welcome Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {language === 'vi' ? 'HỘI VIÊN CHÍNH THỨC' : 'VERIFIED MEMBER'}
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            {language === 'vi' ? `Xin chào, ${member.name}!` : `Welcome, ${member.name}!`}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'vi' ? 'Mã hội viên:' : 'Member Code:'} <strong className="font-mono text-slate-900 tabular-nums">{member.code}</strong> &bull; {language === 'vi' ? 'Trạng thái dịch vụ' : 'Service Status'}
          </p>
        </div>

        <div>
          <StatusBadge type="membership" status={member.membershipStatus} />
        </div>
      </div>

      {/* Package Privilege Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span>{language === 'vi' ? 'Gói Dịch Vụ Đang Sử Dụng' : 'Active Membership Package'}</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">{member.currentPackageName || (language === 'vi' ? 'Chưa đăng ký gói' : 'No Package Enrolled')}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' ? 'Quyền lợi gia không giới hạn các lớp nhóm Gym, Yoga & Pilates.' : 'Unlimited access to Gym, Yoga & Pilates group classes.'}
          </p>

          <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">{language === 'vi' ? 'HLV Phụ Trách:' : 'Assigned PT:'}</span>
            <span className="font-bold text-slate-900">{member.primaryCoachName || 'Lê Thị Mai (Yoga PT)'}</span>
          </div>
        </div>

        {/* Business State Warnings */}
        {member.membershipStatus === 'grace_period' ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Gói thành viên đang trong Grace Period (72h gia hạn)</p>
              <p className="mt-1 leading-relaxed">
                Vui lòng hoàn tất thanh toán tại quầy Lễ tân hoặc chuyển khoản VietQR để tránh bị tự động khóa quyền đặt lịch lớp học.
              </p>
            </div>
          </div>
        ) : member.membershipStatus === 'pending_payment' ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">{t('pending_payment')}</p>
              <p className="mt-1 leading-relaxed">{t('bookingDeniedPayment')}</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded flex items-start gap-3 text-emerald-900 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">{language === 'vi' ? 'Tài Khoản Đang Hoạt Động Bình Thường' : 'Account Active'}</p>
              <p className="mt-1 leading-relaxed">
                {language === 'vi'
                  ? 'Bạn có thể tự do đăng ký các lớp Yoga, CrossFit, Boxing trong Danh mục Lớp Học.'
                  : 'You can freely book Yoga, CrossFit and Boxing sessions in the Class Catalog.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Fitness Statistics Chart */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-600 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
              {language === 'vi' ? 'Thống Kê Tiến Độ Tập Luyện & Calo Tiêu Hao' : 'Fitness Progress & Calorie Burn Statistics'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">4 {language === 'vi' ? 'tuần gần nhất' : 'weeks'}</span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fitnessTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="right" orientation="right" domain={[65, 70]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Line yAxisId="left" type="monotone" dataKey="calories" name={language === 'vi' ? 'Calo tiêu hao (kcal)' : 'Calories Burned (kcal)'} stroke="#D97706" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="weight" name={language === 'vi' ? 'Cân nặng (kg)' : 'Weight (kg)'} stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* My Booked Classes */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-700 shrink-0" />
            <span className="whitespace-nowrap">{language === 'vi' ? 'Lịch Lớp Đã Đăng Ký' : 'My Booked Classes'}</span>
          </h3>
        </div>

        {myBookings.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">{t('noData')}</div>
        ) : (
          <div className="space-y-3">
            {myBookings.map(bk => (
              <div key={bk.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{bk.className}</div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">Ngày đăng ký: {bk.bookingDate}</div>
                </div>

                <button
                  onClick={() => cancelBooking(bk.id)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-xs font-bold shadow-xs cursor-pointer"
                >
                  {t('cancelBooking')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { Calendar, Users, ClipboardCheck, Clock, BarChart3, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

export function CoachDashboard() {
  const { classes, currentUser, t, language } = useSCMS();

  const myClasses = classes.filter(c => c.coachId === currentUser.id || c.coachName.includes('Mai'));

  const chartData = myClasses.map(c => ({
    name: language === 'vi' ? (c.nameVi.length > 15 ? c.nameVi.slice(0, 15) + '...' : c.nameVi) : c.name,
    enrolled: c.enrolledCount,
    capacity: c.capacity,
  }));

  const weeklyAttendanceData = [
    { day: language === 'vi' ? 'Thứ 2' : 'Mon', rate: 92 },
    { day: language === 'vi' ? 'Thứ 3' : 'Tue', rate: 96 },
    { day: language === 'vi' ? 'Thứ 4' : 'Wed', rate: 88 },
    { day: language === 'vi' ? 'Thứ 5' : 'Thu', rate: 95 },
    { day: language === 'vi' ? 'Thứ 6' : 'Fri', rate: 100 },
    { day: language === 'vi' ? 'Thứ 7' : 'Sat', rate: 98 },
    { day: language === 'vi' ? 'CN' : 'Sun', rate: 90 },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
            PT
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === 'vi' ? `Xin chào Coach ${currentUser.name}!` : `Welcome Coach ${currentUser.name}!`}
            </h2>
            <p className="text-xs text-slate-500">
              {language === 'vi'
                ? 'Lịch dạy, quản lý học viên phân công & thống kê điểm danh chuyên cần'
                : 'Teaching schedule, assigned students & attendance statistics'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === 'vi' ? 'Lớp phụ trách' : 'Assigned Classes'}
            </span>
            <Calendar className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{myClasses.length}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === 'vi' ? 'Học viên PT chính' : 'PT Students'}
            </span>
            <Users className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">8</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === 'vi' ? 'Tỷ lệ điểm danh' : 'Attendance Rate'}
            </span>
            <ClipboardCheck className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 tabular-nums mt-2">96.8%</div>
        </div>
      </div>

      {/* Statistical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Enrollment vs Capacity Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === 'vi' ? 'Thống Kê Sức Chứa & Đăng Ký Lớp' : 'Class Enrollment vs Capacity'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Tài khoản Coach</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar dataKey="enrolled" name={language === 'vi' ? 'Đã đăng ký' : 'Enrolled'} fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="capacity" name={language === 'vi' ? 'Sức chứa tối đa' : 'Capacity'} fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Attendance Trend Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === 'vi' ? 'Thống Kê Tỷ Lệ Điểm Danh Trong Tuần (%)' : 'Weekly Attendance Rate (%)'}
              </h3>
            </div>
            <span className="text-[11px] text-emerald-700 font-bold font-mono">TB: 96.8%</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
                <Bar dataKey="rate" name={language === 'vi' ? 'Tỷ lệ điểm danh (%)' : 'Attendance %'} fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Teaching Schedule */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2 whitespace-nowrap">
          {language === 'vi' ? 'Các Lớp Dạy Sắp Tới' : 'Teaching Schedule'}
        </h3>
        <div className="space-y-3">
          {myClasses.map(cls => (
            <div key={cls.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{language === 'vi' ? cls.nameVi : cls.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="tabular-nums font-mono">{formatDate(cls.date, language)} &bull; {cls.startTime} ({cls.durationMinutes}m)</span>
                  <span>&bull; {language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">{cls.enrolledCount}/{cls.capacity} {language === 'vi' ? 'Học viên' : 'Students'}</span>
                <button className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs cursor-pointer">
                  {t('attendance')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

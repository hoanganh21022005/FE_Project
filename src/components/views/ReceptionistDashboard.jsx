import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { StatusBadge } from '../common/Badge';
import { NewMemberModal } from '../modals/NewMemberModal';
import { PaymentModal } from '../modals/PaymentModal';
import { Search, UserPlus, CreditCard, Clock, Activity, Users } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function ReceptionistDashboard() {
  const { members, t, language } = useSCMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedMemPay, setSelectedMemPay] = useState('');

  const searchResults = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const checkinData = [
    { time: '06:00', count: 18 },
    { time: '08:00', count: 32 },
    { time: '10:00', count: 24 },
    { time: '12:00', count: 15 },
    { time: '14:00', count: 28 },
    { time: '16:00', count: 45 },
    { time: '18:00', count: 62 },
    { time: '20:00', count: 38 },
  ];

  return (
    <div className="space-y-6">
      {/* Rapid Check-in Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {language === 'vi' ? 'Quầy Lễ Tân SCMS Center' : 'SCMS Reception Desk'}
          </h2>
          <p className="text-xs text-slate-500">
            {language === 'vi'
              ? 'Tra cứu nhanh hội viên, Đăng ký mới, Đặt lịch lớp & Thu tiền'
              : 'Fast member lookup, new enrollment, class booking & desk payments'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsNewMemberOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Tạo Hội Viên Mới' : 'New Member'}</span>
          </button>

          <button
            onClick={() => setIsPayOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5 shrink-0" />
            <span>{language === 'vi' ? 'Thu tiền & Ghi nhận' : 'Record Payment'}</span>
          </button>
        </div>
      </div>

      {/* Reception KPI Metrics & Hourly Check-in Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === 'vi' ? 'Lưu Lượng Lượt Check-in Theo Khung Giờ' : 'Hourly Check-in Volume'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Hôm nay</span>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={checkinData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
                <Bar dataKey="count" name={language === 'vi' ? 'Lượt khách check-in' : 'Check-ins'} fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div className="border-b border-slate-200 pb-3 mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {language === 'vi' ? 'Tổng Quan Ca Trực' : 'Shift Overview'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {language === 'vi' ? 'Thống kê hoạt động quầy lễ tân' : 'Reception desk activity summary'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">{language === 'vi' ? 'Lượt check-in hôm nay:' : 'Today Check-ins:'}</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">262</span>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">{language === 'vi' ? 'Giao dịch thu tiền:' : 'Transactions:'}</span>
              <span className="text-base font-bold text-emerald-800 tabular-nums">14</span>
            </div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-bold">{language === 'vi' ? 'Hội viên đăng ký mới:' : 'New Members:'}</span>
              <span className="text-base font-bold text-blue-800 tabular-nums">5</span>
            </div>
          </div>
        </div>
      </div>

      {/* Member Rapid Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight">
          {language === 'vi' ? 'Tìm Kiếm & Tra Cứu Hồ Sơ Thành Viên' : 'Rapid Member Lookup'}
        </h3>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Nhập tên, số điện thoại hoặc mã hội viên (ví dụ: MB-1001)...' : 'Type name, phone or member code (e.g. MB-1001)...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
          />
        </div>

        <div className="space-y-3 pt-2">
          {searchResults.map(m => (
            <div key={m.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500 font-mono tabular-nums">{m.code} &bull; SĐT: {m.phone} &bull; Email: {m.email}</div>
                <div className="mt-1">
                  <StatusBadge type="membership" status={m.membershipStatus} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedMemPay(m.id); setIsPayOpen(true); }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{language === 'vi' ? 'Thu tiền' : 'Payment'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NewMemberModal isOpen={isNewMemberOpen} onClose={() => setIsNewMemberOpen(false)} />
      <PaymentModal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} preselectedMemberId={selectedMemPay} />
    </div>
  );
}
